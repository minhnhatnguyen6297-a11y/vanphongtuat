/** Drawquarium văn phòng — kiểu dùng chung, không đụng DOM hay đĩa. */

export const SPRITE_W = 192;
export const SPRITE_H = 96;
export const MAX_SPRITE_BYTES = 64 * 1024;
export const MAX_STROKE_BYTES = 8192;
export const MAX_FISH = 40;
export const MAX_PLANTS = 24;
export const MAX_DECOR = 16;
export const MAX_PELLETS = 8;

export const IDLE_DEFAULTS = {
  visibleMs: 15 * 60 * 1000,
  hiddenMs: 5 * 60 * 1000,
  warnMs: 60 * 1000,
};

export type Swim = 'active' | 'drift' | 'cruise' | 'bottom';
export type Kind = 'ca' | 'cay' | 'thuc_an' | 'do';
export type Tier = 'cao' | 'vua' | 'nhe' | 'tinh';
export type LightName = 'auto' | 'day' | 'warm' | 'night';
export type Pt = { x: number; y: number };

export type Stroke = {
  tool: 'pen' | 'eraser' | 'line' | 'fill' | 'stamp';
  color: string;
  size: number;
  alpha: number;
  points: Pt[];
  stamp?: 'eye' | 'fin';
};

export type StrokeDoc = { strokes: Stroke[] };

export type IdleCfg = { visibleMs: number; hiddenMs: number; warnMs: number };

const COLOR = /^#[0-9a-fA-F]{6}$/;
const HASH64 = /^[a-f0-9]{64}$/;
const PRESENCE = new Set([
  'pointer',
  'key',
  'wheel',
  'draw',
  'feed',
  'clean',
  'drag',
  'chat-send',
  'still-here',
  'tank-edit',
]);

export function countsAsPresence(kind: string): boolean {
  return PRESENCE.has(kind);
}

export function idlePhase(opts: {
  now: number;
  lastActive: number;
  visible: boolean;
  hiddenAt: number | null;
  cfg: IdleCfg;
}): 'ok' | 'warn' | 'kick' {
  const { now, lastActive, visible, hiddenAt, cfg } = opts;
  let deadline = lastActive + cfg.visibleMs;
  if (!visible && hiddenAt != null) deadline = Math.min(deadline, hiddenAt + cfg.hiddenMs);
  if (now >= deadline) return 'kick';
  if (cfg.warnMs > 0 && now >= deadline - cfg.warnMs) return 'warn';
  return 'ok';
}

export function spritePublicPath(hash: string): string | null {
  if (!HASH64.test(hash)) return null;
  return `/art/be/s/${hash}.png`;
}

/** null = không phải asset bể, để static handler dùng cache mặc định. */
export function cacheControlFor(pathname: string): string | null {
  if (pathname === '/art/be/manifest.json') return 'no-cache';
  if (/^\/art\/be\/s\/[a-f0-9]{64}\.png$/.test(pathname)) {
    return 'public, max-age=31536000, immutable';
  }
  if (/^\/art\/be\/[a-z0-9-]+\.[a-f0-9]{8,64}\.png$/.test(pathname)) {
    return 'public, max-age=31536000, immutable';
  }
  return null;
}

export function growthAdd(growth: number): number {
  return Math.min(1.32, Math.round((growth + 0.05) * 1000) / 1000);
}

export function clampGrowth(n: number): number {
  if (!Number.isFinite(n)) return 0.62;
  return Math.min(1.05, Math.max(0.62, n));
}

const FISH_NAMES = ['Bống', 'Mực', 'Sọc', 'Cam', 'Búp', 'Béo', 'Lá', 'Bim', 'Tôm', 'Nấm', 'Đốm', 'Mơ', 'Bơ', 'Cốm', 'Sen', 'Đậu', 'Mun', 'Gạo'];

