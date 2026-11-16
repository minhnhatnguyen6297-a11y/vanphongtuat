import type { Stroke } from './types.ts';

/** Nướng nét vector thành ảnh RGBA. Dùng lúc lưu (máy chủ) và lúc xem giấy vẽ — không dùng mỗi khung hình của bể. */
export function rasterStrokes(strokes: Stroke[], w: number, h: number): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  for (const s of strokes) {
    if (s.tool === 'fill') {
      const [r, g, b] = hexRgb(s.color);
      fillAt(px, w, h, mapX(s.points[0], w), mapY(s.points[1], h), r, g, b, Math.round(s.alpha * 255));
      continue;
    }
    const [r, g, b] = hexRgb(s.color);
    const radius = Math.max(0.8, (s.size / 1000) * w * 0.5);
    const erase = s.tool === 'erase';
    const a = Math.round(s.alpha * 255);
    const pts = s.tool === 'line' ? [s.points[0], s.points[1], s.points[s.points.length - 2], s.points[s.points.length - 1]] : s.points;
    if (pts.length < 4) {
      stamp(px, w, h, mapX(pts[0], w), mapY(pts[1], h), radius, r, g, b, a, erase, !!s.mask, !!s.hard);
      continue;
    }
    for (let i = 2; i < pts.length; i += 2) {
      const x0 = mapX(pts[i - 2], w);
      const y0 = mapY(pts[i - 1], h);
      const x1 = mapX(pts[i], w);
      const y1 = mapY(pts[i + 1], h);
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const step = Math.max(0.4, radius * 0.42);
      const n = Math.max(1, Math.ceil(dist / step));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        stamp(
          px, w, h,
          x0 + (x1 - x0) * t,
          y0 + (y1 - y0) * t,
          radius, r, g, b, a, erase, !!s.mask, !!s.hard,
        );
      }
    }
  }
  return px;
}

function mapX(v: number, w: number): number {
  return (v / 1000) * (w - 1);
}
function mapY(v: number, h: number): number {
  return (v / 1000) * (h - 1);
}

function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function stamp(
  px: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  a: number,
  erase: boolean,
  mask: boolean,
  hard: boolean,
): void {
  const rInt = Math.max(1, Math.ceil(radius));
  const x0 = Math.max(0, Math.floor(cx - rInt));
  const y0 = Math.max(0, Math.floor(cy - rInt));
  const x1 = Math.min(w - 1, Math.ceil(cx + rInt));
  const y1 = Math.min(h - 1, Math.ceil(cy + rInt));
  const r2 = radius * radius;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const i = (y * w + x) * 4;
      if (erase) {
        px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
        continue;
      }
      if (mask && px[i + 3] < 24) continue;
      let alpha = a;
      if (!hard) {
        const d = Math.sqrt(d2) / radius;
        const edge = d < 0.55 ? 1 : Math.max(0, 1 - (d - 0.55) / 0.45);
        alpha = Math.round(a * edge);
      }
      if (alpha <= 0) continue;
      blend(px, i, r, g, b, alpha);
    }
  }
}

function blend(px: Uint8Array, i: number, r: number, g: number, b: number, a: number): void {
  const sa = a / 255;
  const da = px[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA < 0.001) {
    px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
    return;
  }
  px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / outA);
  px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / outA);
  px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / outA);
  px[i + 3] = Math.round(outA * 255);
}

function fillAt(
  px: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  const sx = Math.round(x);
  const sy = Math.round(y);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const si = (sy * w + sx) * 4;
  const tr = px[si];
  const tg = px[si + 1];
  const tb = px[si + 2];
  const ta = px[si + 3];
  const empty = ta < 28;
  const seen = new Uint8Array(w * h);
  const stack = [sx, sy];
  let guard = w * h;
  while (stack.length && guard-- > 0) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const p = cy * w + cx;
    if (seen[p]) continue;
    const i = p * 4;
    if (empty) {
      if (px[i + 3] >= 36) continue;
    } else if (
      Math.abs(px[i] - tr) + Math.abs(px[i + 1] - tg) + Math.abs(px[i + 2] - tb) + Math.abs(px[i + 3] - ta) >
      60
    ) {
      continue;
    }
    seen[p] = 1;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
    stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
  }
}
