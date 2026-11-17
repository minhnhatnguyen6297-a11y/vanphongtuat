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
 * Ao cá V2 — thông số bọt (DESIGN-DECISIONS-V2.md, hướng A).
 * Chỗ chỉnh khi máy yếu: giảm EVENT_BUBBLE_CAP 26→12–16; giảm FEED_BURST_MAX trước;
 * giữ AMBIENT_BUBBLES = 0.
 */
const BG_DEFAULT = '/art/be/hang-da-v2.png';
const BG_TONE = 'rgba(3, 23, 37, 0.24)'; /* #031725 ~24% */
const FISH_KEY = 'hng_be_fish_v1';
const BG_KEY = 'hng_be_bg_v2';
const MAX_FISH = 8;
const SPRITE_W = 128;
const SPRITE_H = 68;

/** Cùng lúc tối đa sau cho ăn (sheet tham chiếu). */
const EVENT_BUBBLE_CAP = 26;
/** Sinh mỗi lần cho ăn. */
const FEED_BURST_MIN = 8;
const FEED_BURST_MAX = 26;
/** Xua: cụm thưa hơn. */
const SCARE_BURST_MIN = 4;
const SCARE_BURST_MAX = 10;
/** Đường kính px: xa 2–3; gần 4–6 (hiếm 7–9). Mẫu: 2.3 / 3.2 / 4.1 / 5.8 / 7.5 */
const BUBBLE_DIAMS = [2.3, 3.2, 4.1, 5.8, 7.5] as const;
/** Opacity xa 0.32–0.44; gần 0.62–0.70 */
const FAR_ALPHA = [0.32, 0.44] as const;
const NEAR_ALPHA = [0.62, 0.7] as const;
/** Thời gian tồn tại 0.8–1.8 s. */
const LIFE_MIN = 0.8;
const LIFE_MAX = 1.8;
/** Không suối ambient. */
const AMBIENT_BUBBLES = 0;

type SavedFish = { id: string; png: string; depth: number; phase: number };

/** Bọt sự kiện: không viền, không quầng, ruột trong + phản sáng lệch. */
type EventBubble = {
  x: number;
  y: number;
  r: number;
  alpha: number;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  phase: number;
};

type Mote = { x: number; y: number; z: number; v: number; phase: number };