export function randomCreatureName(kind: Kind, rnd: () => number = Math.random): string {
  const n = FISH_NAMES[Math.floor(rnd() * FISH_NAMES.length)] || 'Bống';
  if (kind === 'cay') return `Cây ${n}`;
  if (kind === 'thuc_an') return `Mồi ${n}`;
  if (kind === 'do') return `Đồ ${n}`;
  return `${n} ${1 + Math.floor(rnd() * 90)}`;
}

export function saigonHour(now: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Saigon',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const raw = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  if (!Number.isFinite(raw)) return 0;
  return raw === 24 ? 0 : raw;
}

export function autoLight(hour: number): 'day' | 'warm' | 'night' {
  if (hour >= 19 || hour < 6) return 'night';
  if (hour >= 15) return 'warm';
  return 'day';
}

export function resolveLight(lighting: LightName, now: number): 'day' | 'warm' | 'night' {
  if (lighting === 'auto') return autoLight(saigonHour(now));
  return lighting;
}

export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type SimFish = {
  id: string;
  kind: Kind;
  swim: Swim;
  wave: boolean;
  x: number;
  y: number;
  growth: number;
};

export type SimPellet = { id: string; x: number; bornAt: number; eaten: boolean };

export type Pose = { x: number; y: number; facing: 1 | -1; bend: number };

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

export function pelletY(bornAt: number, nowMs: number): number {
  const age = (nowMs - bornAt) / 1000;
  return Math.min(0.84, 0.16 + Math.max(0, age) * 0.18);
}

export function fishPose(fish: SimFish, nowMs: number, pellets: SimPellet[]): Pose {
  const h = hashId(fish.id);
  const phase = (h % 6283) / 1000;
  if (fish.kind !== 'ca') {
    const sway = Math.sin(nowMs / 780 + phase) * 0.05;
    return { x: clamp(fish.x, 0.05, 0.95), y: clamp(fish.y, 0.2, 0.92), facing: 1, bend: sway };
  }
  const speed = fish.swim === 'cruise' ? 0.9 : fish.swim === 'drift' ? 0.26 : fish.swim === 'bottom' ? 0.42 : 0.55;
  const roam = fish.swim === 'cruise' ? 0.32 : fish.swim === 'bottom' ? 0.08 : fish.swim === 'drift' ? 0.14 : 0.2;
  const amp = fish.swim === 'bottom' ? 0.012 : fish.swim === 'drift' ? 0.028 : 0.04;
  const band = fish.swim === 'bottom' ? 0.8 : fish.swim === 'drift' ? 0.4 : fish.swim === 'cruise' ? 0.36 : 0.52;
  let t = (nowMs / 1000) * speed + phase;
  if (fish.swim === 'drift') {
    const s = Math.sin(t * 0.7);
    t += s * s * s * 1.4;
  }
  const x = clamp(fish.x + Math.sin(t) * roam, 0.06, 0.94);
  const y = clamp(band * 0.62 + fish.y * 0.38 + Math.sin(t * 1.5 + phase) * amp, 0.18, 0.88);
  const facing: 1 | -1 = Math.cos(t) >= 0 ? 1 : -1;
  const bend = Math.sin(t * 5.2) * (fish.wave ? 0.4 : 0.04);
  let px = x;
  let py = y;
  let face = facing;
  let best: { x: number; y: number; d: number } | null = null;
  for (const p of pellets) {
    if (p.eaten) continue;
    const pyy = pelletY(p.bornAt, nowMs);
    const d = Math.hypot(p.x - x, pyy - y);
    if (d < 0.3 && (!best || d < best.d)) best = { x: p.x, y: pyy, d };
  }
  if (best) {
    px = clamp(x + (best.x - x) * 0.75, 0.06, 0.94);
    py = clamp(y + (best.y - y) * 0.75, 0.16, 0.9);
    face = best.x >= x ? 1 : -1;
  }
  return { x: px, y: py, facing: face, bend };
}

