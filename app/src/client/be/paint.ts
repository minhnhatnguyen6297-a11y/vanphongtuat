import { SPRITE_H, SPRITE_W, type Pt, type Stroke, type StrokeDoc } from '../../shared/be.js';

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function flood(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sx: number,
  sy: number,
  color: string,
  alpha: number,
): void {
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const [tr, tg, tb, ta] = [data[(sy * w + sx) * 4], data[(sy * w + sx) * 4 + 1], data[(sy * w + sx) * 4 + 2], data[(sy * w + sx) * 4 + 3]];
  const [cr, cg, cb] = rgb(color);
  const ca = Math.round(alpha * 255);
  if (tr === cr && tg === cg && tb === cb && Math.abs(ta - ca) < 4) return;
  const match = (i: number) =>
    Math.abs(data[i] - tr) < 28 &&
    Math.abs(data[i + 1] - tg) < 28 &&
    Math.abs(data[i + 2] - tb) < 28 &&
    Math.abs(data[i + 3] - ta) < 40;
  const stack = [sx, sy];
  const seen = new Uint8Array(w * h);
  let guard = w * h;
  while (stack.length && guard-- > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (seen[p]) continue;
    const i = p * 4;
    if (!match(i)) continue;
    seen[p] = 1;
    data[i] = cr;
    data[i + 1] = cg;
    data[i + 2] = cb;
    data[i + 3] = ca;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  ctx.putImageData(img, 0, 0);
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number): void {
  const lw = Math.max(1, s.size * (w / 512));
  ctx.save();
  ctx.globalAlpha = s.alpha;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  if (s.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
  if (s.tool === 'fill') {
    const x = Math.round(s.points[0].x * (w - 1));
    const y = Math.round(s.points[0].y * (h - 1));
    ctx.restore();
    flood(ctx, w, h, x, y, s.color, s.alpha);
    return;
  }
  if (s.tool === 'stamp') {
    const x = s.points[0].x * w;
    const y = s.points[0].y * h;
    const rad = Math.max(4, s.size * (w / 512));
    ctx.translate(x, y);
    if (s.stamp === 'fin') {
      ctx.beginPath();
      ctx.moveTo(-rad, 0);
      ctx.quadraticCurveTo(-rad * 0.2, -rad, rad * 0.85, -rad * 0.15);
      ctx.quadraticCurveTo(rad * 0.1, 0, rad * 0.85, rad * 0.15);
      ctx.quadraticCurveTo(-rad * 0.2, rad, -rad, 0);
      ctx.fill();
    } else {
      ctx.fillStyle = '#fffdf6';
      ctx.beginPath();
      ctx.ellipse(0, 0, rad, rad * 0.86, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, rad * 0.12);
      ctx.strokeStyle = '#1b1b1b';
      ctx.stroke();
      ctx.fillStyle = '#1b1b1b';
      ctx.beginPath();
      ctx.arc(rad * 0.18, 0, rad * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(rad * 0.05, -rad * 0.12, rad * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  ctx.beginPath();
  s.points.forEach((p, i) => {
    const x = p.x * w;
    const y = p.y * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if ((s.tool === 'pen' || s.tool === 'eraser') && s.points.length === 1) {
    ctx.beginPath();
    ctx.arc(s.points[0].x * w, s.points[0].y * h, lw / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.stroke();
  }
  ctx.restore();
}

export function paintStrokes(ctx: CanvasRenderingContext2D, doc: StrokeDoc, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  for (const s of doc.strokes) drawStroke(ctx, s, w, h);
}

export function mirrorStroke(s: Stroke, axis: 'h' | 'v'): Stroke {
  return {
    ...s,
    points: s.points.map((p) => (axis === 'h' ? { x: 1 - p.x, y: p.y } : { x: p.x, y: 1 - p.y })),
  };
}

export async function bakeSprite(doc: StrokeDoc): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_W;
  canvas.height = SPRITE_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  paintStrokes(ctx, doc, SPRITE_W, SPRITE_H);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
  if (!blob) throw new Error('bake');
  return blob;
}

export function sampleColor(ctx: CanvasRenderingContext2D, p: Pt, w: number, h: number): string | null {
  const x = Math.round(p.x * (w - 1));
  const y = Math.round(p.y * (h - 1));
  const px = ctx.getImageData(x, y, 1, 1).data;
  if (px[3] < 16) return null;
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(px[0])}${hex(px[1])}${hex(px[2])}`;
}