function unit(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pickDiam(far: boolean): number {
  if (far) return BUBBLE_DIAMS[Math.random() < 0.55 ? 0 : 1]!;
  const roll = Math.random();
  if (roll < 0.42) return BUBBLE_DIAMS[2]!;
  if (roll < 0.82) return BUBBLE_DIAMS[3]!;
  return BUBBLE_DIAMS[4]!; /* hiếm 7.5 */
}

function pickAlpha(far: boolean): number {
  const [lo, hi] = far ? FAR_ALPHA : NEAR_ALPHA;
  return lerp(lo, hi, Math.random());
}

export function readLocalFish(): { id: string; png: string }[] {
  return readSaved().map((f) => ({ id: f.id, png: f.png }));
}

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

function readBgSrc(): string {
  try {
    const custom = localStorage.getItem(BG_KEY);
    if (custom && custom.startsWith('data:image/')) return custom;
  } catch {
    /* keep default */
  }
  return BG_DEFAULT;
}

export class Tank {
  private view: HTMLCanvasElement | null = null;
  private raf = 0;
  private lastMs = 0;
  private observer: ResizeObserver | null = null;
  private cssW = 640;
  private cssH = 280;
  private records: SavedFish[] = [];
  private owners = new Map<string, string>();
  private swimmers: Swimmer[] = [];
  private sprites = new Map<string, HTMLImageElement>();
  private bg: HTMLImageElement | null = null;
  /** Bọt sự kiện — chỉnh EVENT_BUBBLE_CAP / FEED_* / LIFE_* ở đầu file. */
  private eventBubbles: EventBubble[] = [];
  private motes: Mote[] = [];
  private sprite = document.createElement('canvas');
  private reduceMotion = false;
  private pointerMode: 'none' | 'feed' | 'scare' = 'none';

  constructor() {
    this.sprite.width = SPRITE_W;
    this.sprite.height = SPRITE_H;
    this.records = [];
    this.seedMotes();
    void this.loadBg(readBgSrc());
    if (typeof matchMedia === 'function') {
      this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    // giữ chỗ cho ambient = 0 (không đẩy bọt liên tục)
    void AMBIENT_BUBBLES;
  }

  get count(): number {
    return this.records.length;
  }

  get mode(): 'none' | 'feed' | 'scare' {
    return this.pointerMode;
  }

  setMode(mode: 'none' | 'feed' | 'scare'): void {
    this.pointerMode = mode;
  }

  attach(canvas: HTMLCanvasElement): void {
    this.view = canvas;
    this.observer?.disconnect();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.ensureLoop();
  }

  /** Đổi nền (data URL hoặc đường dẫn public). */
  async setBackground(src: string): Promise<void> {
    try {
      if (src.startsWith('data:image/')) localStorage.setItem(BG_KEY, src);
      else localStorage.removeItem(BG_KEY);
    } catch {
      /* in-memory ok */
    }
    await this.loadBg(src.startsWith('data:image/') ? src : BG_DEFAULT);
  }

  resetBackground(): void {
    void this.setBackground(BG_DEFAULT);
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

  /** Cá chung từ server. Không ghi lại localStorage. */
  setShared(list: Array<{ id: string; png: string; ownerId: string }>): void {
    const next = new Set(list.map((f) => f.id));
    this.owners = new Map(list.map((f) => [f.id, f.ownerId]));
    for (const id of [...this.sprites.keys()]) {
      if (!next.has(id)) this.sprites.delete(id);
    }
    this.swimmers = this.swimmers.filter((s) => next.has(s.id));
    this.records = this.records.filter((r) => next.has(r.id));
    for (const f of list) {
      if (this.records.some((r) => r.id === f.id)) continue;
      const rec: SavedFish = {
        id: f.id,
        png: f.png,
        depth: 0.25 + unit(f.id) * 0.7,
        phase: unit(`${f.id}p`) * Math.PI * 2,
      };
      this.records.push(rec);
      this.spawn(rec, true);
    }
  }

  rows(): Array<{ id: string; ownerId: string }> {
    return this.records.map((r) => ({ id: r.id, ownerId: this.owners.get(r.id) || '' }));
  }

  /** Cho ăn tại toạ độ CSS của canvas. */
  feedAt(cssX: number, cssY: number): void {
    const n = FEED_BURST_MIN + Math.floor(Math.random() * (FEED_BURST_MAX - FEED_BURST_MIN + 1));
    this.spawnBurst(cssX, cssY, n, 0);
    for (const s of this.swimmers) {
      if (Math.random() > 0.55) continue;
      s.tx = cssX + (Math.random() - 0.5) * 40;
      s.ty = cssY + (Math.random() - 0.5) * 40;
    }
  }

  /** Xua: cụm thưa, lệch hướng rời. */
  scareAt(cssX: number, cssY: number): void {
    const n = SCARE_BURST_MIN + Math.floor(Math.random() * (SCARE_BURST_MAX - SCARE_BURST_MIN + 1));
    this.spawnBurst(cssX, cssY, n, 1);
    for (const s of this.swimmers) {
      const dx = s.x - cssX;
      const dy = s.y - cssY;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 180) continue;
      const push = 90 + Math.random() * 70;
      s.tx = s.x + (dx / d) * push;
      s.ty = s.y + (dy / d) * push;
    }
  }

  handlePointer(cssX: number, cssY: number): void {
    if (this.pointerMode === 'feed') this.feedAt(cssX, cssY);
    else if (this.pointerMode === 'scare') this.scareAt(cssX, cssY);
  }

  private spawnBurst(cx: number, cy: number, count: number, scare: 0 | 1): void {
    const room = Math.max(0, EVENT_BUBBLE_CAP - this.eventBubbles.length);
    const n = Math.min(count, room || EVENT_BUBBLE_CAP);
    if (room === 0) this.eventBubbles.splice(0, n);
    for (let i = 0; i < n; i++) {
      const far = Math.random() < 0.45;
      const ang = Math.random() * Math.PI * 2;
      const dist = scare ? 8 + Math.random() * 36 : Math.random() * 28;
      const speed = scare ? 28 + Math.random() * 40 : 12 + Math.random() * 22;
      const life = LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN);
      this.eventBubbles.push({
        x: cx + Math.cos(ang) * dist,
        y: cy + Math.sin(ang) * dist * 0.7,
        r: pickDiam(far) / 2,
        alpha: pickAlpha(far),
        life,
        maxLife: life,
        vx: Math.cos(ang) * speed * (scare ? 1.2 : 0.35),
        vy: -Math.abs(Math.sin(ang + 0.4)) * speed - (scare ? 10 : 18),
        phase: Math.random() * Math.PI * 2,
      });
    }
    if (this.eventBubbles.length > EVENT_BUBBLE_CAP) {
      this.eventBubbles.splice(0, this.eventBubbles.length - EVENT_BUBBLE_CAP);
    }
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

  private seedMotes(): void {
    for (let i = 0; i < 18; i++) {
      this.motes.push({
        x: Math.random(),
        y: 0.15 + Math.random() * 0.7,
        z: Math.random(),
        v: 4 + Math.random() * 8,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private async loadBg(src: string): Promise<void> {
    try {
      this.bg = await loadImage(src);
    } catch {
      if (src !== BG_DEFAULT) {
        try {
          this.bg = await loadImage(BG_DEFAULT);
        } catch {
          this.bg = null;
        }
      } else this.bg = null;
    }
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
    return {
      minX: this.cssW * 0.06,
      maxX: this.cssW * 0.94,
      minY: this.cssH * 0.12,
      maxY: this.cssH * 0.88,
    };
  }

  private step(dt: number, time: number): void {
    const bounds = this.bounds();
    for (const s of this.swimmers) {
      s.tx = Math.min(bounds.maxX, Math.max(bounds.minX, s.tx));
      s.ty = Math.min(bounds.maxY, Math.max(bounds.minY, s.ty));
      stepSwimmer(s, dt, Math.random, bounds, 78);
    }
    for (const b of this.eventBubbles) {
      b.life -= dt;
      b.x += b.vx * dt + Math.sin(time * 3 + b.phase) * 6 * dt;
      b.y += b.vy * dt;
      b.vy -= 8 * dt;
      b.vx *= 0.98;
    }
    this.eventBubbles = this.eventBubbles.filter((b) => b.life > 0);
    for (const m of this.motes) {
      m.y -= (m.v * (0.4 + m.z) * dt) / this.cssH;
      m.x += (Math.sin(time + m.phase) * 6 * dt) / this.cssW;
      if (m.y < 0.05) {
        m.y = 0.9;
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

    g.clearRect(0, 0, w, h);
    if (this.bg) {
      // cover 50% 50%
      const iw = this.bg.naturalWidth || w;
      const ih = this.bg.naturalHeight || h;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      g.drawImage(this.bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      const wash = g.createLinearGradient(0, 0, 0, h);
      wash.addColorStop(0, '#0a3a4a');
      wash.addColorStop(1, '#031725');
      g.fillStyle = wash;
      g.fillRect(0, 0, w, h);
    }
    g.fillStyle = BG_TONE;
    g.fillRect(0, 0, w, h);

    // caustic shimmer nhẹ (không blur toàn màn)
    g.save();
    g.globalAlpha = 0.08 + Math.sin(time * 0.7) * 0.03;
    g.fillStyle = 'rgba(180, 230, 255, 0.5)';
    for (let i = 0; i < 4; i++) {
      const y = h * (0.15 + i * 0.18) + Math.sin(time * 1.1 + i) * 10;
      g.beginPath();
      g.ellipse(w * (0.2 + (i % 3) * 0.25), y, w * 0.18, 18, Math.sin(time + i) * 0.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    this.drawMotes(g, w, h);

    const ordered = this.swimmers.slice().sort((a, b) => a.depth - b.depth);
    for (const s of ordered) this.drawFish(g, s, time);

    this.drawEventBubbles(g);

    if (this.swimmers.length === 0) {
      g.fillStyle = 'rgba(240, 248, 255, 0.72)';
      g.font = '600 15px "Be Vietnam Pro", system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('Thả tranh của bạn vào ao', w / 2, h * 0.5);
    }
  }

  private drawMotes(g: CanvasRenderingContext2D, w: number, h: number): void {
    for (const m of this.motes) {
      g.globalAlpha = 0.12 + m.z * 0.22;
      g.fillStyle = 'rgba(220, 240, 248, 0.9)';
      g.beginPath();
      g.arc(m.x * w, m.y * h, 0.8 + m.z * 1.2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  private drawEventBubbles(g: CanvasRenderingContext2D): void {
    for (const b of this.eventBubbles) {
      const fade = Math.min(1, b.life / Math.min(0.35, b.maxLife * 0.35));
      const birth = 1 - Math.min(1, (b.maxLife - b.life) / 0.12);
      const a = b.alpha * fade * (0.55 + 0.45 * (1 - birth));
      g.save();
      g.globalAlpha = a;
      // ruột trong — không stroke / không quầng
      const grd = g.createRadialGradient(
        b.x - b.r * 0.35,
        b.y - b.r * 0.4,
        b.r * 0.05,
        b.x,
        b.y,
        b.r,
      );
      grd.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      grd.addColorStop(0.35, 'rgba(220, 240, 255, 0.35)');
      grd.addColorStop(0.75, 'rgba(180, 210, 230, 0.12)');
      grd.addColorStop(1, 'rgba(180, 210, 230, 0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.fill();
      // phản sáng lệch
      g.globalAlpha = a * 0.9;
      g.fillStyle = 'rgba(255, 255, 255, 0.75)';
      g.beginPath();
      g.ellipse(b.x - b.r * 0.28, b.y - b.r * 0.32, b.r * 0.22, b.r * 0.14, -0.4, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
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

    const squash = liveSquash(s);
    g.save();
    g.translate(s.x, s.y);
    g.rotate(headPitch(s) * s.facing);
    // không phóng to sprite lúc quay — chỉ co ngang nhẹ
    g.scale(s.facing * turnWidthScale(squash) * look.scale, look.scale);
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
