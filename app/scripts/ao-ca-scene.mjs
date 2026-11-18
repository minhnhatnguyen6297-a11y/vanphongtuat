import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const app = new URL('../', import.meta.url);
const output = new URL('test-results/ao-ca/', app);
const art = new URL('public/art/be/', app);
const gridOnly = process.argv.includes('--grid');
await mkdir(output, { recursive: true });
const image = 'data:image/png;base64,' + (await readFile(new URL('hang-da-v2.png', art))).toString('base64');
const calibration = gridOnly ? null : JSON.parse(await readFile(new URL('src/client/be/gl/scene-calib.json', app), 'utf8'));
const regions = gridOnly ? [] : JSON.parse(await readFile(new URL('ao-ca/scene-regions.json', import.meta.url), 'utf8'));

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  const images = await page.evaluate(async ({ image, calibration, regions }) => {
    const bg = new Image();
    bg.src = image;
    await bg.decode();
    const { naturalWidth: width, naturalHeight: height } = bg;
    const layer = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return {canvas, ctx: canvas.getContext('2d', {willReadFrequently: true})};
    };
    const png = canvas => canvas.toDataURL('image/png').split(',')[1];
    const grid = layer();
    grid.ctx.drawImage(bg, 0, 0);
    grid.ctx.font = 'bold 17px monospace';
    for (let i = 1; i < 20; i++) {
      const fraction = i / 20;
      const x = fraction * width, y = fraction * height;
      grid.ctx.strokeStyle = i % 2 === 0 ? '#fffad0ad' : '#a9f5ee70';
      grid.ctx.beginPath();
      grid.ctx.moveTo(x, 0); grid.ctx.lineTo(x, height);
      grid.ctx.moveTo(0, y); grid.ctx.lineTo(width, y);
      grid.ctx.stroke();
      grid.ctx.fillStyle = '#13110f';
      grid.ctx.fillRect(x + 1, 0, 43, 21);
      grid.ctx.fillRect(0, y + 1, 43, 21);
      grid.ctx.fillStyle = '#ffffff';
      grid.ctx.fillText(fraction.toFixed(2), x + 2, 16);
      grid.ctx.fillText(fraction.toFixed(2), 1, y + 18);
    }
    const result = {'grid.png': png(grid.canvas)};
    if (!calibration) return result;
    if (width !== calibration.image[0] || height !== calibration.image[1]) throw new Error('Unexpected Hang Da size');

    const rocks = layer();
    rocks.ctx.fillStyle = '#fff';
    rocks.ctx.fillRect(0, 0, width, height);
    // Rasterization anti-aliases the traced edge in source image pixels.
    for (const {depth, points} of [...regions].sort((a,b) => b.depth-a.depth)) {
      const value = Math.round(254 * depth);
      rocks.ctx.fillStyle = 'rgb(' + [value,value,value].join(',') + ')';
      rocks.ctx.beginPath();
      points.forEach(([u,v], index) => rocks.ctx[index ? 'lineTo' : 'moveTo'](u*width,v*height));
      rocks.ctx.closePath();
      rocks.ctx.fill();
    }
    const rData = rocks.ctx.getImageData(0, 0, width, height).data;
    const source = layer();
    source.ctx.drawImage(bg, 0, 0);
    const pixels = source.ctx.getImageData(0, 0, width, height).data;
    const sand = layer();
    const threshold = sand.ctx.createImageData(width, height);
    for (let y = Math.ceil(calibration.horizonV * height); y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const luma = (0.2126*pixels[i] + 0.7152*pixels[i+1] + 0.0722*pixels[i+2]) / 255;
        if (rData[i] === 255 && luma >= 0.55) threshold.data[i+3] = 255;
      }
    }
    // Leave a four-source-pixel guard inside G against canvas upscaling.
    const interior = sand.ctx.createImageData(width, height);
    const guard = 4;
    for (let y = guard; y < height-guard; y++) for (let x = guard; x < width-guard; x++) {
      if (!threshold.data[(y*width+x)*4+3]) continue;
      let solid = true;
      for (let dy=-guard; dy<=guard && solid; dy++) for (let dx=-guard; dx<=guard; dx++) {
        if (!threshold.data[((y+dy)*width+x+dx)*4+3]) { solid=false; break; }
      }
      if (solid) interior.data[(y*width+x)*4+3] = 255;
    }
    sand.ctx.putImageData(interior, 0, 0);
    const feather = layer();
    feather.ctx.filter = 'blur(2px)';
    feather.ctx.drawImage(sand.canvas, 0, 0);
    const gData = feather.ctx.getImageData(0, 0, width, height).data;
    const map = layer();
    const data = map.ctx.createImageData(width, height);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = rData[i];
      const gain = interior.data[i+3] ? Math.floor(gData[i+3]*254/255) : 0;
      data.data[i+1] = threshold.data[i+3] ? 1 + gain : 0;
      // Opaque alpha preserves raw data bytes when the PNG is decoded.
      data.data[i+3] = 255;
    }
    map.ctx.putImageData(data, 0, 0);
    result['scene-map.png'] = png(map.canvas);
    for (const [channel, index, color] of [['R',0,[245,83,87]], ['G',1,[49,248,145]]]) {
      const overlay = layer();
      const tint = overlay.ctx.createImageData(width, height);
      for (let i = 0; i < tint.data.length; i += 4) {
        const value = data.data[i+index];
        if (index === 0 && value === 255) continue;
        tint.data.set(color, i);
        tint.data[i+3] = index === 0 ? Math.round(127*(1-0.5*value/254)) : Math.round(value/2);
      }
      overlay.ctx.putImageData(tint, 0, 0);
      overlay.ctx.globalCompositeOperation = 'destination-over';
      overlay.ctx.drawImage(bg, 0, 0);
      result['mask-' + channel + '.png'] = png(overlay.canvas);
    }
    return result;
  }, { image, calibration, regions });
  for (const [name, value] of Object.entries(images)) {
    await writeFile(new URL(name, name === 'scene-map.png' ? art : output), Buffer.from(value, 'base64'));
    console.log(name);
  }
} finally {
  await browser.close();
}
