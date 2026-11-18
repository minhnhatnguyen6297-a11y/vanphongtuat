import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { output } from './ao-ca/browser.mjs';

const images=[
  {file:'fish-headon-before.png',label:'Ao V3 trước sửa · 90°',crop:[586,384,191,192]},
  {file:'fish-headon-after-geometry.png',label:'Ao V3 sau sửa · 90°'},
  {file:'fish-angle-after-geometry.png',label:'Ao V3 sau sửa · góc 3/4',crop:[581,385,212,160]},
  {file:'reference/goc-ca-phong-sang.jpg',label:'Ảnh tham chiếu Minh gửi · góc 3/4',crop:[320,106,425,358]},
];
const entries=await Promise.all(images.map(async row=>({...row,src:'data:image/'+
  (row.file.endsWith('.jpg')?'jpeg':'png')+';base64,'+(await readFile(new URL(row.file,output))).toString('base64')})));
const browser=await chromium.launch({channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:1000,height:850},deviceScaleFactor:1});
  await page.setContent(`<style>
    *{box-sizing:border-box}body{margin:0;background:#092637;font:16px system-ui;color:#f7fff9;padding:15px}
    #grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    figure{margin:0;border:1px solid #788b94;border-radius:5px;overflow:hidden;background:#06222d}
    figcaption{height:32px;padding:5px 12px}canvas{display:block;width:100%;height:350px;object-fit:contain}
    </style><main id="grid"></main>`);
  await page.evaluate(async list=>{
    for(const row of list) {
      const image=new Image();image.src=row.src;await image.decode();
      const [x,y,w,h]=row.crop??[0,0,image.width,image.height];
      const figure=document.createElement('figure');
      const caption=document.createElement('figcaption');caption.textContent=row.label;figure.append(caption);
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);
      figure.append(canvas);document.querySelector('#grid').append(figure);
    }
  },entries);
  await page.locator('#grid').screenshot({path:fileURLToPath(new URL('doi-chieu-do-day-ca.png',output))});
} finally {await browser.close();}
