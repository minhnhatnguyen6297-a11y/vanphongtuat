import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { loginMock,output,serveApp } from './ao-ca/browser.mjs';

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
    for(const name of ['wide','closeup','uturn','depth']) {
      await page.evaluate(name=>window.__aoCa.scenario(name),name);
      if(name==='uturn') {
        await shot('uturn-t0');
        // Advance in nearest fixed ticks: 0.35 and 0.7 seconds.
        await page.evaluate(()=>window.__aoCa.advance(.35));
        await shot('uturn-t035');
        const at=await read();
        assert.ok(Math.abs(at.state.poses[0].yaw+Math.PI/2)<1e-9);
        await page.evaluate(()=>window.__aoCa.advance(.35));
      }
      await shot(name);
      const info=await read();
      assert.equal(info.glError,0);
      assert.ok(info.perf.drawCalls<=7&&info.perf.fishShown>0);
      assert.deepEqual(info.state.failed,[]);
      assert.deepEqual(errors,[]);
      metrics.push({size,name,drawCalls:info.perf.drawCalls,fish:info.perf.fishShown,
        renderer:info.perf.renderer,workerMs:info.state.workerMs,
        poses:info.state.poses.map(p=>({id:p.id,depth:p.depth,length:p.length,y:p.y,yaw:p.yaw}))});
      console.log('PASS',size,name,info.perf.drawCalls+' draws',info.perf.fishShown+' fish',Math.max(...info.state.workerMs).toFixed(2)+' ms worker max');
    }
    await page.close();
  }
} finally {
  await writeFile(new URL('p2-checks.json',output),JSON.stringify(metrics,null,2));
  await browser.close();await app.close();
}
