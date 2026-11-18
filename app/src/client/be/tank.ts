import { loadImage } from './image.js';
import {
  headTilt,
  pickTarget,
  stepSwimmer,
  turnDurationMs,
  type Bounds,
  type Facing,
  type Swimmer,
} from './motion.js';

/**
 * Ao cá V2 — thông số bọt (DESIGN-DECISIONS-V2.md, hướng A).
 * Chỗ chỉnh khi máy yếu: giảm EVENT_BUBBLE_CAP 26→12–16; giảm FEED_BURST_MAX trước;
 * giữ AMBIENT_BUBBLES = 0.
 */
const BG_DEFAULT = '/art/be/hang-da-v2.png';
const FISH_KEY = 'hng_be_fish_v1';
const BG_KEY = 'hng_be_bg_v2';
const MAX_FISH = 8;
const SHADOW = 48;

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
  private birthdays = new Map<string,string>();
  private fishRevision = 0;
  private swimmers: Swimmer[] = [];
  private sprites = new Map<string, HTMLCanvasElement>();
  private backgroundImg: HTMLImageElement | null = null;
  private backgroundSrc = readBgSrc();
  private readonly bubbleSprites = [4, 8, 12].map(size => bubbleSprite(size));
  private readonly shadowSprite = bubbleSprite(SHADOW, true);
  private sandMask: ImageData | null = null;
  /** Bọt sự kiện — chỉnh EVENT_BUBBLE_CAP / FEED_* / LIFE_* ở đầu file. */
  private eventBubbles: EventBubble[] = [];
  private motes: Mote[] = [];
  private reduceMotion = false;
  private pointerMode: 'none' | 'feed' | 'scare' = 'none';

  constructor() {
    this.records = [];
    this.seedMotes();

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

  get hasCustomBackground() { return this.backgroundSrc !== BG_DEFAULT; }

  attach(canvas: HTMLCanvasElement): void {
    this.view = canvas;
    canvas.dataset.aoRenderer='canvas2d';
    const host=canvas.parentElement;
    if(host) {
      let img=host.querySelector<HTMLImageElement>('[data-ao-bg]');
      if(!img) {
        img=document.createElement('img');
        img.dataset.aoBg='1';img.alt='';
        img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none';
        host.prepend(img);
      }
      this.backgroundImg=img;
      img.src=this.backgroundSrc;
      canvas.style.position='relative';
      this.loadSandMask();
    }
    this.observer?.disconnect();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.ensureLoop();
  }

  /** Đổi nền (data URL hoặc đường dẫn public). */
  async setBackground(src: string, remember = true): Promise<void> {
    try {
      if (remember) {
        if (src.startsWith('data:image/')) localStorage.setItem(BG_KEY, src);
        else localStorage.removeItem(BG_KEY);
      }
    } catch {
      /* in-memory ok */
    }
    this.backgroundSrc=src.startsWith('data:image/') ? src : BG_DEFAULT;
    if(this.backgroundImg?.isConnected) this.backgroundImg.src=this.backgroundSrc;
  }

  resetBackground(): void {
    void this.setBackground(BG_DEFAULT);
  }

  addFish(png: string): 'ok' | 'full' {
    if (this.records.length >= MAX_FISH) return 'full';
    const rec: SavedFish = {
      id: `f${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
      png,
      depth: 0.45 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
    };
    this.records.push(rec);
    this.birthdays.set(rec.id,new Date().toISOString());
    this.fishRevision++;
    this.persist();
    this.spawn(rec, true);
    return 'ok';
  }

  removeLast(): void {
    const rec = this.records.pop();
    if (!rec) return;
    this.swimmers = this.swimmers.filter((s) => s.id !== rec.id);
    this.sprites.delete(rec.id);
    this.birthdays.delete(rec.id);
    this.fishRevision++;
    this.persist();
  }

  /** Cá chung từ server. Không ghi lại localStorage. */
  setShared(list: Array<{ id: string; png: string; ownerId: string; createdAt: string }>): void {
    this.fishRevision++;
    this.birthdays = new Map(list.map(f=>[f.id,f.createdAt]));
    const next = new Set(list.map((f) => f.id));
    this.owners = new Map(list.map((f) => [f.id, f.ownerId]));
    for (const id of [...this.sprites.keys()]) {
      if (!next.has(id)) this.sprites.delete(id);
    }
    this.swimmers = this.swimmers.filter((s) => next.has(s.id));
    this.records = this.records.filter((r) => next.has(r.id));
    const initial = this.records.length === 0;
    for (const f of list) {
      if (this.records.some((r) => r.id === f.id)) continue;
      const rec: SavedFish = {
        id: f.id,
        png: f.png,
        depth: 0.45 + unit(f.id) * 0.55,
        phase: unit(`${f.id}p`) * Math.PI * 2,
      };
      this.records.push(rec);
      this.spawn(rec, !initial);
    }
  }

  get revision() { return this.fishRevision; }
  art() {
    return this.records.map(f=>({id:f.id,png:f.png,ownerId:this.owners.get(f.id)??'',
      createdAt:this.birthdays.get(f.id)??new Date(0).toISOString()}));
  }

  rows(): Array<{ id: string; ownerId: string }> {
    return this.records.map((r) => ({ id: r.id, ownerId: this.owners.get(r.id) || '' }));
  }

  /** Cho ăn tại toạ độ CSS của canvas — cá đổi hướng + bọt 8–26. */
  feedAt(cssX: number, cssY: number): void {
    const n = FEED_BURST_MIN + Math.floor(Math.random() * (FEED_BURST_MAX - FEED_BURST_MIN + 1));
    this.spawnBurst(cssX, cssY, n, 0);
    for (const s of this.active()) {
      const tx = cssX + (Math.random() - 0.5) * 36;
      const ty = cssY + (Math.random() - 0.5) * 36;
      this.retarget(s, tx, ty);
    }
  }

  /** Xua: cụm thưa 4–10, cá quay thân rời điểm chạm. */
  scareAt(cssX: number, cssY: number): void {
    const n = SCARE_BURST_MIN + Math.floor(Math.random() * (SCARE_BURST_MAX - SCARE_BURST_MIN + 1));
    this.spawnBurst(cssX, cssY, n, 1);
    for (const s of this.swimmers) {
      const dx = s.x - cssX;
      const dy = s.y - cssY;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 280) continue;
      const push = 120 + Math.random() * 100;
      this.retarget(s, s.x + (dx / d) * push, s.y + (dy / d) * push);
    }
  }

  /** Đổi đích và kích hoạt quay thân nếu cần đổi mặt. */
  private retarget(s: Swimmer, tx: number, ty: number): void {
    const bounds = this.bounds();
    s.tx = Math.min(bounds.maxX, Math.max(bounds.minX, tx));
    s.ty = Math.min(bounds.maxY, Math.max(bounds.minY, ty));
    const want: Facing = s.tx >= s.x ? 1 : -1;
    if (want !== s.facing) {
      s.turn = { elapsed: 0, dur: turnDurationMs(Math.random()) / 1000, to: want };
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
        if(this.records.some(row=>row.id===rec.id)) this.sprites.set(rec.id, cropAndTint(img,rec.depth));
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

  private loadSandMask(): void {
    if(this.sandMask) return;
    void loadImage('/art/be/scene-map.png').then(img=>{
      const canvas=document.createElement('canvas');
      canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx) return;
      ctx.drawImage(img,0,0);
      this.sandMask=ctx.getImageData(0,0,canvas.width,canvas.height);
    }).catch(()=>{});
  }

  private active() {
    return this.swimmers.slice(-MAX_FISH);
  }

  private onSand(x:number,y:number):boolean {
    const map=this.sandMask;
    if(!map || this.hasCustomBackground) return false;
    const fit=Math.max(this.cssW/map.width,this.cssH/map.height);
    const u=Math.floor((x+(map.width*fit-this.cssW)/2)/fit);
    const v=Math.floor((y+(map.height*fit-this.cssH)/2)/fit);
    return u>=0&&v>=0&&u<map.width&&v<map.height&&(map.data[(v*map.width+u)*4+1]??0)>1;
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
      if(document.hidden) {this.lastMs=now;return;}
      if(now-this.lastMs<30) return;
      const dt = Math.min(0.05, (now - this.lastMs) / 1000);
      this.lastMs = now;
      const step = this.reduceMotion ? dt * 0.15 : dt;
      this.step(step, now / 1000);
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  private resize(): void {
    const canvas = this.view;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(200, rect.width);
    const height = Math.max(160, rect.height);
    if (width !== this.cssW || height !== this.cssH) {
      const sx=width/this.cssW, sy=height/this.cssH;
      for(const fish of this.swimmers) {
        fish.x*=sx;fish.tx*=sx;fish.y*=sy;fish.ty*=sy;
      }
      this.cssW=width;this.cssH=height;
    }
    const dpr = Math.min(1, window.devicePixelRatio || 1);
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
      stepSwimmer(s, dt, Math.random, bounds, 92);
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

  private draw(): void {
    const canvas = this.view;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const dpr = canvas.width / this.cssW;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = this.cssW;
    const h = this.cssH;

    g.clearRect(0, 0, w, h);
    this.drawMotes(g, w, h);
    const ordered = this.active().sort((a, b) => a.depth - b.depth);
    for (const fish of ordered) {
      const y=h*(.83+.08*fish.depth);
      if(!this.onSand(fish.x,y)) continue;
      const size=this.fishWidth(fish);
      g.globalAlpha=.18;
      g.drawImage(this.shadowSprite,fish.x-size*.48,y-size*.13,size*.96,size*.26);
    }
    g.globalAlpha=1;
    for (const fish of ordered) this.drawFish(g,fish);

    this.drawEventBubbles(g);
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
    for(const b of this.eventBubbles) {
      g.globalAlpha=b.alpha*Math.min(1,b.life/.3);
      const sprite=this.bubbleSprites[b.r<1.7?0:b.r<3?1:2]!;
      g.drawImage(sprite,b.x-b.r,b.y-b.r,b.r*2,b.r*2);
    }
    g.globalAlpha=1;
  }

  private fishWidth(s:Swimmer) {
    return this.cssW*(.09+.05*s.depth);
  }

  private drawFish(g:CanvasRenderingContext2D,s:Swimmer):void {
    const sprite=this.sprites.get(s.id);
    if(!sprite) return;
    const w=this.fishWidth(s),h=w*sprite.height/sprite.width;
    g.save();
    g.translate(s.x,s.y);
    g.rotate(headPitch(s)*s.facing);
    g.scale(s.facing,1);
    g.drawImage(sprite,-w/2,-h/2,w,h);
    g.restore();
  }
}

function bubbleSprite(size:number,shadow=false) {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d')!;
  const r=size*.5;
  const radial=ctx.createRadialGradient(r,r,0,r,r,r);
  if(shadow) {
    radial.addColorStop(0,'rgba(0,0,0,0.85)');radial.addColorStop(1,'rgba(0,0,0,0)');
  } else {
    radial.addColorStop(0,'rgba(215,250,255,0.09)');
    radial.addColorStop(.70,'rgba(215,250,255,0.16)');
    radial.addColorStop(.84,'rgba(226,255,255,0.75)');
    radial.addColorStop(1,'rgba(226,255,255,0)');
  }
  ctx.fillStyle=radial;ctx.fillRect(0,0,size,size);
  return canvas;
}

function cropAndTint(img:HTMLImageElement,depth:number) {
  const canvas=document.createElement('canvas');
  canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  ctx.drawImage(img,0,0);
  const source=ctx.getImageData(0,0,canvas.width,canvas.height);
  let x0=source.width,y0=source.height,x1=-1,y1=-1;
  for(let y=0;y<source.height;y++) for(let x=0;x<source.width;x++) {
    const i=(y*source.width+x)*4;
    if(source.data[i+3]!>8) {x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    source.data[i]=source.data[i]!*(1-.3*(1-depth));
    source.data[i+1]=source.data[i+1]!*(1-.1*(1-depth));
  }
  canvas.width=Math.max(1,x1-x0+1);canvas.height=Math.max(1,y1-y0+1);
  ctx.putImageData(source,-x0,-y0);
  return canvas;
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
