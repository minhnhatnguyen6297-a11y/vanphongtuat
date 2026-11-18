#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { appDir, loginMock, output, serveApp } from './ao-ca/browser.mjs';
import { webmFromVp8 } from './ao-ca/webm.mjs';

const options = process.argv.slice(2);
const tier = options.find(arg=>arg.startsWith('--tier='))?.split('=')[1] ?? 'cao';
const viewports = (options.find(arg=>arg.startsWith('--viewport='))?.split('=')[1] ?? '1366x768,1920x1080')
  .split(',').map(size => size.split('x').map(Number));
const record = options.includes('--record');
const check = options.includes('--check');
const art = new URL('public/art/be/', appDir);
const bgHash = 'da7426aaf2ae40180bb07e53b1304a64dc58f0347894afe590a598f331e31f0f';
const results = [];
function result(label, pass, detail) {
  results.push({label, pass, detail});
  console.log((pass ? 'PASS' : 'FAIL')+'\t'+label+'\t'+detail);
}
function dataUrl(png) { return 'data:image/png;base64,' + png.toString('base64'); }

async function inspectPixels(page, baseline, lit, later, mask) {
  return page.evaluate(async ({baseline,lit,later,mask}) => {
    const pixels = async source => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d', {willReadFrequently:true});
      ctx.drawImage(image,0,0);
      return ctx.getImageData(0,0,image.width,image.height);
    };
    const [base,on,moved,map] = await Promise.all([baseline,lit,later,mask].map(pixels));
    const { width, height } = on;
    const ratio = Math.max(width/map.width,height/map.height);
    const left = (width-map.width*ratio)/2, top = (height-map.height*ratio)/2;
    const luma = (data,i) => 0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2];
    let outsideMax=0, outsideSum=0, outside=0, litPixels=0, movedPixels=0, worstRow=0;
    const stride=width*4;
    for(let y=0;y<height;y++) {
      let row=0;
      for(let x=0;x<width;x++) {
        const u = Math.min(map.width-1,Math.floor((x+0.5-left)/ratio));
        const v = Math.min(map.height-1,Math.floor((y+0.5-top)/ratio));
        const g=map.data[(v*map.width+u)*4+1];
        const i=(y*width+x)*4;
        let delta=0, motion=0;
        for(let c=0;c<3;c++) {
          delta=Math.max(delta,Math.abs(on.data[i+c]-base.data[i+c]));
          motion=Math.max(motion,Math.abs(moved.data[i+c]-on.data[i+c]));
        }
        if (g===0) {
          outside++;
          outsideMax=Math.max(outsideMax,delta);
          outsideSum+=delta;
        } else {
          if(delta>2) litPixels++;
          if(motion>2) movedPixels++;
        }
        if (y>0 && y<height-1 && Math.abs(luma(on.data,i) - (luma(on.data,i-stride)+luma(on.data,i+stride))/2)>6) row++;
      }
      worstRow=Math.max(worstRow,row/width);
    }
    return {outsideMax,outsideMean:outsideSum/outside,outside,litPixels,movedPixels,worstRow};
  }, {baseline:dataUrl(baseline),lit:dataUrl(lit),later:dataUrl(later),mask:dataUrl(mask)});
}

async function recordSand(page, width, height) {
  const clipWidth = 960, clipHeight = Math.round(height*clipWidth/width);
  const fps=30, frameCount=300;
  const frames=await page.evaluate(async ({width,height,fps,frameCount}) => {
    const api=window.__aoCa;
    api.scenario('wide');
    const source=document.querySelector('[data-fish-tank]');
    const background=document.querySelector('[data-ao-bg]');
    await background.decode();
    const canvas=document.createElement('canvas');
    canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d');
    const ratio=Math.max(width/background.naturalWidth,height/background.naturalHeight);
    const w=background.naturalWidth*ratio, h=background.naturalHeight*ratio;
    const frames=[];
    let encoderError;
    const encoder=new VideoEncoder({
      output(chunk) {
        const data=new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        frames.push({type:chunk.type,timestamp:chunk.timestamp,data:Array.from(data)});
      },
      error(error) { encoderError=error; },
    });
    encoder.configure({codec:'vp8',width,height,framerate:fps,bitrate:3_000_000,latencyMode:'quality'});
    try {
      // Render each timestamp directly. The review clip keeps its cadence even if Chrome is occluded.
      for(let index=0;index<frameCount;index++) {
        api.advance(index===0 ? 0 : 1/fps);
        ctx.drawImage(background,(width-w)/2,(height-h)/2,w,h);
        ctx.drawImage(source,0,0,width,height);
        const frame=new VideoFrame(canvas,{timestamp:Math.round(index*1e6/fps)});
        encoder.encode(frame,{keyFrame:index%60===0});
        frame.close();
        if(index%15===14) await encoder.flush();
        if(encoderError) throw encoderError;
      }
      await encoder.flush();
      return frames;
    } finally {
      if(encoder.state!=='closed') encoder.close();
    }
  }, {width:clipWidth,height:clipHeight,fps,frameCount});
  const clip=webmFromVp8(frames,{width:clipWidth,height:clipHeight,fps});
  const name='caustic-10s-'+width+'x'+height+'.webm';
  const metadata = await page.evaluate(async data => {
    const video=document.createElement('video');
    await new Promise((done,fail)=>{
      video.onloadeddata=done;
      video.onerror=()=>fail(new Error('Chrome could not decode review clip'));
      video.src='data:video/webm;base64,'+data;
    });
    return {duration:video.duration,width:video.videoWidth,height:video.videoHeight};
  },clip.toString('base64'));
  await writeFile(new URL(name, output),clip);
  result('Clip caustic', frames.length===frameCount && Math.abs(metadata.duration-10)<0.05 &&
    metadata.width===clipWidth && metadata.height===clipHeight, name+' '+metadata.duration.toFixed(2)+' s, '+frames.length+' khung');
}

