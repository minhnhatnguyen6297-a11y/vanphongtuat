import { lightBucket, type BeDrawing, type BePublic, type BeSprite, type QualityName } from '../../shared/be/types.js';
import { foodAlive, foodYAt, writeFishPose, type Pose, type SimFood } from '../../shared/be/sim.js';
import { nextQuality } from '../../shared/be/quality.js';
import { currentNudge, getBe, onBe, serverNow } from './model.js';

type Src = { img: CanvasImageSource; sx: number; sy: number; sw: number; sh: number };

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let running = false;
let padPaused = false;
let lastTs = 0;
let acc = 0;
let quality: QualityName = 'vua';
let pinned: QualityName | 'auto' = 'auto';
let reduced = false;
let far: HTMLCanvasElement | null = null;
let mid: HTMLCanvasElement | null = null;
let half: HTMLCanvasElement | null = null;
let scenery = '';
let drag: { id: string; x: number; y: number } | null = null;
const images = new Map<string, HTMLImageElement>();
const poses = new Map<string, Pose>();
const hits: { id: string; x: number; y: number; r: number }[] = [];
const bubbles = Array.from({ length: 8 }, (_, i) => ({
  x: 0.12 + (i * 0.11) % 0.76,
  y: 0.3 + ((i * 0.17) % 0.45),
  r: 5 + (i % 4) * 2,
  v: 0.035 + (i % 3) * 0.012,
}));

let fps = 0;
let fpsMin = 0;
let frameMs = 0;
let draws = 0;
let fishCount = 0;
let ready = false;
let dpr = 1;
let viewW = 0;
let viewH = 0;
let showFrames = 0;
let showStart = 0;
let showMs = 0;
let bucketFrames = 0;
let bucketMs = 0;
let lastSwitch = 0;
let didStep = false;
let vuaCausticTick = 0;
let unlisten: (() => void) | null = null;
let gen = 0;

export function startRender(target: HTMLCanvasElement): void {
  stopRender();
  canvas = target;
  ctx = target.getContext('2d', { alpha: false });
  running = true;
  reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced && pinned === 'auto') quality = 'tinh';
  document.addEventListener('visibilitychange', onVis);
  unlisten = onBe(pokeRender);
  onVis();
}

export function stopRender(): void {
  running = false;
  cancelAnimationFrame(raf);
  raf = 0;
  document.removeEventListener('visibilitychange', onVis);
  unlisten?.();
  unlisten = null;
  gen++;
  canvas = null;
  ctx = null;
  far = null;
  mid = null;
  half = null;
  scenery = '';
  images.clear();
  poses.clear();
}

export function setPadPaused(paused: boolean): void {
  padPaused = paused;
  if (!running) return;
  if (paused) {
    drawFrame(16, true);
    cancelAnimationFrame(raf);
    raf = 0;
    return;
  }
  lastTs = 0;
  acc = 0;
  onVis();
}

export function pinQuality(next: QualityName | 'auto'): void {
  pinned = next;
  quality = next === 'auto' ? (reduced ? 'tinh' : 'vua') : next;
  scenery = '';
  pokeRender();
}

export function setDrag(id: string | null, x = 0, y = 0): void {
  drag = id ? { id, x, y } : null;
}

export function hitAt(nx: number, ny: number): string | null {
  let best: string | null = null;
  let bestD = 1;
  for (const hit of hits) {
    const d = Math.hypot(hit.x - nx, hit.y - ny);
    if (d <= hit.r && d < bestD) {
      bestD = d;
      best = hit.id;
    }
  }
  return best;
}

export function pokeRender(): void {
  scenery = '';
  if (!running || !ctx) return;
  if (padPaused || quality === 'tinh' || document.hidden) {
    if (!document.hidden) drawFrame(16, true);
    return;
  }
  if (!raf) raf = requestAnimationFrame(loop);
}

