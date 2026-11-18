import assert from 'node:assert/strict';
import { appendFile,mkdir,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { loginMock,output,serveApp } from './ao-ca/browser.mjs';

await mkdir(output,{recursive:true});
const log=new URL('may3-v3-perf.ndjson',output);
await writeFile(log,'');
const app=await serveApp();
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-features=CalculateNativeWinOcclusion']});
const sizes=[[1366,768,300],[1920,1080,60]];
const rows=[];
const savetext=async row=>{rows.push(row);await appendFile(log,JSON.stringify(row)+'\n');};
try {
  for(const [width,height,seconds] of sizes) {
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    const route='#/chat?perf=1&tier=auto&fixtures=1&fish=24&seed=42';
    await loginMock(page,app.base,route);
    await page.bringToFront();
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});
    await page.waitForFunction(()=>window.__aoCa?.perf().fishShown===24,undefined,{timeout:40000});
    const size=width+'x'+height;
    await page.waitForFunction(()=>window.__aoCa?.perf().fps>25,undefined,{timeout:30000});
    const started=await page.evaluate(()=>({v:[innerWidth,innerHeight],perf:window.__aoCa.perf()}));
    assert.deepEqual(started.v,[width,height]);
    assert.match(started.perf.renderer,/UHD Graphics 610/);
    await savetext({kind:'start',size,seconds,at:new Date().toISOString(),...started});
    // The HUD's window is four seconds. Space the samples to limit overlap.
    const start=Date.now();
    for(let tick=4;tick<=seconds;tick+=4) {
      await new Promise(done=>setTimeout(done,Math.max(0,start+tick*1000-Date.now())));
      const reading=await page.evaluate(()=>({perf:window.__aoCa?.perf()??null,visibility:document.visibilityState,
        rendererMode:document.querySelector('[data-fish-tank]')?.dataset.aoRenderer,v:[innerWidth,innerHeight]}));
      assert.deepEqual(reading.v,[width,height]);
      assert.equal(reading.visibility,'visible');
      await savetext({kind:'sample',size,tick,...reading});
      if(tick%20===0)console.log(size,tick,reading.perf?.tier??reading.rendererMode,reading.perf?.fishShown,reading.perf?.dropPct);
    }
    console.log('DONE',size);
    await page.close();
  }
  await savetext({kind:'done'});
} finally {
  await browser.close();await app.close();
  await writeFile(new URL('may3-v3-perf.json',output),JSON.stringify(rows,null,2));
}