await mkdir(output, {recursive:true});
const built = await readFile(new URL('public/app.js', appDir),'utf8');
const bg = await readFile(new URL('hang-da-v2.png', art));
const mask = await readFile(new URL('scene-map.png', art));
result('Tách chunk Three.js', !built.includes('WebGLRenderer'), 'app.js');
result('File ảnh nền giữ nguyên byte', createHash('sha256').update(bg).digest('hex')===bgHash, bgHash);
const app=await serveApp();
let browser;
try {
  browser=await chromium.launch({channel:'chrome', headless:false});
  for(const [width,height] of viewports) {
    assert.ok(width>0&&height>0);
    const name=width+'x'+height;
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type()==='error' && /shader|ao-ca|webgl/i.test(message.text())) errors.push(message.text());
    });
    await loginMock(page,app.base,'#/chat?golden=1&seed=42&tier='+tier);
    await page.waitForFunction(()=>Boolean(window.__aoCa?.state), undefined, {timeout:18000});
    await page.addStyleTag({content:'.hn-fab-cluster { visibility:hidden !important }'});
    await page.locator('[data-ao-bg]').evaluate(img=>img.decode());
    const started=await page.evaluate(() => {
      const api=window.__aoCa;
      api.scenario('wide');
      return {state:api.state(),perf:api.perf(),viewport:[innerWidth,innerHeight]};
    });
    result(name+' GPU và viewport',
      started.perf.tier!=='tinh' && !/SwiftShader|llvmpipe|Basic Render/i.test(started.perf.renderer) && started.viewport[0]===width && started.viewport[1]===height,
      started.perf.renderer+' · canvas '+started.perf.canvas.w+'x'+started.perf.canvas.h);
    result(name+' Lệnh vẽ', started.perf.drawCalls>0 && started.perf.drawCalls<=7,
      String(started.perf.drawCalls));
    await page.evaluate(()=>window.__aoCa.showSand(false));
    const baseline=await page.screenshot();
    await page.evaluate(()=>window.__aoCa.showSand(true));
    const lit=await page.screenshot();
    await writeFile(new URL('wide-'+name+'-t0.png',output),lit);
    await page.evaluate(()=>window.__aoCa.advance(2));
    const later=await page.screenshot();
    await writeFile(new URL('wide-'+name+'-t2.png',output),later);
    await page.evaluate(()=>window.__aoCa.advance(4));
    await writeFile(new URL('wide-'+name+'-t6.png',output),await page.screenshot());
    const pixels=await inspectPixels(page,baseline,lit,later,mask);
    result(name+' Nền ngoài G không đổi', pixels.outside>0 && pixels.outsideMax<=1 && pixels.outsideMean<=1,
      'max='+pixels.outsideMax+' mean='+pixels.outsideMean.toFixed(4));
    result(name+' Không vệt ngang', pixels.worstRow<=0.8,
      'hàng lớn nhất '+(pixels.worstRow*100).toFixed(2)+'%');
    result(name+' Caustic có chuyển động trong G', pixels.litPixels>100 && pixels.movedPixels>100,
      'sáng='+pixels.litPixels+' chuyển động='+pixels.movedPixels);
    await page.evaluate(()=>window.__aoCa.scenario('wide'));
    const repeat=await page.screenshot();
    const reset=await page.evaluate(()=>window.__aoCa.state());
    result(name+' Golden tái lập', lit.equals(repeat) && reset.seconds===0 && reset.seed===42, 'seed=42, t=0');
    if(record && width===1366) { await page.bringToFront(); await recordSand(page,width,height); }
    result(name+' WebGL không lỗi', errors.length===0, errors.join(' | ') || '0 lỗi');
    await page.close();
  }
  const defaults = await browser.newPage({viewport:{width:1366,height:768}});
  await loginMock(defaults,app.base);
  const canvas2d = await defaults.locator('[data-fish-tank]').evaluate(canvas =>
    canvas.getContext('2d') !== null && !window.__aoCa && !document.querySelector('[data-ao-bg]'));
  result('Ao V2 mặc định', canvas2d, '#/chat giữ Canvas2D');
  await defaults.close();
  await browser.close();
  browser=await chromium.launch({channel:'chrome',headless:false,args:['--use-angle=swiftshader']});
  const soft=await browser.newPage({viewport:{width:1366,height:768}});
  await loginMock(soft,app.base,'#/chat?perf=1');
  await soft.waitForFunction(()=>Boolean(window.__aoCa?.perf),undefined,{timeout:12000});
  const softState=await soft.evaluate(()=>window.__aoCa.perf());
  result('GPU mềm chọn Tĩnh', /SwiftShader/i.test(softState.renderer) && softState.tier==='tinh', softState.renderer);
} finally {
  await browser?.close();
  await app.close();
  await writeFile(new URL('visual-checks.json',output),JSON.stringify(results,null,2));
}
if(check && results.some(item=>!item.pass)) process.exitCode=1;