function onVis(): void {
  if (!running) return;
  if (document.hidden || padPaused) {
    cancelAnimationFrame(raf);
    raf = 0;
    return;
  }
  if (quality === 'tinh') {
    drawFrame(16, true);
    return;
  }
  lastTs = 0;
  acc = 0;
  if (!raf) raf = requestAnimationFrame(loop);
}

function loop(ts: number): void {
  if (!running || document.hidden || padPaused) {
    raf = 0;
    return;
  }
  raf = requestAnimationFrame(loop);
  if (quality === 'tinh') {
    drawFrame(16, true);
    cancelAnimationFrame(raf);
    raf = 0;
    return;
  }
  const cap = quality === 'nhe' ? 15 : 30;
  const dt = lastTs ? Math.min(80, ts - lastTs) : 1000 / cap;
  lastTs = ts;
  acc += dt;
  const step = 1000 / cap;
  if (acc < step) return;
  const frameDt = Math.min(80, acc);
  acc = 0;
  drawFrame(frameDt, false);
  noteFps(frameDt);
}

function drawFrame(dt: number, frozen: boolean): void {
  if (!canvas || !ctx) return;
  const parent = canvas.parentElement;
  if (!parent) return;
  const cssW = parent.clientWidth;
  const cssH = parent.clientHeight;
  if (cssW < 8 || cssH < 8) return;
  const raw = window.devicePixelRatio || 1;
  const capDpr = quality === 'cao' ? 1.5 : 1;
  const down = quality === 'nhe' ? 0.75 : 1;
  dpr = Math.min(capDpr, raw) * down;
  const w = Math.max(2, Math.round(cssW * dpr));
  const h = Math.max(2, Math.round(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    scenery = '';
  }
  viewW = w;
  viewH = h;
  const state = getBe();
  const t = serverNow();
  draws = 0;
  hits.length = 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = quality !== 'nhe';
  ctx.fillStyle = '#083044';
  ctx.fillRect(0, 0, w, h);
  draws++;

  if (!state) {
    publish(0);
    return;
  }

  const built = ensureStatic(w, h, state);
  const ox = frozen || quality === 'nhe' || quality === 'tinh' ? 0 : Math.sin(t / 3800) * w * 0.01;
  if (far) {
    ctx.drawImage(far, ox, 0, w, h);
    draws++;
  }
  if (mid) {
    ctx.drawImage(mid, ox * 0.35, 0, w, h);
    draws++;
  }

  const surface = surfaceY(state);
  if (quality === 'cao' || quality === 'vua' || quality === 'tinh') {
    drawCaustics(state, t, surface, frozen);
    drawRays(state, t, surface, frozen);
  }

  const decor = state.drawings.filter((d) => d.placed && !d.hidden && d.kind !== 'ca');
  if (!built.bakeDecor) {
    decor.forEach((d, i) => drawDecor(d, i, t, frozen));
  }

  const fish = state.drawings.filter((d) => d.placed && !d.hidden && d.kind === 'ca');
  fishCount = fish.length;
  const order = fish
    .map((d) => ({ d, y: poseOf(d, state, t).y }))
    .sort((a, b) => a.y - b.y);
  order.forEach((item, rank) => drawFish(item.d, state, t, frozen, rank));

  for (const food of state.foods) {
    if (!foodAlive(food, t)) continue;
    drawFood(food, t);
  }

  if (!frozen && (quality === 'cao' || quality === 'vua')) stepBubbles(dt, surface);

  if (state.tank.dirt > 0.02) {
    ctx.fillStyle = `rgba(92, 62, 32, ${Math.min(0.45, state.tank.dirt * 0.4)})`;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
    draws++;
  }
  glass(surface);
  ready = true;
  canvas.dataset.beReady = '1';
  const stage = canvas.closest('[data-be-stage]') as HTMLElement | null;
  if (stage) stage.dataset.quality = quality;
  publish(fishCount);
}

function poseOf(d: BeDrawing, state: BePublic, t: number): Pose {
  let pose = poses.get(d.id);
  if (!pose) {
    pose = { x: d.x, y: d.y, facing: 1, bend: 0 };
    poses.set(d.id, pose);
  }
  if (drag && drag.id === d.id) {
    pose.x = drag.x;
    pose.y = drag.y;
    pose.bend = 0;
    return pose;
  }
  const foods: SimFood[] = state.foods.map((f) => ({
    id: f.id,
    x: f.x,
    y: f.y,
    bornAt: f.bornAt,
    eatenAt: f.eatenAt,
    eaterId: f.eaterId,
  }));
  writeFishPose(
    {
      id: d.id,
      swim: d.swim,
      phase: d.phase,
      holdX: d.holdX,
      holdY: d.holdY,
      holdUntil: d.holdUntil,
    },
    foods,
    t,
    state.tank.waterLevel,
    pose,
  );
  const nudge = currentNudge(t);
  if (nudge) {
    const dx = nudge.x - pose.x;
    const dy = nudge.y - pose.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.4 && dist > 0.001) {
      const pull = (nudge.kind === 'scare' ? -0.16 : 0.2) * (1 - dist / 0.4);
      pose.x += (dx / dist) * pull;
      pose.y += (dy / dist) * pull;
      pose.facing = dx >= 0 ? 1 : -1;
    }
  }
  return pose;
}

