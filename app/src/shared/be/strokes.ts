import { POINTS_MAX, STROKE_JSON_MAX, STROKE_MAX, type Stroke, type StrokeTool } from './types.ts';

const TOOLS: StrokeTool[] = ['pen', 'erase', 'line', 'fill'];
const HEX = /^#[0-9a-f]{6}$/;

export type StrokeOk = { ok: true; strokes: Stroke[]; json: string };
export type StrokeBad = { ok: false; error: string };

/** Chuẩn hóa rồi kiểm. JSON trả về là bản lưu (thứ tự khóa cố định). */
export function validateStrokes(raw: unknown): StrokeOk | StrokeBad {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > STROKE_MAX) {
    return { ok: false, error: 'be_strokes' };
  }
  const strokes: Stroke[] = [];
  for (const item of raw) {
    const s = normalizeOne(item);
    if (!s) return { ok: false, error: 'be_strokes' };
    strokes.push(s);
  }
  const json = canonicalStrokes(strokes);
  if (json.length > STROKE_JSON_MAX) return { ok: false, error: 'be_strokes' };
  return { ok: true, strokes, json };
}

export function canonicalStrokes(strokes: Stroke[]): string {
  return JSON.stringify(
    strokes.map((s) => {
      const o: Record<string, unknown> = {
        tool: s.tool,
        color: s.color,
        size: s.size,
        alpha: s.alpha,
        points: s.points,
      };
      if (s.hard) o.hard = true;
      if (s.mask) o.mask = true;
      return o;
    }),
  );
}

/** Rút điểm gần như thẳng. Gọi ở giấy vẽ trước khi gửi. */
export function simplifyStroke(stroke: Stroke, epsilon = 8): Stroke {
  if (stroke.tool !== 'pen' || stroke.points.length < 8) return stroke;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < stroke.points.length; i += 2) {
    pairs.push([stroke.points[i], stroke.points[i + 1]]);
  }
  const kept = rdp(pairs, epsilon);
  const points: number[] = [];
  for (const [x, y] of kept) points.push(x, y);
  return { ...stroke, points };
}

function normalizeOne(item: unknown): Stroke | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const tool = o.tool;
  if (typeof tool !== 'string' || !TOOLS.includes(tool as StrokeTool)) return null;
  const color = typeof o.color === 'string' ? o.color.toLowerCase() : '';
  if (!HEX.test(color)) return null;
  const size = round1(o.size);
  const alpha = round2(o.alpha);
  if (size == null || size < 1 || size > 220) return null;
  if (alpha == null || alpha < 0.15 || alpha > 1) return null;
  if (!Array.isArray(o.points) || o.points.length < 2 || o.points.length > POINTS_MAX) return null;
  if (o.points.length % 2 !== 0) return null;
  const points: number[] = [];
  for (const n of o.points) {
    const p = round1(n);
    if (p == null || p < 0 || p > 1000) return null;
    points.push(p);
  }
  if (tool === 'line' && points.length < 4) return null;
  const stroke: Stroke = { tool: tool as StrokeTool, color, size, alpha, points };
  if (o.hard === true) stroke.hard = true;
  if (o.mask === true) stroke.mask = true;
  return stroke;
}

function round1(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function round2(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function rdp(pts: Array<[number, number]>, eps: number): Array<[number, number]> {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > eps) {
    const left = rdp(pts.slice(0, idx + 1), eps);
    const right = rdp(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}
