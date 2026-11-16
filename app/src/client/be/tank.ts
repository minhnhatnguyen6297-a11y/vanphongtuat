import {
  canEat,
  fishPose,
  hashId,
  resolveLight,
  stepQuality,
  tierDpr,
  tierFrameMs,
  tierInternalScale,
  type Kind,
  type LightName,
  type SimPellet,
  type Swim,
  type Tier,
} from '../../shared/be.js';

export type CreatureView = {
  id: string;
  kind: Kind;
  swim: Swim;
  wave: boolean;
  growth: number;
  x: number;
  y: number;
  hidden: boolean;
  img: CanvasImageSource | null;
};

export type TankModel = {
  sand: number;
  lighting: LightName;
  waterLevel: number;
  rocks: number;
  wood: boolean;
  dirt: number;
  creatures: CreatureView[];
  pellets: SimPellet[];
  foodImg: CanvasImageSource | null;
  now: () => number;
  fx: {
    hold: boolean;
    pointer: number;
    drag: { id: string; x: number; y: number } | null;
    lure: { x: number; y: number; until: number } | null;
    startleUntil: number;
    vacuum: { x: number; y: number; until: number } | null;
  };
};

type Manifest = {
  layers: {
    room: string;
    water: string;
    caustics: string;
    rays: string;
    kelp: string;
    sand: string[];
    rocks: string[];
    wood: string;
    bubbles: string;
  };
};

type Assets = {
  room?: CanvasImageSource;
  water?: CanvasImageSource;
  caustics?: CanvasImageSource;
  rays?: CanvasImageSource;
  kelp?: CanvasImageSource;
  sand: CanvasImageSource[];
  rocks: CanvasImageSource[];
  wood?: CanvasImageSource;
  bubbles?: CanvasImageSource;
};

export type Hit = { id: string; x: number; y: number; r: number };

declare global {
  interface Window {
    __BE_STATS__?: Record<string, number | string>;
    __BE_FORCE_TIER?: Tier | '';
  }
}

const assets: Assets = { sand: [], rocks: [] };
let assetsStarted = false;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

