import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { appDir, loginMock, serveApp } from './ao-ca/browser.mjs';

const out = new URL('tests/fixtures/ao-ca/', appDir);
const files = [
  {name:'round', x:143,y:66,length:178,height:104,color:'#8BC2C7'},
  {name:'long', x:115,y:110,length:254,height:26,color:'#7A8FA3'},
  {name:'hole', x:132,y:82,length:202,height:76,color:'#C4A484',hole:true},
  {name:'detached-fin', x:145,y:92,length:192,height:64,color:'#4A5560',fin:true},
  {name:'soft-edge', x:130,y:86,length:207,height:67,color:'#F3B48C',blur:true},
  {name:'black', x:132,y:92,length:210,height:65,color:'#080808'},
  {name:'white', x:135,y:86,length:202,height:74,color:'#FFFFFF'},
  {name:'tiny', x:217,y:110,length:38,height:18,color:'#8BC2C7'},
];
let rng = 42;
function noise() {
  rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
  return (rng / 4294967296 - 0.5) * 1.5;
}
await mkdir(out, {recursive:true});
const app = await serveApp();
let browser;
try {
  browser = await chromium.launch({channel:'chrome'});
  const page = await browser.newPage({viewport:{width:1366,height:768}});
  await loginMock(page, app.base);
  await page.locator('[data-fish-fab=draw]').click();
  const canvas = page.locator('[data-fish-pad]');
  const rect = await canvas.boundingBox();
  assert.ok(rect);
  const size = async value => page.locator('[data-fish-size]').evaluate((slider, n) => {
    slider.value = String(n);
    slider.dispatchEvent(new Event('input', {bubbles:true}));
  }, value);
  // Use the real swatch handler for fixture colors outside the visible palette.
  const color = async value => {
    const swatches = page.locator('[data-fish-swatch]');
    const swatch = swatches.first();
    await swatch.evaluate((button, next) => {
      const last = button.dataset.fishSwatch;
      button.dataset.fishSwatch = next;
      button.click();
      button.dataset.fishSwatch = last;
    }, value);
  };
  const tool = name => page.locator('[data-fish-tool='+name+']').click();
  const coords = (x,y) => [rect.x + x*rect.width/480, rect.y + y*rect.height/240];
  const stroke = async points => {
    await page.mouse.move(...coords(...points[0]));
    await page.mouse.down();
    for (const [x,y] of points.slice(1)) await page.mouse.move(...coords(x + noise(), y + noise()));
    await page.mouse.up();
  };

  for (const f of files) {
    await page.locator('[data-fish-clear]').click();
    await tool('pen');
    await color(f.color);
    const y = f.y + f.height/2;
    const tail = f.length * 0.23;
    await size(f.name === 'tiny' ? 5 : 12);
    await stroke([[f.x+8,y-tail*0.47], [f.x+tail,y], [f.x+8,y+tail*0.47], [f.x+8,y-tail*0.47]]);
    await size(f.name === 'tiny' ? 9 : 20);
    const left = f.x + tail*0.65;
    const right = f.x+f.length;
    for (let d = -0.84; d <= 0.85; d += f.name === 'tiny' ? 0.42 : 0.30) {
      const trim = (1-Math.sqrt(1-d*d))*(right-left)/2;
      await stroke([[left+trim, y+d*f.height/2], [right-trim, y+d*f.height/2]]);
    }
    if (f.hole) {
      await tool('eraser'); await size(30); await stroke([[left+55,y],[left+76,y]]);
      await tool('pen');
    }
    if (f.fin) {
      await size(9); await stroke([[left+25,f.y-26],[left+53,f.y-42],[left+70,f.y-24]]);
    }
    if (f.blur) {
      await tool('blur'); await size(40);
      await stroke([[left,y-25],[left+35,y-32],[right-30,y-32],[right,y-15],[right,y+16]]);
      await tool('pen');
    }
    await color(f.color === '#080808' ? '#FFFFFF' : '#080808');
    await size(f.name === 'tiny' ? 4 : 10);
    await stroke([[right-f.length*0.17, y-f.height*0.10]]);
    const png = await page.evaluate(() => localStorage.getItem('hng_be_pad_v1'));
    assert.ok(png?.startsWith('data:image/png;base64,'));
    const bytes = Buffer.from(png.split(',')[1],'base64');
    assert.equal(bytes.readUInt32BE(16),480);
    assert.equal(bytes.readUInt32BE(20),240);
    await writeFile(new URL(f.name+'.png', out),bytes);
    console.log(f.name+'.png', bytes.length);
  }
} finally {
  await browser?.close();
  await app.close();
}
