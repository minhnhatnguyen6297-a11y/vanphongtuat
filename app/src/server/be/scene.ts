/** Lớp nền vẽ một lần. Hàm nhiễu cố định để hash ảnh không đổi giữa các lần chạy. */

export type RgbaLayer = {
  w: number;
  h: number;
  rgba: Uint8Array;
  frames?: number;
  fw?: number;
  fh?: number;
};

export function paintScene(name: string): RgbaLayer {
  switch (name) {
    case 'ngay':
      return backdrop('ngay');
    case 'chieu':
      return backdrop('chieu');
    case 'dem':
      return backdrop('dem');
    case 'sand-vang':
      return sand('#e6c27a', '#c49a45', '#f3e0b0');
    case 'sand-trang':
      return sand('#efe6d4', '#cfc3ae', '#f7f1e6');
    case 'sand-hong':
      return sand('#e7b7a2', '#c48470', '#f6d5c8');
    case 'sand-xam':
      return sand('#b7b1a6', '#8d877e', '#d5d0c8');
    case 'rock':
      return rock();
    case 'wood':
      return wood();
    case 'caustics':
      return caustics();
    case 'rays':
      return rays();
    case 'bubble':
      return bubble();
    case 'pellet':
      return pellet();
    default:
      return sand('#e6c27a', '#c49a45', '#f3e0b0');
  }
}

export const SCENE_NAMES = [
  'ngay', 'chieu', 'dem',
  'sand-vang', 'sand-trang', 'sand-hong', 'sand-xam',
  'rock', 'wood', 'caustics', 'rays', 'bubble', 'pellet',
] as const;

function hash2(x: number, y: number, salt: number): number {
  let n = (x * 374761393 + y * 668265263 + salt * 144269) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function layer(w: number, h: number): { px: Uint8Array; w: number; h: number } {
  return { px: new Uint8Array(w * h * 4), w, h };
}

function put(px: Uint8Array, w: number, h: number, x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
  const i = (y * w + x) * 4;
  if (a >= 255 || px[i + 3] === 0) {
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
    return;
  }
  const sa = a / 255;
  const da = px[i + 3] / 255;
  const out = sa + da * (1 - sa);
  px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / out);
  px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / out);
  px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / out);
  px[i + 3] = Math.round(out * 255);
}

function fill(px: Uint8Array, w: number, h: number, r: number, g: number, b: number) {
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = r;
    px[i * 4 + 1] = g;
    px[i * 4 + 2] = b;
    px[i * 4 + 3] = 255;
  }
}

function ellipse(
  px: Uint8Array, w: number, h: number,
  cx: number, cy: number, rx: number, ry: number,
  r: number, g: number, b: number, a = 255,
) {
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(h - 1, Math.ceil(cy + ry));
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(w - 1, Math.ceil(cx + rx));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) put(px, w, h, x, y, r, g, b, a);
    }
  }
}

function backdrop(bucket: 'ngay' | 'chieu' | 'dem'): RgbaLayer {
  const w = 480;
  const h = 270;
  const { px } = layer(w, h);
  if (bucket === 'dem') fill(px, w, h, 28, 36, 56);
  else if (bucket === 'chieu') fill(px, w, h, 232, 196, 150);
  else fill(px, w, h, 244, 226, 196);

  const skyTop = bucket === 'dem' ? [14, 22, 48] : bucket === 'chieu' ? [232, 140, 78] : [126, 190, 232];
  const skyBot = bucket === 'dem' ? [28, 40, 72] : bucket === 'chieu' ? [255, 196, 130] : [214, 236, 250];
  for (let y = 28; y < 150; y++) {
    const t = (y - 28) / 122;
    for (let x = 36; x < 210; x++) {
      put(
        px, w, h, x, y,
        Math.round(skyTop[0] + (skyBot[0] - skyTop[0]) * t),
        Math.round(skyTop[1] + (skyBot[1] - skyTop[1]) * t),
        Math.round(skyTop[2] + (skyBot[2] - skyTop[2]) * t),
      );
    }
  }
  if (bucket === 'dem') {
    ellipse(px, w, h, 150, 70, 14, 14, 236, 230, 200);
    for (let i = 0; i < 18; i++) {
      const x = 40 + Math.floor(hash2(i, 3, 9) * 160);
      const y = 36 + Math.floor(hash2(i, 8, 2) * 90);
      put(px, w, h, x, y, 240, 240, 230);
    }
    ellipse(px, w, h, 400, 80, 70, 50, 255, 176, 90, 90);
  } else {
    ellipse(px, w, h, 150, 118, 70, 16, bucket === 'chieu' ? 120 : 90, bucket === 'chieu' ? 150 : 140, 90);
    ellipse(px, w, h, 90, 124, 40, 10, 70, 120, 70);
  }
  // khung cửa
  for (let x = 30; x < 216; x++) {
    for (let t = 0; t < 8; t++) {
      put(px, w, h, x, 22 + t, 90, 58, 40);
      put(px, w, h, x, 148 + t, 90, 58, 40);
    }
  }
  for (let y = 22; y < 156; y++) {
    for (let t = 0; t < 8; t++) {
      put(px, w, h, 30 + t, y, 90, 58, 40);
      put(px, w, h, 208 + t, y, 90, 58, 40);
    }
  }
  // sàn
  for (let y = 230; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = hash2(x, y, 4);
      const shade = bucket === 'dem' ? 40 : 20;
      put(px, w, h, x, y, 196 - shade + Math.floor(n * 12), 164 - shade, 120 - Math.floor(shade / 2));
    }
  }
  return { w, h, rgba: px };
}