function drawFish(d: BeDrawing, state: BePublic, t: number, frozen: boolean, rank: number): void {
  if (!ctx) return;
  const src = source(d.sprite, state);
  const pose = poseOf(d, state, t);
  const dh = d.scale * viewH * 0.2;
  const aspect = d.sprite.w / Math.max(1, d.sprite.h);
  const dw = dh * aspect;
  const parts = segments(rank, d.wave, frozen);
  const partW = dw / parts;
  const amp = quality === 'cao' ? 0.38 : 0.24;
  for (let i = 0; i < parts; i++) {
    const tail = (parts - 1 - i) / Math.max(1, parts - 1);
    const ang = !d.wave || frozen || quality === 'nhe' || quality === 'tinh'
      ? 0
      : Math.sin(pose.bend - tail * 0.85) * amp * (0.15 + tail);
    const along = (i - (parts - 1) / 2) * partW * 0.9;
    const cx = pose.x * viewW + along * pose.facing;
    const cy = pose.y * viewH;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.scale(pose.facing, 1);
    if (src) {
      const slice = src.sw / parts;
      ctx.drawImage(src.img, src.sx + i * slice, src.sy, slice, src.sh, -partW / 2, -dh / 2, partW, dh);
    } else {
      ctx.fillStyle = '#f28c28';
      ctx.beginPath();
      ctx.ellipse(0, 0, partW / 2, dh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    draws++;
  }
  const fresh = d.releasedAt != null && t - d.releasedAt < 8000 && t >= d.releasedAt;
  if (fresh) {
    ctx.save();
    ctx.strokeStyle = '#ffcf33';
    ctx.lineWidth = Math.max(2, viewW * 0.004);
    ctx.beginPath();
    ctx.ellipse(pose.x * viewW, pose.y * viewH, dw * 0.62, dh * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    draws++;
  }
  hits.push({ id: d.id, x: pose.x, y: pose.y, r: Math.max(0.06, (dw / viewW) * 0.55) });
}

function segments(rank: number, wave: boolean, frozen: boolean): number {
  if (!wave || frozen || quality === 'nhe' || quality === 'tinh') return 1;
  if (quality === 'vua') return rank < 6 ? 2 : 1;
  if (rank < 6) return 3;
  if (rank < 14) return 2;
  return 1;
}

function drawDecor(d: BeDrawing, index: number, t: number, frozen: boolean): void {
  if (!ctx) return;
  const src = source(d.sprite, getBe());
  const dh = (d.kind === 'cay' ? 0.28 : 0.16) * viewH * Math.max(0.7, d.scale);
  const aspect = d.sprite.w / Math.max(1, d.sprite.h);
  const dw = dh * aspect;
  const sway = frozen || quality === 'nhe' || quality === 'tinh' || d.kind !== 'cay'
    ? 0
    : Math.sin(t / 800 + index) * 0.05;
  ctx.save();
  ctx.translate(d.x * viewW, d.y * viewH);
  ctx.rotate(sway);
  if (src) ctx.drawImage(src.img, src.sx, src.sy, src.sw, src.sh, -dw / 2, -dh, dw, dh);
  else {
    ctx.fillStyle = '#1b7a43';
    ctx.fillRect(-dw / 2, -dh, dw, dh);
  }
  ctx.restore();
  draws++;
  hits.push({ id: d.id, x: d.x, y: d.y - dh / viewH / 2, r: 0.06 });
}

function drawFood(food: BePublic['foods'][number], t: number): void {
  if (!ctx) return;
  const y = foodYAt(food, t);
  const src = food.sprite ? source(food.sprite, getBe()) : sourceScene('pellet');
  const s = viewH * 0.045;
  if (src) ctx.drawImage(src.img, src.sx, src.sy, src.sw, src.sh, food.x * viewW - s / 2, y * viewH - s / 2, s, s);
  else {
    ctx.fillStyle = '#e28c30';
    ctx.beginPath();
    ctx.arc(food.x * viewW, y * viewH, s / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  draws++;
}

function stepBubbles(dt: number, surface: number): void {
  if (!ctx) return;
  const n = quality === 'cao' ? 8 : 4;
  const src = sourceScene('bubble');
  const sand = 0.8;
  for (let i = 0; i < n; i++) {
    const b = bubbles[i];
    b.y -= b.v * (dt / 1000);
    if (b.y < surface + 0.02) {
      b.y = sand;
      b.x = 0.1 + ((b.x + 0.17) % 0.8);
    }
    const r = b.r * (viewW / 900);
    if (src) ctx.drawImage(src.img, src.sx, src.sy, src.sw, src.sh, b.x * viewW - r, b.y * viewH - r, r * 2, r * 2);
    else {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(b.x * viewW, b.y * viewH, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    draws++;
  }
}

function drawCaustics(state: BePublic, t: number, surface: number, frozen: boolean): void {
  if (!ctx) return;
  const layer = state.scene.caustics;
  const img = layer ? need(layer.url) : null;
  const src = img && layer ? { img, sx: 0, sy: 0, sw: layer.w, sh: layer.h } : null;
  if (!src || !layer?.frames || !layer.fw) return;
  let frame = frozen ? 1 : Math.floor(t / 160) % layer.frames;
  if (quality === 'vua' && !frozen) {
    vuaCausticTick++;
    if (vuaCausticTick % 2 === 0) frame = Math.floor(t / 160) % layer.frames;
    else frame = Math.floor((t - 160) / 160) % layer.frames;
  }
  const sx = frame * layer.fw;
  const top = surface * viewH;
  const dh = viewH - top;
  ctx.save();
  ctx.globalAlpha = quality === 'tinh' ? 0.22 : 0.32;
  if (quality === 'vua') {
    if (!half || half.width !== Math.floor(viewW / 2)) {
      half = document.createElement('canvas');
      half.width = Math.max(2, Math.floor(viewW / 2));
      half.height = Math.max(2, Math.floor(viewH / 2));
    }
    const hctx = half.getContext('2d');
    if (hctx && vuaCausticTick % 2 === 0) {
      hctx.clearRect(0, 0, half.width, half.height);
      hctx.drawImage(src.img, sx, 0, layer.fw, layer.fh ?? src.sh, 0, top / 2, half.width, Math.max(1, dh / 2));
    }
    ctx.drawImage(half, 0, 0, viewW, viewH);
  } else {
    ctx.drawImage(src.img, sx, 0, layer.fw, layer.fh ?? src.sh, 0, top, viewW, dh);
  }
  ctx.restore();
  draws++;
}

function drawRays(state: BePublic, t: number, surface: number, frozen: boolean): void {
  if (!ctx || quality === 'nhe') return;
  const src = state.scene.rays ? sourceScene('rays') : null;
  if (!src) return;
  const shift = frozen || quality === 'tinh' ? 0 : (t / 40) % viewW;
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.rect(0, surface * viewH, viewW, viewH);
  ctx.clip();
  ctx.drawImage(src.img, src.sx, src.sy, src.sw, src.sh, -shift, surface * viewH, viewW, viewH * 0.7);
  ctx.drawImage(src.img, src.sx, src.sy, src.sw, src.sh, viewW - shift, surface * viewH, viewW, viewH * 0.7);
  ctx.restore();
  draws += 2;
}

function glass(surface: number): void {
  if (!ctx) return;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(2, viewH * 0.008);
  ctx.beginPath();
  ctx.moveTo(0, surface * viewH);
  ctx.lineTo(viewW, surface * viewH);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.strokeRect(8, 8, viewW - 16, viewH - 16);
  draws += 2;
}

function ensureStatic(w: number, h: number, state: BePublic): { bakeDecor: boolean } {
  const bucket = lightBucket(state.tank.lighting);
  const decor = state.drawings.filter((d) => d.placed && !d.hidden && d.kind !== 'ca');
  const bakeDecor = decor.length > 8 || quality === 'nhe' || quality === 'tinh';
  const sig = [
    w, h, quality, bucket, state.tank.sand, state.tank.waterLevel.toFixed(3),
    state.tank.rockCount, state.tank.woodCount,
    bakeDecor ? decor.map((d) => `${d.id}:${d.sprite.hash}:${d.x.toFixed(2)}:${d.y.toFixed(2)}`).join(';') : '',
    state.scene[bucket]?.url || '',
    state.scene[`sand-${state.tank.sand}`]?.url || '',
  ].join('|');
  if (sig === scenery && far && mid) return { bakeDecor };
  scenery = sig;
  far = document.createElement('canvas');
  far.width = w;
  far.height = h;
  paintFar(far, state, bucket);
  mid = document.createElement('canvas');
  mid.width = w;
  mid.height = h;
  paintMid(mid, state, bakeDecor ? decor : []);
  return { bakeDecor };
}

function paintFar(layer: HTMLCanvasElement, state: BePublic, bucket: string): void {
  const c = layer.getContext('2d');
  if (!c) return;
  const w = layer.width;
  const h = layer.height;
  const g = c.createLinearGradient(0, 0, 0, h);
  if (bucket === 'dem') {
    g.addColorStop(0, '#1c2740');
    g.addColorStop(1, '#101622');
  } else if (bucket === 'chieu') {
    g.addColorStop(0, '#f0c48a');
    g.addColorStop(1, '#e7b07a');
  } else {
    g.addColorStop(0, '#f4e2c4');
    g.addColorStop(1, '#e7d3b0');
  }
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const src = state.scene[bucket] ? need(state.scene[bucket].url) : null;
  if (src) c.drawImage(src, 0, 0, w, h);
}

function paintMid(layer: HTMLCanvasElement, state: BePublic, decor: BeDrawing[]): void {
  const c = layer.getContext('2d');
  if (!c) return;
  const w = layer.width;
  const h = layer.height;
  const surface = surfaceY(state);
  const top = surface * h;
  const water = c.createLinearGradient(0, top, 0, h);
  water.addColorStop(0, 'rgba(150, 214, 228, 0.28)');
  water.addColorStop(0.45, 'rgba(36, 130, 170, 0.42)');
  water.addColorStop(1, 'rgba(8, 48, 74, 0.62)');
  c.fillStyle = water;
  c.fillRect(0, top, w, h - top);
  const sandTop = h * 0.82;
  const sand = state.scene[`sand-${state.tank.sand}`];
  const sandImg = sand ? need(sand.url) : null;
  if (sandImg) c.drawImage(sandImg, 0, sandTop, w, h - sandTop);
  else {
    c.fillStyle = '#e6c27a';
    c.fillRect(0, sandTop, w, h - sandTop);
  }
  const rock = state.scene.rock ? need(state.scene.rock.url) : null;
  const wood = state.scene.wood ? need(state.scene.wood.url) : null;
  for (let i = 0; i < state.tank.rockCount; i++) {
    const x = w * (0.14 + ((i + 1) / (state.tank.rockCount + 1)) * 0.72);
    if (rock) c.drawImage(rock, x - w * 0.06, h * 0.74, w * 0.12, h * 0.12);
  }
  for (let i = 0; i < state.tank.woodCount; i++) {
    const x = w * (0.22 + i * 0.28);
    if (wood) c.drawImage(wood, x, h * 0.76, w * 0.2, h * 0.07);
  }
  for (const d of decor) {
    const src = source(d.sprite, state);
    if (!src) continue;
    const dh = (d.kind === 'cay' ? 0.28 : 0.16) * h;
    const dw = dh * (d.sprite.w / Math.max(1, d.sprite.h));
    c.drawImage(src.img, src.sx, src.sy, src.sw, src.sh, d.x * w - dw / 2, d.y * h - dh, dw, dh);
  }
}

function surfaceY(state: BePublic): number {
  return Math.min(0.62, Math.max(0.1, 1 - state.tank.waterLevel));
}

function source(sp: BeSprite, state: BePublic | null): Src | null {
  if (sp.atlas != null && state) {
    const atlas = state.atlases[sp.atlas];
    if (atlas) {
      const img = need(atlas.url);
      if (!img) return null;
      return { img, sx: sp.ax, sy: sp.ay, sw: sp.w, sh: sp.h };
    }
  }
  const img = need(sp.url);
  if (!img) return null;
  return { img, sx: 0, sy: 0, sw: sp.w, sh: sp.h };
}

function sourceScene(name: string): Src | null {
  const state = getBe();
  const layer = state?.scene[name];
  if (!layer) return null;
  const img = need(layer.url);
  if (!img) return null;
  return { img, sx: 0, sy: 0, sw: layer.w, sh: layer.h };
}

function need(url: string): HTMLImageElement | null {
  let img = images.get(url);
  if (!img) {
    img = new Image();
    const g = gen;
    img.onload = () => {
      if (g !== gen) return;
      scenery = '';
      pokeRender();
    };
    img.src = url;
    images.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function noteFps(dt: number): void {
  showFrames++;
  showMs += dt;
  bucketFrames++;
  bucketMs += dt;
  const now = performance.now();
  if (!showStart) showStart = now;
  if (now - showStart >= 1000) {
    fps = showFrames / ((now - showStart) / 1000);
    frameMs = showMs / Math.max(1, showFrames);
    fpsMin = fpsMin === 0 ? fps : Math.min(fpsMin, fps);
    showFrames = 0;
    showMs = 0;
    showStart = now;
    publish(fishCount);
  }
  if (bucketMs >= 5000) {
    const avg = bucketFrames / (bucketMs / 1000);
    bucketFrames = 0;
    bucketMs = 0;
    fpsMin = fps;
    if (pinned === 'auto' && (didStep === false || now - lastSwitch > 8000)) {
      const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      const next = nextQuality(quality, avg, mem, reduced);
      if (next !== quality) {
        quality = next;
        didStep = true;
        scenery = '';
        lastSwitch = now;
      }
    }
  }
}

function publish(fish: number): void {
  const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  const stats = {
    fps: Math.round(fps * 10) / 10,
    fpsMin: Math.round(fpsMin * 10) / 10,
    frameMs: Math.round(frameMs * 10) / 10,
    quality,
    dpr: Math.round(dpr * 100) / 100,
    draws,
    fish,
    ready,
    w: viewW,
    h: viewH,
    heap: heap ?? null,
  };
  (window as unknown as { __BE__?: typeof stats }).__BE__ = stats;
  const box = document.querySelector('[data-be-perf]') as HTMLElement | null;
  if (!box) return;
  const show = new URLSearchParams(location.search).has('bePerf');
  box.hidden = !show;
  if (show) {
    box.textContent = `${stats.fps} fps · ${stats.frameMs} ms · ${quality} · ${viewW}×${viewH} · vẽ ${draws} · cá ${fish}`;
  }
}
