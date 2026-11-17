import { loadImage } from './image.js';
import {
  depthLook,
  headTilt,
  pickTarget,
  stepSwimmer,
  tailWag,
  turnSquash,
  turnWidthScale,
  type Bounds,
  type Swimmer,
} from './motion.js';

/**
 * Background layers are the approved tank art from PR #7
 * (commit 474626b), copied as static files. That branch is not merged.
 */
const ART = {
  room: '/art/be/room.b03f0b8cb190.png',
  water: '/art/be/water.5f0d9e6f5c7a.png',
  caustics: '/art/be/caustics.bd905211b540.png',
  rays: '/art/be/rays.efd347570c5e.png',
  kelp: '/art/be/kelp.9b609ec82b2a.png',
  sand: [
    '/art/be/sand-0.2626c7020d11.png',
    '/art/be/sand-1.97eb1df0066c.png',
    '/art/be/sand-2.263ed082fdee.png',
  ],
  rocks: [
    '/art/be/rocks-0.2effc4e2b74e.png',
    '/art/be/rocks-1.9efd9a247f31.png',
    '/art/be/rocks-2.e913b51f83b0.png',
  ],
  wood: '/art/be/wood.62d65217c747.png',
};

const FISH_KEY = 'hng_be_fish_v1';
const MAX_FISH = 8;
const WATER_LEVEL = 0.78;
const SPRITE_W = 128;
const SPRITE_H = 68;

type SavedFish = { id: string; png: string; depth: number; phase: number };
type Bubble = { x: number; y: number; r: number; v: number; phase: number };
type Mote = { x: number; y: number; z: number; v: number; phase: number };

type ArtSet = {
  room?: HTMLImageElement;
  water?: HTMLImageElement;
  caustics?: HTMLImageElement;
  rays?: HTMLImageElement;
  kelp?: HTMLImageElement;
  sand: HTMLImageElement[];
  rocks: HTMLImageElement[];
  wood?: HTMLImageElement;
};

