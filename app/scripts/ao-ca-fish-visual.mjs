import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { loginMock,output,serveApp } from './ao-ca/browser.mjs';
import { recordPond } from './ao-ca/record-pond.mjs';

async function fishExtent(page) {
  await page.evaluate(()=>window.__aoCa.showShadows(false));
  const withFish=await page.screenshot();
  await page.evaluate(()=>window.__aoCa.showFish(false));
  const withoutFish=await page.screenshot();
  await page.evaluate(()=>{window.__aoCa.showFish(true);window.__aoCa.showShadows(true);});
  return page.evaluate(async ([current,empty])=>{
    async function pixels(encoded) {
      const image=new Image();image.src='data:image/png;base64,'+encoded;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      return ctx.getImageData(0,0,canvas.width,canvas.height);
    }
    const [a,b]=await Promise.all([pixels(current),pixels(empty)]);
    let l=a.width,r=-1;
    for(let y=0;y<a.height;y++) for(let x=0;x<a.width;x++) {
      const i=(y*a.width+x)*4;
      const d=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]));
      if(d>5){l=Math.min(l,x);r=Math.max(r,x);}
    }
    return Math.max(0,r-l+1);
  },[withFish,withoutFish].map(v=>v.toString('base64')));
}

await mkdir(output,{recursive:true});
const app=await serveApp();
const browser=await chromium.launch({channel:'chrome',headless:false});
const metrics=[];
try {
  for(const viewport of [{width:1366,height:768},{width:1920,height:1080}]) {
    const page=await browser.newPage({viewport});
    const errors=[];
    page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|ao-ca/i.test(m.text())) errors.push(m.text());});
    page.on('pageerror',e=>errors.push(e.message));
    await loginMock(page,app.base,'#/chat?golden=1&seed=42&tier=cao');
    await page.addStyleTag({content:'.hn-fab-cluster { visibility:hidden !important }'});
    await page.waitForFunction(()=>{const api=window.__aoCa;if(!api?.state) return false;api.advance(0);return !api.state().scene.pending&&api.perf().fishShown===8;},undefined,{timeout:30000,polling:100});
    const size=viewport.width+'x'+viewport.height;
    const read=()=>page.evaluate(()=>{
      const api=window.__aoCa,{scene}=api.state();
      return {state:scene,perf:api.perf(),glError:document.querySelector('[data-fish-tank]').getContext('webgl2').getError()};
    });
    const shot=async name=>writeFile(new URL('p2-'+size+'-'+name+'.png',output),await page.screenshot());
    for(const name of ['wide','closeup','uturn','depth','bubbles']) {
      await page.evaluate(name=>window.__aoCa.scenario(name),name);
      if(name==='bubbles') await page.evaluate(()=>window.__aoCa.advance(5));
      if(name==='uturn') {
        await shot('uturn-t0');
        const side=await fishExtent(page);
        await page.evaluate(()=>window.__aoCa.advance(14/60));
        await shot('uturn-angle');
        await page.evaluate(()=>window.__aoCa.advance(7/60));
        await shot('uturn-t035');
        await writeFile(new URL('p2-'+size+'-headon-detail.png',output),await page.screenshot({
          clip:{x:Math.floor(viewport.width*.43),y:Math.floor(viewport.height*.50),
            width:Math.floor(viewport.width*.14),height:Math.floor(viewport.height*.25)},
        }));
        const nose=await fishExtent(page);
        assert.ok(side>=viewport.width*.09&&side<=viewport.width*.14,`side width ${side}`);
        assert.ok(nose/side>=.15,`head-on width ${nose}/${side}`);
        metrics.push({size,name:'silhouette',side,nose,ratio:nose/side});
        console.log('PASS',size,'side / head-on',side,nose);
        const at=await read();
        assert.ok(Math.abs(at.state.poses[0].yaw+Math.PI/2)<1e-9);
        await page.evaluate(()=>window.__aoCa.advance(.35));
      }
      await shot(name);
      const info=await read();
      assert.equal(info.glError,0);
      assert.ok(info.perf.drawCalls<=7&&info.perf.fishShown>0);
      assert.deepEqual(info.state.failed,[]);
      if(name==='bubbles') {
        assert.ok(info.state.bubbles.count>0 && info.state.bubbles.count<=220);
        assert.ok(info.state.bubbles.spawned/5>=12 && info.state.bubbles.spawned/5<=18);
      }
      assert.deepEqual(errors,[]);
      metrics.push({size,name,drawCalls:info.perf.drawCalls,fish:info.perf.fishShown,
        renderer:info.perf.renderer,workerMs:info.state.workerMs,
        bubbles:info.state.bubbles,poses:info.state.poses.map(p=>({id:p.id,depth:p.depth,length:p.length,y:p.y,yaw:p.yaw}))});
      console.log('PASS',size,name,info.perf.drawCalls+' draws',info.perf.fishShown+' fish',Math.max(...info.state.workerMs).toFixed(2)+' ms worker max');
    }
    if(viewport.width===1366 && process.argv.includes('--record')) {
      for(const [name,seconds,lead] of [['wide',10,0],['uturn',2,0],['bubbles',10,5]]) {
        const {clip,metadata,frameCount}=await recordPond(page,viewport.width,viewport.height,{scenario:name,seconds,lead});
        await writeFile(new URL('v3-'+name+'-'+seconds+'s.webm',output),clip);
        console.log('PASS',name,'clip',metadata.duration.toFixed(2)+' s',frameCount+' frames');
      }
    }
    await page.close();
    const fallback=await browser.newPage({viewport,deviceScaleFactor:2});
    await loginMock(fallback,app.base,'#/chat?golden=1&seed=42&tier=tinh');
    const canvas=fallback.locator('[data-ao-renderer=canvas2d]');
    await canvas.waitFor();
    await fallback.addStyleTag({content:'.hn-fab-cluster { visibility:hidden !important }'});
    await fallback.locator('[data-ao-bg]').evaluate(img=>img.decode());
    await fallback.waitForFunction(()=>{
      const canvas=document.querySelector('[data-ao-renderer=canvas2d]');
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let filled=0;
      for(let i=3;i<data.length;i+=64) if(data[i]>200&&++filled>=80) return true;
      return false;
    },undefined,{timeout:15000,polling:250});
    const mode=await canvas.evaluate(node=>({width:node.width,height:node.height,dpr:devicePixelRatio,background:
      document.querySelector('[data-ao-bg]').currentSrc.endsWith('/art/be/hang-da-v2.png')}));
    assert.equal(mode.width,viewport.width);
    assert.equal(mode.height,viewport.height);
    assert.equal(mode.dpr,2);
    assert.ok(mode.background);
    await writeFile(new URL('p4-'+size+'-wide.png',output),await fallback.screenshot({scale:'css'}));
    metrics.push({size,name:'static',...mode});
    console.log('PASS',size,'Canvas2D, DPR clamped at 1, Hang Da DOM background');
    await fallback.close();
  }
} finally {
  await writeFile(new URL('p2-checks.json',output),JSON.stringify(metrics,null,2));
  await browser.close();await app.close();
}
