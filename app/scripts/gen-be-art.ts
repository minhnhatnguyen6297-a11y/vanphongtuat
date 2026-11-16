/**
 * Nướng lớp nền bể một lần. Máy chủ chỉ phục vụ file đã băm, không vẽ lại.
 * Chạy: npx tsx scripts/gen-be-art.ts
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from '../src/shared/be-png.ts';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../public/art/be');

type Img = Buffer;

function img(w: number, h: number): Img {
  return Buffer.alloc(w * h * 4);
}

function blend(px: Img, w: number, h: number, x: number, y: number, r: number, g: number, b: number, a: number) {
  if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
  const i = (y * w + x) * 4;
  const sa = Math.min(1, a / 255);
  const da = px[i + 3] / 255;
  const out = sa + da * (1 - sa);
  if (out <= 0) return;
  px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / out);
  px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / out);
  px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / out);
  px[i + 3] = Math.round(out * 255);
}

function fill(px: Img, w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fn(x, y);
      const i = (y * w + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }
}

function disc(px: Img, w: number, h: number, cx: number, cy: number, rx: number, ry: number, col: [number, number, number], alpha: number) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(w - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d >= 1) continue;
      const a = alpha * (1 - d) ** 0.6;
      blend(px, w, h, x, y, col[0], col[1], col[2], a);
    }
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function paintRoom(w: number, h: number): Img {
  const px = img(w, h);
  fill(px, w, h, (_x, y) => {
    const t = y / h;
    return [lerp(246, 214, t), lerp(214, 176, t), lerp(184, 140, t), 255];
  });
  const wx = Math.floor(w * 0.18);
  const wy = Math.floor(h * 0.08);
  const ww = Math.floor(w * 0.64);
  const wh = Math.floor(h * 0.62);
  for (let y = wy; y < wy + wh; y++) {
    const t = (y - wy) / wh;
    for (let x = wx; x < wx + ww; x++) {
      const i = (y * w + x) * 4;
      px[i] = lerp(120, 246, t);
      px[i + 1] = lerp(190, 214, t);
      px[i + 2] = lerp(214, 170, t);
      px[i + 3] = 255;
    }
  }
  disc(px, w, h, wx + ww * 0.3, wy + wh * 0.28, 70, 36, [255, 255, 255], 90);
  disc(px, w, h, wx + ww * 0.62, wy + wh * 0.22, 90, 40, [255, 255, 255], 70);
  const frame = 10;
  for (let y = wy - frame; y < wy + wh + frame; y++) {
    for (let x = wx - frame; x < wx + ww + frame; x++) {
      const inside = x >= wx && x < wx + ww && y >= wy && y < wy + wh;
      if (inside) continue;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      px[i] = 92;
      px[i + 1] = 64;
      px[i + 2] = 48;
      px[i + 3] = 255;
    }
  }
  return px;
}

function paintWater(w: number, h: number): Img {
  const px = img(w, h);
  fill(px, w, h, (x, y) => {
    const t = y / h;
    const band = Math.sin(x * 0.02 + y * 0.05) * 8;
    const vign = Math.min(1, Math.hypot((x / w - 0.5) * 1.3, y / h - 0.45));
    const shade = 1 - Math.max(0, vign - 0.45) * 0.35;
    const r = (lerp(28, 10, t) + band) * shade;
    const g = (lerp(150, 70, t) + band * 0.4) * shade;
    const b = (lerp(158, 82, t)) * shade;
    return [r, g, b, 255];
  });
  disc(px, w, h, w * 0.3, h * 0.22, w * 0.22, h * 0.12, [170, 230, 220], 50);
  disc(px, w, h, w * 0.7, h * 0.4, w * 0.18, h * 0.1, [80, 180, 170], 40);
  return px;
}

function paintCaustics(n: number): Img {
  const px = img(n, n);
  for (let i = 0; i < 16; i++) {
    const cx = (i * 97) % n;
    const cy = (i * 53 + 20) % n;
    const rad = 16 + (i % 5) * 10;
    for (let y = -rad; y <= rad; y++) {
      for (let x = -rad; x <= rad; x++) {
        const d = Math.hypot(x, y) / rad;
        if (d >= 1) continue;
        const a = (1 - d) ** 2 * (i % 2 ? 110 : 60);
        const pxn = (cx + x + n) % n;
        const pyn = (cy + y + n) % n;
        blend(px, n, n, pxn, pyn, 230, 255, 246, a);
      }
    }
  }
  return px;
}

function paintRays(w: number, h: number): Img {
  const px = img(w, h);
  const shafts = [0.18, 0.38, 0.55, 0.74];
  for (const s of shafts) {
    for (let y = 0; y < h; y++) {
      const spread = 18 + y * 0.09;
      const cx = w * s + y * 0.12;
      const x0 = Math.max(0, Math.floor(cx - spread));
      const x1 = Math.min(w - 1, Math.ceil(cx + spread));
      for (let x = x0; x <= x1; x++) {
        const d = Math.abs(x - cx) / spread;
        const a = (1 - d * d) * (1 - y / h) * 80;
        blend(px, w, h, x, y, 255, 244, 210, a);
      }
    }
  }
  return px;
}

function paintSand(w: number, h: number, tone: number): Img {
  const px = img(w, h);
  const base: [number, number, number][] = [
    [228, 194, 122],
    [240, 221, 176],
    [186, 140, 78],
  ];
  const [r, g, b] = base[tone];
  fill(px, w, h, (x, y) => {
    const grain = ((x * 13 + y * 7) % 11) - 5;
    const ridge = Math.sin(x * 0.05 + tone) * 6;
    return [r + grain + ridge, g + grain, b + grain * 0.4, 255];
  });
  for (let i = 0; i < 40; i++) {
    disc(px, w, h, (i * 47) % w, 8 + ((i * 19) % (h - 10)), 4 + (i % 3), 2, [120, 90, 50], 80);
  }
  return px;
}

function paintRocks(w: number, h: number, variant: number): Img {
  const px = img(w, h);
  const cols: [number, number, number][] = [
    [110, 102, 96],
    [78, 86, 92],
    [130, 108, 90],
  ];
  const spots = [
    [0.38, 0.62, 0.28, 0.32],
    [0.62, 0.7, 0.22, 0.24],
    [0.5, 0.48, 0.16, 0.16],
  ];
  spots.forEach((s, i) => {
    const col = cols[(variant + i) % 3];
    disc(px, w, h, s[0] * w, s[1] * h, s[2] * w, s[3] * h, col, 230);
    disc(px, w, h, s[0] * w - 8, s[1] * h - 10, s[2] * w * 0.45, s[3] * h * 0.35, [210, 206, 198], 90);
  });
  return px;
}

function paintWood(w: number, h: number): Img {
  const px = img(w, h);
  for (let i = 0; i < 28; i++) {
    const t = i / 27;
    const x = w * (0.15 + t * 0.7);
    const y = h * (0.75 - Math.sin(t * Math.PI) * 0.45);
    disc(px, w, h, x, y, 16 + Math.sin(t * 6) * 4, 12, [92, 58, 36], 230);
    disc(px, w, h, x, y - 4, 7, 4, [166, 122, 78], 80);
  }
  return px;
}

function paintKelp(w: number, h: number): Img {
  const px = img(w, h);
  for (let s = 0; s < 5; s++) {
    const x0 = w * (0.12 + s * 0.16);
    const col: [number, number, number] = s % 2 ? [40, 140, 90] : [18, 100, 70];
    for (let y = Math.floor(h * 0.15); y < h; y++) {
      const t = y / h;
      const x = x0 + Math.sin(y * 0.03 + s) * (10 + s * 2);
      const rad = 4 + (1 - t) * 7;
      for (let dx = -rad; dx <= rad; dx++) {
        const a = (1 - Math.abs(dx) / rad) * 200;
        blend(px, w, h, Math.round(x + dx), y, col[0], col[1], col[2], a);
      }
    }
  }
  return px;
}

function paintBubbles(w: number, h: number): Img {
  const px = img(w, h);
  for (let i = 0; i < 4; i++) {
    const cx = i * 32 + 16;
    const cy = 16;
    const rad = 6 + i * 2;
    for (let y = -rad; y <= rad; y++) {
      for (let x = -rad; x <= rad; x++) {
        const d = Math.hypot(x, y);
        if (d > rad || d < rad - 1.6) continue;
        blend(px, w, h, cx + x, cy + y, 255, 255, 255, 180);
      }
    }
    blend(px, w, h, cx - 3, cy - 3, 255, 255, 255, 200);
  }
  return px;
}

function writeLayer(name: string, px: Img, w: number, h: number): string {
  const png = encodePng(w, h, px);
  const hash = createHash('sha256').update(png).digest('hex').slice(0, 12);
  const file = `${name}.${hash}.png`;
  writeFileSync(join(outDir, file), png);
  console.log(file, png.length);
  return `/art/be/${file}`;
}

mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) {
  if (f.endsWith('.png') || f === 'manifest.json') rmSync(join(outDir, f));
}

const manifest = {
  version: 1,
  layers: {
    room: writeLayer('room', paintRoom(960, 540), 960, 540),
    water: writeLayer('water', paintWater(960, 540), 960, 540),
    caustics: writeLayer('caustics', paintCaustics(256), 256, 256),
    rays: writeLayer('rays', paintRays(480, 640), 480, 640),
    kelp: writeLayer('kelp', paintKelp(360, 540), 360, 540),
    sand: [0, 1, 2].map((n) => writeLayer(`sand-${n}`, paintSand(960, 140, n), 960, 140)),
    rocks: [0, 1, 2].map((n) => writeLayer(`rocks-${n}`, paintRocks(320, 200, n), 320, 200)),
    wood: writeLayer('wood', paintWood(280, 200), 280, 200),
    bubbles: writeLayer('bubbles', paintBubbles(128, 32), 128, 32),
  },
};

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('manifest', join(outDir, 'manifest.json'));