function readSaved(): SavedFish[] {
  try {
    const raw = localStorage.getItem(FISH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedFish[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((f) => f && typeof f.png === 'string' && typeof f.id === 'string').slice(0, MAX_FISH);
  } catch {
    return [];
  }
}

export class Tank {
  private view: HTMLCanvasElement | null = null;
  private raf = 0;
  private lastMs = 0;
  private observer: ResizeObserver | null = null;
  private cssW = 640;
  private cssH = 280;
  private records: SavedFish[] = [];
  private swimmers: Swimmer[] = [];
  private sprites = new Map<string, HTMLImageElement>();
  private art: ArtSet = { sand: [], rocks: [] };
  private bubbles: Bubble[] = [];
  private motes: Mote[] = [];
  private sprite = document.createElement('canvas');
  private reduceMotion = false;

  constructor() {
    this.sprite.width = SPRITE_W;
    this.sprite.height = SPRITE_H;
    this.records = readSaved();
    for (const rec of this.records) this.spawn(rec, false);
    this.seedWaterBits();
    void this.loadArt();
    if (typeof matchMedia === 'function') {
      this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  get count(): number {
    return this.records.length;
  }

  attach(canvas: HTMLCanvasElement): void {
    this.view = canvas;
    this.observer?.disconnect();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.ensureLoop();
  }

  addFish(png: string): 'ok' | 'full' {
    if (this.records.length >= MAX_FISH) return 'full';
    const rec: SavedFish = {
      id: `f${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
      png,
      depth: 0.2 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
    };
    this.records.push(rec);
    this.persist();
    this.spawn(rec, true);
    return 'ok';
  }

  removeLast(): void {
    const rec = this.records.pop();
    if (!rec) return;
    this.swimmers = this.swimmers.filter((s) => s.id !== rec.id);
    this.sprites.delete(rec.id);
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(FISH_KEY, JSON.stringify(this.records));
    } catch {
      /* in-memory fish still swim this session */
    }
  }

  private spawn(rec: SavedFish, atEdge: boolean): void {
    const bounds = this.bounds();
    const start = pickTarget(Math.random, bounds);
    const swimmer: Swimmer = {
      id: rec.id,
      x: atEdge ? bounds.minX + 8 : start.x,
      y: start.y,
      tx: start.x,
      ty: start.y,
      depth: rec.depth,
      facing: Math.random() < 0.5 ? -1 : 1,
      phase: rec.phase,
      turn: null,
    };
    const goal = pickTarget(Math.random, bounds);
    swimmer.tx = goal.x;
    swimmer.ty = goal.y;
    this.swimmers.push(swimmer);
    void loadImage(rec.png)
      .then((img) => {
        this.sprites.set(rec.id, img);
      })
      .catch(() => {
        /* skip a sprite that no longer decodes */
      });
  }

  private seedWaterBits(): void {
    for (let i = 0; i < 12; i++) {
      this.bubbles.push({
        x: Math.random(),
        y: Math.random(),
        r: 2 + Math.random() * 4,
        v: 18 + Math.random() * 28,
        phase: Math.random() * Math.PI * 2,
      });
    }
    for (let i = 0; i < 22; i++) {
      this.motes.push({
        x: Math.random(),
        y: 0.2 + Math.random() * 0.6,
        z: Math.random(),
        v: 6 + Math.random() * 10,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private async loadArt(): Promise<void> {
    const take = (src: string) => loadImage(src).catch(() => undefined);
    const [room, water, caustics, rays, kelp, wood, ...rest] = await Promise.all([
      take(ART.room),
      take(ART.water),
      take(ART.caustics),
      take(ART.rays),
      take(ART.kelp),
      take(ART.wood),
      ...ART.sand.map(take),
      ...ART.rocks.map(take),
    ]);
    this.art = {
      room,
      water,
      caustics,
      rays,
      kelp,
      wood,
      sand: rest.slice(0, ART.sand.length).filter((img): img is HTMLImageElement => !!img),
      rocks: rest.slice(ART.sand.length).filter((img): img is HTMLImageElement => !!img),
    };
  }

  private ensureLoop(): void {
    if (this.raf) return;
    this.lastMs = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (!this.view || !this.view.isConnected) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        return;
      }
      const dt = Math.min(0.05, (now - this.lastMs) / 1000);
      this.lastMs = now;
      const step = this.reduceMotion ? dt * 0.15 : dt;
      this.step(step, now / 1000);
      this.draw(now / 1000);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private resize(): void {
    const canvas = this.view;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.cssW = Math.max(200, rect.width);
    this.cssH = Math.max(160, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(this.cssW * dpr);
    const bh = Math.round(this.cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
  }

  private bounds(): Bounds {
    const surface = this.cssH * (1 - WATER_LEVEL);
    const sandH = Math.min(this.cssH * 0.2, 72);
    return {
      minX: this.cssW * 0.08,
      maxX: this.cssW * 0.92,
      minY: surface + 18,
      maxY: this.cssH - sandH - 10,
    };
  }

  private step(dt: number, time: number): void {
    const bounds = this.bounds();
    for (const s of this.swimmers) {
      stepSwimmer(s, dt, Math.random, bounds, 78);
    }
    const surface = this.cssH * (1 - WATER_LEVEL);
    for (const b of this.bubbles) {
      b.y -= (b.v * dt) / this.cssH;
      b.x += (Math.sin(time * 2 + b.phase) * 10 * dt) / this.cssW;
      if (b.y < surface / this.cssH) {
        b.y = 0.9 + Math.random() * 0.08;
        b.x = 0.08 + Math.random() * 0.84;
      }
    }
    for (const m of this.motes) {
      m.y -= (m.v * (0.4 + m.z) * dt) / this.cssH;
      m.x += (Math.sin(time + m.phase) * 8 * dt) / this.cssW;
      if (m.y < surface / this.cssH) {
        m.y = 0.82;
        m.x = Math.random();
      }
    }
  }

  private draw(time: number): void {
    const canvas = this.view;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const dpr = canvas.width / this.cssW;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = this.cssW;
    const h = this.cssH;
    const surface = h * (1 - WATER_LEVEL);

    g.clearRect(0, 0, w, h);
    if (this.art.room) g.drawImage(this.art.room, 0, 0, w, h);
    else {
      g.fillStyle = '#F6D6B8';
      g.fillRect(0, 0, w, h);
    }
    if (this.art.water) g.drawImage(this.art.water, 0, surface - 8, w, h - surface + 16);
    else {
      const wash = g.createLinearGradient(0, surface, 0, h);
      wash.addColorStop(0, '#3AA8B4');
      wash.addColorStop(1, '#0E4E58');
      g.fillStyle = wash;
      g.fillRect(0, surface, w, h - surface);
    }

    this.drawCaustics(g, surface, w, h, time);
    if (this.art.rays) {
      g.save();
      g.globalAlpha = 0.28;
      g.drawImage(this.art.rays, Math.sin(time * 0.35) * 16, surface, w, h - surface);
      g.restore();
    }

    const sandH = Math.min(h * 0.2, 72);
    const sandY = h - sandH;
    const sand = this.art.sand[Math.floor(time / 0.45) % Math.max(1, this.art.sand.length)];
    if (sand) g.drawImage(sand, 0, sandY, w, sandH);

    const rock = this.art.rocks[Math.floor(time / 0.7) % Math.max(1, this.art.rocks.length)];
    if (rock) {
      g.drawImage(rock, w * 0.08, sandY - h * 0.08, w * 0.18, h * 0.16);
      g.drawImage(rock, w * 0.7, sandY - h * 0.06, w * 0.16, h * 0.13);
    }
    if (this.art.kelp) {
      const sway = Math.sin(time * 0.8) * 8;
      g.drawImage(this.art.kelp, sway, surface, w * 0.22, h - surface);
      g.drawImage(this.art.kelp, w * 0.62 - sway, surface, w * 0.18, (h - surface) * 0.85);
    }

    const ordered = this.swimmers.slice().sort((a, b) => a.depth - b.depth);
    for (const s of ordered) this.drawFish(g, s, time);

    this.drawBits(g, surface, w, h, time);

    if (this.art.wood) g.drawImage(this.art.wood, w * 0.38, sandY - h * 0.12, w * 0.22, h * 0.16);

    if (this.swimmers.length === 0) {
      g.fillStyle = '#FDF7EB';
      g.font = '600 14px "Be Vietnam Pro", sans-serif';
      g.textAlign = 'center';
      g.fillText('Thả tranh của bạn vào bể', w / 2, surface + (sandY - surface) / 2);
    }
  }

  private drawCaustics(
    g: CanvasRenderingContext2D,
    surface: number,
    w: number,
    h: number,
    time: number,
  ): void {
    g.save();
    g.beginPath();
    g.rect(0, surface, w, h - surface);
    g.clip();
    g.globalAlpha = 0.4;
    if (this.art.caustics) {
      const pattern = g.createPattern(this.art.caustics, 'repeat');
      if (pattern) {
        g.fillStyle = pattern;
        g.translate((Math.sin(time * 0.6) * 24) % 256, (time * 18) % 256);
        g.fillRect(-256, surface - 256, w + 512, h + 512);
      }
    } else {
      g.strokeStyle = 'rgba(230, 255, 246, 0.35)';
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        const y = surface + 20 + i * 28 + Math.sin(time * 1.4 + i) * 6;
        g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y - 10, w * 0.6, y + 12, w, y);
        g.stroke();
      }
    }
    g.restore();
  }

  private drawFish(g: CanvasRenderingContext2D, s: Swimmer, time: number): void {
    const img = this.sprites.get(s.id);
    if (!img) return;
    const look = depthLook(s.depth);
    const wag = tailWag(time, s.phase);
    const off = this.sprite.getContext('2d');
    if (!off) return;
    off.setTransform(1, 0, 0, 1, 0, 0);
    off.clearRect(0, 0, SPRITE_W, SPRITE_H);
    off.save();
    off.translate(SPRITE_W / 2, SPRITE_H / 2);
    this.drawWagging(off, img, SPRITE_W, SPRITE_H, wag);
    off.restore();
    if (look.tint > 0.02) {
      off.globalCompositeOperation = 'source-atop';
      off.fillStyle = `rgba(64, 140, 160, ${look.tint})`;
      off.fillRect(0, 0, SPRITE_W, SPRITE_H);
      off.globalCompositeOperation = 'source-over';
    }

    g.save();
    g.translate(s.x, s.y);
    g.rotate(headPitch(s));
    g.scale(s.facing * turnWidthScale(liveSquash(s)) * look.scale, (1 + 0.12 * liveSquash(s)) * look.scale);
    g.globalAlpha = look.alpha;
    if (look.blurPx >= 0.7) g.filter = `blur(${look.blurPx.toFixed(2)}px)`;
    g.drawImage(this.sprite, -SPRITE_W / 2, -SPRITE_H / 2);
    g.restore();
  }

  private drawWagging(
    g: CanvasRenderingContext2D,
    img: CanvasImageSource,
    fw: number,
    fh: number,
    wag: number,
  ): void {
    const tailW = fw * 0.38;
    g.save();
    g.beginPath();
    g.rect(-fw / 2 + tailW * 0.72, -fh / 2, fw, fh);
    g.clip();
    g.drawImage(img, -fw / 2, -fh / 2, fw, fh);
    g.restore();
    g.save();
    g.translate(-fw / 2 + tailW * 0.72, 0);
    g.rotate(wag);
    g.translate(fw / 2 - tailW * 0.72, 0);
    g.beginPath();
    g.rect(-fw / 2, -fh / 2, tailW * 0.86, fh);
    g.clip();
    g.drawImage(img, -fw / 2, -fh / 2, fw, fh);
    g.restore();
  }

  private drawBits(
    g: CanvasRenderingContext2D,
    surface: number,
    w: number,
    h: number,
    time: number,
  ): void {
    g.save();
    g.beginPath();
    g.rect(0, surface, w, h - surface);
    g.clip();
    for (const m of this.motes) {
      const far = 1 - m.z;
      g.globalAlpha = 0.25 + m.z * 0.45;
      g.fillStyle = far > 0.55 ? 'rgba(150, 198, 206, 0.9)' : 'rgba(244, 252, 250, 0.95)';
      const r = 1 + m.z * 1.6;
      g.beginPath();
      g.arc(m.x * w, m.y * h, r, 0, Math.PI * 2);
      g.fill();
    }
    for (const b of this.bubbles) {
      const x = b.x * w + Math.sin(time * 2 + b.phase) * 3;
      const y = b.y * h;
      g.globalAlpha = 0.55;
      g.strokeStyle = 'rgba(244, 252, 255, 0.85)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x, y, b.r, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }
}

function liveSquash(s: Swimmer): number {
  if (!s.turn) return 0;
  return turnSquash(s.turn.elapsed / s.turn.dur);
}

function headPitch(s: Swimmer): number {
  const dy = s.ty - s.y;
  const dx = Math.abs(s.tx - s.x) || 1;
  return headTilt(Math.atan2(dy, dx)) * 0.85;
}

let tankSingleton: Tank | null = null;

export function fishTank(): Tank {
  if (!tankSingleton) tankSingleton = new Tank();
  return tankSingleton;
}
