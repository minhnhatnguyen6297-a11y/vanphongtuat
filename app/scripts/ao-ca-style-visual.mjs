import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { loginMock,output,serveApp } from './ao-ca/browser.mjs';

await mkdir(output,{recursive:true});
const app=await serveApp();
const browser=await chromium.launch({channel:'chrome',headless:false});
try {
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  await loginMock(page,app.base,'#/chat?golden=1&seed=42&tier=cao');
  await page.waitForFunction(()=>{
    const api=window.__aoCa;
    if(!api?.state) return false;
    api.advance(0);
    return api.perf().fishShown===8;
  },undefined,{timeout:30000,polling:100});
  const menu=page.locator('[data-fish-fab=menu]');
  const setLook=async look=>{
    await menu.click();
    const choice=page.locator('[data-fish-look='+look+']');
    await choice.click();
    assert.equal(await choice.getAttribute('aria-pressed'),'true');
    assert.equal(await page.evaluate(()=>localStorage.getItem('hng_ao_look')),look);
    await menu.click();
    await page.evaluate(()=>window.__aoCa.advance(0));
  };
  await page.evaluate(()=>window.__aoCa.scenario('closeup'));
  const pose=()=>page.evaluate(()=>window.__aoCa.state().scene.poses);
  await setLook('form');
  const formPose=await pose();
  const trim={x:482,y:284,width:401,height:322};
  const form=await page.screenshot({clip:trim});
  await writeFile(new URL('style-co-khoi.png',output),form);
  await setLook('ink');
  const inkPose=await pose();
  const ink=await page.screenshot({clip:trim});
  await writeFile(new URL('style-net-ve.png',output),ink);
  assert.deepEqual(formPose,inkPose);
  assert.ok(!ink.equals(form));
  console.log('PASS Nét vẽ / Có khối: đổi màu và ánh sáng, giữ đúng pose');

  await page.locator('[data-fish-fab=draw]').click();
  assert.equal(await page.locator('[data-fish-swatch]').count(),16);
  const blur=page.locator('[data-fish-blur-row]');
  assert.equal(await blur.isVisible(),false);
  await page.locator('[data-fish-tool=blur]').click();
  assert.equal(await blur.isVisible(),true);
  const custom=page.locator('[data-fish-custom-color]');
  await custom.fill('#dd5787');
  assert.equal(await page.locator('[data-fish-tool=pen]').getAttribute('aria-pressed'),'true');
  assert.equal(await blur.isVisible(),false);
  await page.locator('[data-fish-pattern=chep]').click();
  await page.waitForFunction(()=>document.querySelector('[data-fish-pattern=chep]')?.getAttribute('aria-pressed')==='true');
  const pad=page.locator('[data-fish-pad]');
  const rect=await pad.boundingBox();
  await page.mouse.move(rect.x+rect.width*.62,rect.y+rect.height*.48);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width*.66,rect.y+rect.height*.51,{steps:4});
  await page.mouse.up();
  const px=await pad.evaluate(canvas=>[...canvas.getContext('2d').getImageData(306,120,1,1).data]);
  assert.ok(px[0]>150 && px[1]<145 && px[2]>90);
  await page.locator('[data-fish-undo]').click();
  assert.notDeepEqual(await pad.evaluate(canvas=>[...canvas.getContext('2d').getImageData(306,120,1,1).data]),px);
  await page.locator('[data-fish-swatch="#13110F"]').click();
  assert.equal(await custom.inputValue(),'#13110f');
  await page.locator('[data-fish-tool=blur]').click();
  await writeFile(new URL('editor-1366x768.png',output),await page.screenshot());
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-fish-pop]').isVisible(),false);
  console.log('PASS Bảng 16 màu, màu tùy chọn, cọ, hoàn tác, làm mờ, Esc');
  const compare=await browser.newPage({viewport:{width:854,height:390}});
  await compare.setContent(`<style>
    body{margin:0;padding:12px;background:#092634;color:#f7faff;font:16px system-ui}
    main{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    figure{margin:0;padding:5px;background:#102f3c;border-radius:8px}
    figcaption{padding:4px 6px 8px}img{width:100%;display:block;border-radius:4px}
    </style><main>
    <figure><figcaption>Nét vẽ · mặc định</figcaption><img src="data:image/png;base64,${ink.toString('base64')}" alt="Nét vẽ"></figure>
    <figure><figcaption>Có khối</figcaption><img src="data:image/png;base64,${form.toString('base64')}" alt="Có khối"></figure>
    </main>`);
  await writeFile(new URL('so-sanh-phong-cach-ca.png',output),await compare.locator('main').screenshot());

} finally {await browser.close();await app.close();}