export function canEat(pose: Pose, pellet: SimPellet, nowMs: number): boolean {
  if (pellet.eaten) return false;
  return Math.hypot(pose.x - pellet.x, pose.y - pelletY(pellet.bornAt, nowMs)) < 0.07;
}

export function tierFrameMs(tier: Tier): number {
  if (tier === 'nhe') return 1000 / 15;
  if (tier === 'tinh') return Number.POSITIVE_INFINITY;
  return 1000 / 30;
}

export function tierDpr(tier: Tier, devicePixelRatio: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  if (tier === 'cao') return Math.min(1.5, Math.max(1, dpr));
  return 1;
}

export function tierInternalScale(tier: Tier): number {
  if (tier === 'nhe') return 0.62;
  return 1;
}

export function stepQuality(opts: {
  tier: Tier;
  avgFps: number;
  samples: number;
  reducedMotion: boolean;
  deviceMemory?: number;
}): Tier {
  if (opts.reducedMotion) return 'tinh';
  const lowRam = opts.deviceMemory != null && opts.deviceMemory <= 4;
  if (lowRam && opts.tier === 'cao') return 'vua';
  if (opts.samples < 5) return opts.tier;
  const fps = opts.avgFps;
  if (opts.tier === 'cao' && fps < 26) return 'vua';
  if (opts.tier === 'vua' && fps < 24) return 'nhe';
  if (opts.tier === 'nhe' && fps >= 28) return 'vua';
  if (opts.tier === 'vua' && fps >= 28 && !lowRam) return 'cao';
  if (opts.tier === 'tinh') return 'vua';
  return opts.tier;
}

function rdp(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 3) return points.slice();
  let maxD = 0;
  let idx = 0;
  const a = points[0];
  const b = points[points.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const d = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > epsilon) {
    const left = rdp(points.slice(0, idx + 1), epsilon);
    const right = rdp(points.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [a, b];
}

export function simplifyPoints(points: Pt[], epsilon = 0.01, max = 48): Pt[] {
  if (points.length <= 2) return points.slice(0, max);
  const keep = rdp(points, epsilon);
  if (keep.length <= max) return keep;
  const out: Pt[] = [];
  for (let i = 0; i < max; i++) {
    const f = (i / (max - 1)) * (keep.length - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(keep.length - 1, i0 + 1);
    const u = f - i0;
    out.push({
      x: keep[i0].x + (keep[i1].x - keep[i0].x) * u,
      y: keep[i0].y + (keep[i1].y - keep[i0].y) * u,
    });
  }
  return out;
}

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function asPoint(v: unknown): Pt | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as { x?: unknown; y?: unknown };
  const x = typeof p.x === 'number' ? p.x : Number(p.x);
  const y = typeof p.y === 'number' ? p.y : Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < -0.02 || y < -0.02 || x > 1.02 || y > 1.02) return null;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

export function parseStrokeDoc(input: unknown): { ok: true; doc: StrokeDoc } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'strokes' };
  const raw = (input as { strokes?: unknown }).strokes;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 64) return { ok: false, error: 'strokes' };
  const strokes: Stroke[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return { ok: false, error: 'stroke' };
    const s = item as Record<string, unknown>;
    const tool = s.tool;
    if (tool !== 'pen' && tool !== 'eraser' && tool !== 'line' && tool !== 'fill' && tool !== 'stamp') {
      return { ok: false, error: 'tool' };
    }
    const color = String(s.color || '');
    if (!COLOR.test(color)) return { ok: false, error: 'color' };
    const ptsIn = Array.isArray(s.points) ? s.points : [];
    const points: Pt[] = [];
    for (const p of ptsIn) {
      const pt = asPoint(p);
      if (!pt) return { ok: false, error: 'point' };
      points.push(pt);
      if (points.length > 64) return { ok: false, error: 'points' };
    }
    const need = tool === 'line' ? 2 : 1;
    if (points.length < need) return { ok: false, error: 'points' };
    const stamp = s.stamp === 'fin' ? 'fin' : s.stamp === 'eye' ? 'eye' : undefined;
    if (tool === 'stamp' && !stamp) return { ok: false, error: 'stamp' };
    strokes.push({
      tool,
      color: color.toLowerCase(),
      size: num(s.size, 0.5, 64, 6),
      alpha: num(s.alpha, 0.05, 1, 1),
      points: tool === 'pen' || tool === 'eraser' ? simplifyPoints(points, 0.012, 48) : points.slice(0, tool === 'line' ? 2 : 1),
      ...(stamp ? { stamp } : {}),
    });
  }
  const doc = { strokes };
  if (strokeBytes(doc) > MAX_STROKE_BYTES) return { ok: false, error: 'big' };
  return { ok: true, doc };
}