function sand(base: string, dark: string, lip: string): RgbaLayer {
  const w = 480;
  const h = 72;
  const { px } = layer(w, h);
  const b = hex(base);
  const d = hex(dark);
  const l = hex(lip);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = hash2(x, y, 11);
      const col = y < 8 ? l : n > 0.86 ? d : b;
      const j = n > 0.93 ? -18 : 0;
      put(px, w, h, x, y, clamp8(col[0] + j), clamp8(col[1] + j), clamp8(col[2] + j));
    }
  }
  return { w, h, rgba: px };
}

function rock(): RgbaLayer {
  const w = 96;
  const h = 64;
  const { px } = layer(w, h);
  ellipse(px, w, h, 40, 40, 32, 22, 92, 86, 78);
  ellipse(px, w, h, 62, 36, 24, 18, 74, 68, 62);
  ellipse(px, w, h, 34, 32, 14, 8, 140, 134, 124, 180);
  return { w, h, rgba: px };
}

function wood(): RgbaLayer {
  const w = 150;
  const h = 48;
  const { px } = layer(w, h);
  for (let i = 0; i < 140; i++) {
    const x = 6 + i;
    const y = 24 + Math.sin(i / 22) * 10;
    ellipse(px, w, h, x, y, 7, 5, 122, 74, 42);
    ellipse(px, w, h, x, y - 2, 3, 2, 166, 116, 72, 200);
  }
  return { w, h, rgba: px };
}

function caustics(): RgbaLayer {
  const fw = 96;
  const fh = 96;
  const frames = 6;
  const w = fw * frames;
  const h = fh;
  const { px } = layer(w, h);
  for (let f = 0; f < frames; f++) {
    const phase = (f / frames) * Math.PI * 2;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const fx = (2 * Math.PI * 3) / fw;
        const fy = (2 * Math.PI * 2) / fh;
        const v =
          Math.sin(x * fx + phase) * Math.sin(y * fy + phase * 1.3) +
          0.65 * Math.sin((x + y) * fx * 0.7 + phase * 2);
        const light = (v + 1.6) / 3.2;
        if (light < 0.62) continue;
        const a = Math.round((light - 0.62) * 520);
        put(px, w, h, f * fw + x, y, 255, 255, 255, Math.max(0, Math.min(180, a)));
      }
    }
  }
  return { w, h, rgba: px, frames, fw, fh };
}

function rays(): RgbaLayer {
  const w = 160;
  const h = 280;
  const { px } = layer(w, h);
  for (let y = 0; y < h; y++) {
    const fade = 1 - y / h;
    for (let x = 0; x < w; x++) {
      const band = 0.5 + 0.5 * Math.sin((x / w) * Math.PI * 4);
      const a = Math.round(band * band * fade * 150);
      if (a < 8) continue;
      put(px, w, h, x, y, 255, 236, 190, a);
    }
  }
  return { w, h, rgba: px };
}

function bubble(): RgbaLayer {
  const w = 32;
  const h = 32;
  const { px } = layer(w, h);
  const cx = 16;
  const cy = 16;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 13) continue;
      if (d > 10) put(px, w, h, x, y, 255, 255, 255, 200);
      else put(px, w, h, x, y, 220, 245, 255, 40);
    }
  }
  ellipse(px, w, h, 11, 11, 3, 2, 255, 255, 255, 230);
  return { w, h, rgba: px };
}

function pellet(): RgbaLayer {
  const w = 32;
  const h = 32;
  const { px } = layer(w, h);
  ellipse(px, w, h, 16, 16, 12, 10, 232, 140, 48);
  ellipse(px, w, h, 16, 16, 12, 10, 160, 80, 20, 0);
  ellipse(px, w, h, 12, 12, 4, 3, 255, 210, 140, 220);
  return { w, h, rgba: px };
}

function hex(s: string): [number, number, number] {
  const n = Number.parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp8(n: number): number {
  return Math.max(0, Math.min(255, n));
}