async function loadAssets(): Promise<void> {
  if (assetsStarted) return;
  assetsStarted = true;
  try {
    const res = await fetch('/art/be/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const man = (await res.json()) as Manifest;
    const L = man.layers;
    const take = async (url: string) => loadImage(url).catch(() => undefined);
    const [room, water, caustics, rays, kelp, wood, bubbles, ...rest] = await Promise.all([
      take(L.room),
      take(L.water),
      take(L.caustics),
      take(L.rays),
      take(L.kelp),
      take(L.wood),
      take(L.bubbles),
      ...L.sand.map(take),
      ...L.rocks.map(take),
    ]);
    assets.room = room;
    assets.water = water;
    assets.caustics = caustics;
    assets.rays = rays;
    assets.kelp = kelp;
    assets.wood = wood;
    assets.bubbles = bubbles;
    assets.sand = rest.slice(0, L.sand.length).filter((x): x is HTMLImageElement => !!x);
    assets.rocks = rest.slice(L.sand.length).filter((x): x is HTMLImageElement => !!x);
  } catch {
    /* nền thủ tục vẫn vẽ được */
  }
}

type Bubble = { x: number; y: number; r: number; v: number; f: number };

export type TankHandle = {
  stop: () => void;
  setHold: (on: boolean) => void;
  poke: () => void;
  hits: () => Hit[];
};

export function startTank(
  canvas: HTMLCanvasElement,
  model: TankModel,
  onEat: (pelletId: string, fishId: string) => void,
): TankHandle {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('canvas');
  void loadAssets();

  let tier: Tier = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'tinh' : 'vua';
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let running = false;
  let lastDraw = 0;
  let frozen = model.now();
  const hits: Hit[] = [];
  const bubbles: Bubble[] = Array.from({ length: 12 }, (_, i) => ({
    x: (hashId('b' + i) % 1000) / 1000,
    y: (hashId('y' + i) % 1000) / 1000,
    r: 3 + (i % 4) * 2.2,
    v: 0.00008 + (i % 5) * 0.00003,
    f: i % 4,
  }));
  const fpsSamples: number[] = [];
  let fpsStamp = performance.now();
  let draws = 0;

  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    model.fx.pointer = ((e.clientX - r.left) / r.width) * 2 - 1;
  };
  canvas.addEventListener('pointermove', onPointer);

  function forced(): Tier | null {
    const f = window.__BE_FORCE_TIER;
    return f === 'cao' || f === 'vua' || f === 'nhe' || f === 'tinh' ? f : null;
  }

  function resize(): { w: number; h: number } {
    const cssW = Math.max(2, canvas.clientWidth || 800);
    const cssH = Math.max(2, canvas.clientHeight || 480);
    let dpr = tierDpr(tier, window.devicePixelRatio || 1) * tierInternalScale(tier);
    if (cssW * dpr > 1600) dpr = 1600 / cssW;
    const bw = Math.max(2, Math.round(cssW * dpr));
    const bh = Math.max(2, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx!.setTransform(bw / cssW, 0, 0, bh / cssH, 0, 0);
    return { w: cssW, h: cssH };
  }

  function draw(stamp: number): void {
    const t0 = performance.now();
    draws = 0;
    const { w, h } = resize();
    const now = model.fx.hold ? frozen : model.now();
    const light = resolveLight(model.lighting, now);
    const surface = h * (1 - Math.min(0.92, Math.max(0.55, model.waterLevel)));
    const drift = tier === 'tinh' ? 0 : Math.sin(now / 4200) * 12 + model.fx.pointer * 10;
    const g = ctx!;
    g.fillStyle = '#e7c4a4';
    g.fillRect(0, 0, w, h);
    draws++;
    if (assets.room) {
      g.drawImage(assets.room, drift * 0.35 - 20, 0, w + 40, h);
      draws++;
    } else {
      const sky = g.createLinearGradient(0, 0, 0, surface);
      sky.addColorStop(0, '#f6d7b8');
      sky.addColorStop(1, '#9fd0ea');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, surface + 8);
      draws++;
    }

    g.save();
    g.beginPath();
    g.rect(0, surface, w, h - surface);
    g.clip();
    if (assets.water) {
      g.drawImage(assets.water, 0, surface - 10, w, h - surface + 20);
      draws++;
    } else {
      const wg = g.createLinearGradient(0, surface, 0, h);
      wg.addColorStop(0, '#3aa8b0');
      wg.addColorStop(0.45, '#14687a');
      wg.addColorStop(1, '#0c3c48');
      g.fillStyle = wg;
      g.fillRect(0, surface, w, h - surface);
      draws++;
    }
    if (light === 'warm') {
      g.fillStyle = 'rgba(255, 150, 50, 0.12)';
      g.fillRect(0, surface, w, h - surface);
      draws++;
    } else if (light === 'night') {
      g.fillStyle = 'rgba(8, 16, 40, 0.4)';
      g.fillRect(0, surface, w, h - surface);
      draws++;
    }
    if ((tier === 'cao' || tier === 'vua') && assets.caustics) {
      const speed = tier === 'cao' ? 22 : 12;
      const ox = (now / speed) % 256;
      const oy = (now / (speed * 1.6)) % 256;
      g.save();
      g.globalAlpha = tier === 'cao' ? 0.38 : 0.22;
      g.globalCompositeOperation = 'lighter';
      const pat = g.createPattern(assets.caustics, 'repeat');
      if (pat) {
        g.translate(ox, oy);
        g.fillStyle = pat;
        g.fillRect(-ox, surface - oy, w + 256, h);
        draws++;
      }
      g.restore();
    }
    if (tier !== 'nhe' && tier !== 'tinh' && assets.rays) {
      g.save();
      g.globalAlpha = light === 'night' ? 0.14 : 0.42;
      g.globalCompositeOperation = 'lighter';
      g.drawImage(assets.rays, Math.sin(now / 2800) * 24, surface, w, h - surface);
      draws++;
      g.restore();
    }
    if (assets.kelp) {
      const kh = h - surface;
      g.drawImage(assets.kelp, drift * 0.8, surface, w * 0.34, kh);
      g.save();
      g.translate(w, 0);
      g.scale(-1, 1);
      g.globalAlpha = 0.9;
      g.drawImage(assets.kelp, drift * 0.5, surface, w * 0.28, kh);
      g.restore();
      draws += 2;
    }
    const sandH = Math.min(h * 0.28, 150);
    const sandY = h - sandH;
    const sandImg = assets.sand[model.sand] || assets.sand[0];
    if (sandImg) {
      g.drawImage(sandImg, -10, sandY, w + 20, sandH + 8);
      draws++;
    } else {
      g.fillStyle = model.sand === 2 ? '#b9894e' : model.sand === 1 ? '#f0ddb0' : '#e4c27a';
      g.fillRect(0, sandY, w, sandH);
      draws++;
    }
    const rock = assets.rocks[model.rocks] || assets.rocks[0];
    if (rock) {
      g.drawImage(rock, w * 0.06 + drift * 0.15, sandY - h * 0.12, w * 0.22, h * 0.2);
      g.drawImage(rock, w * 0.72, sandY - h * 0.08, w * 0.16, h * 0.14);
      draws += 2;
    }
    if (model.wood && assets.wood) {
      g.drawImage(assets.wood, w * 0.4, sandY - h * 0.16, w * 0.24, h * 0.2);
      draws++;
    }
    if (model.dirt > 0) {
      g.fillStyle = 'rgba(92, 58, 28, 0.55)';
      for (let i = 0; i < model.dirt; i++) {
        const sx = ((i * 137) % 100) / 100 * w;
        g.beginPath();
        g.ellipse(sx, h - 28 - (i % 3) * 9, 8, 3.5, 0, 0, Math.PI * 2);
        g.fill();
        draws++;
      }
    }
    g.restore();

    const creatures = model.creatures.filter((c) => !c.hidden && c.x != null);
    const plants = creatures.filter((c) => c.kind !== 'ca');
    const fish = creatures.filter((c) => c.kind === 'ca');
    hits.length = 0;
    const place = (c: CreatureView, poseX: number, poseY: number, fw: number, fh: number) => {
      hits.push({ id: c.id, x: poseX * w, y: poseY * h, r: Math.max(fw, fh) * 0.42 });
    };
    for (const c of plants) {
      const pose = fishPose(
        { id: c.id, kind: c.kind, swim: c.swim, wave: c.wave, x: c.x, y: c.y, growth: c.growth },
        now,
        [],
      );
      const fw = 130 * c.growth;
      const fh = 170 * c.growth;
      g.save();
      g.translate(pose.x * w, Math.min(h - 20, pose.y * h));
      g.rotate(pose.bend);
      if (c.img) g.drawImage(c.img, -fw / 2, -fh, fw, fh);
      else blob(g, fw, fh, '#1b7a43');
      draws++;
      g.restore();
      place(c, pose.x, pose.y, fw, fh * 0.5);
    }

    const segs: 1 | 3 = tier === 'nhe' || tier === 'tinh' ? 1 : 3;
    for (const c of fish) {
      const base = { id: c.id, kind: c.kind, swim: c.swim, wave: tier === 'nhe' || tier === 'tinh' ? false : c.wave, x: c.x, y: c.y, growth: c.growth };
      let pose = fishPose(base, now, model.pellets);
      if (model.fx.drag?.id === c.id) {
        pose = { ...pose, x: model.fx.drag.x, y: model.fx.drag.y, bend: 0 };
      } else if (model.fx.lure && now < model.fx.lure.until) {
        const d = Math.hypot(model.fx.lure.x - pose.x, model.fx.lure.y - pose.y);
        if (d < 0.34) {
          pose = {
            ...pose,
            x: pose.x + (model.fx.lure.x - pose.x) * 0.45,
            y: pose.y + (model.fx.lure.y - pose.y) * 0.45,
            facing: model.fx.lure.x >= pose.x ? 1 : -1,
          };
        }
      }
      if (now < model.fx.startleUntil) {
        const kick = ((hashId(c.id) % 7) - 3) * 0.012;
        pose = { ...pose, x: Math.min(0.94, Math.max(0.06, pose.x + kick)) };
      }
      const fw = 176 * c.growth;
      const fh = 90 * c.growth;
      g.save();
      g.translate(pose.x * w, pose.y * h);
      g.scale(pose.facing, 1);
      if (c.img && segs === 3) drawBent(g, c.img, fw, fh, pose.bend);
      else if (c.img) {
        g.rotate(pose.bend * 0.25);
        g.drawImage(c.img, -fw / 2, -fh / 2, fw, fh);
      } else blob(g, fw, fh, '#ffb703');
      draws += segs === 3 ? 3 : 1;
      g.restore();
      place(c, pose.x, pose.y, fw, fh);
      if (!model.fx.hold && tier !== 'tinh') {
        for (const p of model.pellets) {
          if (canEat(pose, p, now)) onEat(p.id, c.id);
        }
      }
    }

    for (const p of model.pellets) {
      if (p.eaten) continue;
      const age = Math.max(0, (now - p.bornAt) / 1000);
      const y = Math.min(0.84, 0.16 + age * 0.18);
      const px = p.x * w;
      const py = y * h;
      if (model.foodImg) {
        g.drawImage(model.foodImg, px - 14, py - 14, 28, 28);
        draws++;
      } else {
        g.fillStyle = '#e07a2f';
        g.beginPath();
        g.ellipse(px, py, 7, 5, 0.4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.beginPath();
        g.arc(px - 2, py - 1, 2, 0, Math.PI * 2);
        g.fill();
        draws += 2;
      }
    }

    if (tier === 'cao' || tier === 'vua') {
      const n = tier === 'cao' ? bubbles.length : 6;
      const sheet = assets.bubbles;
      for (let i = 0; i < n; i++) {
        const b = bubbles[i];
        if (!model.fx.hold) {
          b.y -= b.v * 16;
          if (b.y < 0.12) {
            b.y = 0.86;
            b.x = (b.x + 0.17) % 1;
          }
        }
        const bx = b.x * w + Math.sin(now / 800 + i) * 6;
        const by = surface + b.y * (h - surface);
        if (sheet) {
          g.drawImage(sheet, b.f * 32, 0, 32, 32, bx, by, b.r * 4, b.r * 4);
          draws++;
        } else {
          g.strokeStyle = 'rgba(255,255,255,0.55)';
          g.lineWidth = 1.4;
          g.beginPath();
          g.arc(bx, by, b.r, 0, Math.PI * 2);
          g.stroke();
          draws++;
        }
      }
    }

    if (tier !== 'tinh' && !model.fx.hold) {
      g.beginPath();
      for (let x = 0; x <= w; x += 18) {
        const y = surface + Math.sin(x * 0.02 + now / 480) * (tier === 'nhe' ? 0 : 2.4);
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokeStyle = 'rgba(230, 255, 248, 0.7)';
      g.lineWidth = 2;
      g.stroke();
      draws++;
    } else {
      g.strokeStyle = 'rgba(230, 255, 248, 0.45)';
      g.beginPath();
      g.moveTo(0, surface);
      g.lineTo(w, surface);
      g.stroke();
      draws++;
    }

    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 10;
    g.strokeRect(8, 8, w - 16, h - 16);
    draws++;
    const vig = g.createLinearGradient(0, 0, 28, 0);
    vig.addColorStop(0, 'rgba(0,0,0,0.18)');
    vig.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = vig;
    g.fillRect(0, 0, 28, h);
    draws++;

    if (model.fx.vacuum && now < model.fx.vacuum.until) {
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(model.fx.vacuum.x * w, model.fx.vacuum.y * h, 28, 0, Math.PI * 2);
      g.stroke();
      draws++;
    }

    const work = performance.now() - t0;
    const gap = stamp - fpsStamp;
    fpsStamp = stamp;
    if (gap > 0 && gap < 500) {
      fpsSamples.push(1000 / gap);
      if (fpsSamples.length > 40) fpsSamples.shift();
    }
    const avg = fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0;
    if (!forced() && fpsSamples.length >= 5 && performance.now() - lastDraw > 5000) {
      const next = stepQuality({
        tier,
        avgFps: avg,
        samples: fpsSamples.length,
        reducedMotion: reduced,
        deviceMemory,
      });
      fpsSamples.length = 0;
      lastDraw = performance.now();
      if (next !== tier) tier = next;
    }
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    window.__BE_STATS__ = {
      fps: Math.round(avg * 10) / 10,
      frameMs: Math.round(work * 10) / 10,
      tier,
      dpr: Math.round((canvas.width / (canvas.clientWidth || 1)) * 100) / 100,
      draws,
      heap: mem?.usedJSHeapSize ?? 0,
      fish: fish.length,
      w: canvas.width,
      h: canvas.height,
    };
  }

  function frame(t: number): void {
    const force = forced();
    if (force) tier = force;
    if (document.hidden || model.fx.hold || tier === 'tinh') {
      running = false;
      draw(t);
      return;
    }
    raf = requestAnimationFrame(frame);
    const min = tierFrameMs(tier);
    if (t - fpsStamp < min - 1 && fpsStamp > 0) return;
    draw(t);
  }

  function start(): void {
    if (running || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  const onVis = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!model.fx.hold && tier !== 'tinh') start();
    else draw(performance.now());
  };
  document.addEventListener('visibilitychange', onVis);
  draw(performance.now());
  if (tier !== 'tinh') start();

  return {
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointermove', onPointer);
    },
    setHold(on: boolean) {
      model.fx.hold = on;
      if (on) {
        frozen = model.now();
        running = false;
        cancelAnimationFrame(raf);
        draw(performance.now());
      } else if (tier !== 'tinh' && !document.hidden) start();
    },
    poke() {
      if (model.fx.hold) frozen = model.now();
      draw(performance.now());
      if (!running && !model.fx.hold && tier !== 'tinh' && !document.hidden) start();
    },
    hits: () => hits.slice(),
  };
}

function blob(g: CanvasRenderingContext2D, fw: number, fh: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(0, -fh * 0.15, fw / 2, fh / 2, 0, 0, Math.PI * 2);
  g.fill();
}

function drawBent(g: CanvasRenderingContext2D, img: CanvasImageSource, fw: number, fh: number, bend: number): void {
  const sw = SPRITE_SRC_W / 3;
  const slice = fw / 3;
  const overlap = slice * 0.28;
  const rots = [bend * 0.9, bend * 0.22, -bend * 0.1];
  for (let i = 0; i < 3; i++) {
    g.save();
    g.translate(-fw / 2 + slice * i + slice / 2, (i === 0 ? 1 : 0) * bend * 4);
    g.rotate(rots[i]);
    g.drawImage(img, i * sw, 0, sw, SPRITE_SRC_H, -slice / 2 - overlap / 2, -fh / 2, slice + overlap, fh);
    g.restore();
  }
}

const SPRITE_SRC_W = 192;
const SPRITE_SRC_H = 96;