export function strokeBytes(doc: StrokeDoc): number {
  return new TextEncoder().encode(JSON.stringify(doc)).length;
}

function oval(cx: number, cy: number, rx: number, ry: number, n = 18): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

export function templateFishBasic(): StrokeDoc {
  return {
    strokes: [
      { tool: 'pen', color: '#ef6a2a', size: 10, alpha: 1, points: oval(0.56, 0.52, 0.22, 0.26) },
      { tool: 'fill', color: '#ffb703', size: 1, alpha: 1, points: [{ x: 0.56, y: 0.52 }] },
      {
        tool: 'pen',
        color: '#1b1b1b',
        size: 7,
        alpha: 1,
        points: [
          { x: 0.36, y: 0.52 },
          { x: 0.16, y: 0.3 },
          { x: 0.22, y: 0.52 },
          { x: 0.16, y: 0.74 },
          { x: 0.36, y: 0.52 },
        ],
      },
      { tool: 'stamp', color: '#ffffff', size: 16, alpha: 1, points: [{ x: 0.7, y: 0.44 }], stamp: 'eye' },
    ],
  };
}

export function templateFishRound(): StrokeDoc {
  return {
    strokes: [
      { tool: 'pen', color: '#1f5fd1', size: 10, alpha: 1, points: oval(0.52, 0.5, 0.28, 0.3, 20) },
      { tool: 'fill', color: '#7ec8e3', size: 1, alpha: 1, points: [{ x: 0.52, y: 0.5 }] },
      { tool: 'stamp', color: '#ffffff', size: 18, alpha: 1, points: [{ x: 0.66, y: 0.42 }], stamp: 'eye' },
      { tool: 'stamp', color: '#ef6a2a', size: 14, alpha: 1, points: [{ x: 0.28, y: 0.5 }], stamp: 'fin' },
    ],
  };
}

export function templatePlant(): StrokeDoc {
  return {
    strokes: [
      {
        tool: 'pen',
        color: '#1b7a43',
        size: 8,
        alpha: 1,
        points: [
          { x: 0.5, y: 0.92 },
          { x: 0.48, y: 0.7 },
          { x: 0.52, y: 0.48 },
          { x: 0.46, y: 0.28 },
        ],
      },
      {
        tool: 'pen',
        color: '#3dae6a',
        size: 6,
        alpha: 1,
        points: [
          { x: 0.5, y: 0.62 },
          { x: 0.72, y: 0.48 },
          { x: 0.78, y: 0.36 },
        ],
      },
      {
        tool: 'pen',
        color: '#145c34',
        size: 6,
        alpha: 1,
        points: [
          { x: 0.5, y: 0.58 },
          { x: 0.28, y: 0.46 },
          { x: 0.22, y: 0.32 },
        ],
      },
    ],
  };
}

export const UNLOCKS = {
  stamp_fin: { cost: 2, label: 'Tem vây' },
  khuon_ca2: { cost: 3, label: 'Khuôn cá tròn' },
  khuon_cay: { cost: 2, label: 'Khuôn cây' },
} as const;

export type UnlockId = keyof typeof UNLOCKS;
