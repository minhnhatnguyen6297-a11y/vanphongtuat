import { boxBlurRGBA } from './blur.js';
import { loadImage, svgUrl } from './image.js';
import { DEFAULT_FISH_COLOR } from './palette.js';
import { clamp } from './motion.js';

export const PAD_W = 480;
export const PAD_H = 240;
const PAD_KEY = 'hng_be_pad_v1';
const MAX_UNDO = 20;

export type FishTool = 'pen' | 'eraser' | 'blur';

export class FishPad {
  readonly backing: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private undoStack: ImageData[] = [];
  private drawing = false;
  private last: { x: number; y: number } | null = null;
  private dirty = false;
  private stampToken = 0;
  tool: FishTool = 'pen';
  color: string = DEFAULT_FISH_COLOR;
  size = 18;
  /** 1–8. Higher spreads the blur dab further. */
  blurStrength = 3;
  patternId: string | null = null;
  previewUrl: string | null = null;

  constructor() {
    this.backing = document.createElement('canvas');
    this.backing.width = PAD_W;
    this.backing.height = PAD_H;
    const ctx = this.backing.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('canvas');
    this.ctx = ctx;
    void this.restore();
  }

  attach(canvas: HTMLCanvasElement): void {
    if (canvas.dataset.fishBound !== '1') {
      canvas.dataset.fishBound = '1';
      canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        this.begin(e.clientX, e.clientY);
      });
    }
    this.blit();
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.ctx.putImageData(prev, 0, 0);
    this.blit();
    this.persist();
  }

  clear(): void {
    this.pushUndo();
    this.ctx.clearRect(0, 0, PAD_W, PAD_H);
    this.patternId = null;
    this.blit();
    this.persist();
  }

  async stampSvg(id: string, svg: string): Promise<void> {
    const token = ++this.stampToken;
    const img = await loadImage(svgUrl(svg));
    if (token !== this.stampToken) return;
    this.pushUndo();
    this.ctx.clearRect(0, 0, PAD_W, PAD_H);
    this.drawFit(img, img.naturalWidth || PAD_W, img.naturalHeight || PAD_H, 0.86);
    this.patternId = id;
    this.blit();
    this.persist();
  }

  placeImage(img: CanvasImageSource, w: number, h: number): void {
    this.pushUndo();
    this.ctx.clearRect(0, 0, PAD_W, PAD_H);
    this.drawFit(img, w, h, 0.92);
    this.patternId = null;
    this.blit();
    this.persist();
  }

  isBlank(): boolean {
    const data = this.ctx.getImageData(0, 0, PAD_W, PAD_H).data;
    for (let i = 3; i < data.length; i += 32) {
      if ((data[i] ?? 0) > 8) return false;
    }
    return true;
  }

  toPng(): string {
    return this.backing.toDataURL('image/png');
  }

  setPreview(url: string | null): void {
    if (this.previewUrl && this.previewUrl !== url) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = url;
  }

  private drawFit(img: CanvasImageSource, w: number, h: number, fill: number): void {
    const scale = Math.min(PAD_W / w, PAD_H / h) * fill;
    const dw = w * scale;
    const dh = h * scale;
    this.ctx.drawImage(img, (PAD_W - dw) / 2, (PAD_H - dh) / 2, dw, dh);
  }

  private async restore(): Promise<void> {
    let png = '';
    try {
      png = localStorage.getItem(PAD_KEY) || '';
    } catch {
      return;
    }
    if (!png) return;
    try {
      const img = await loadImage(png);
      if (this.dirty) return;
      this.ctx.drawImage(img, 0, 0, PAD_W, PAD_H);
      if (this.dirty) return;
      this.blit();
    } catch {
      /* keep the empty pad */
    }
  }

  private begin(clientX: number, clientY: number): void {
    const p = this.locate(clientX, clientY);
    if (!p) return;
    this.dirty = true;
    if (!this.drawing) {
      this.pushUndo();
      window.addEventListener('pointermove', this.onMove);
      window.addEventListener('pointerup', this.onUp);
      window.addEventListener('pointercancel', this.onUp);
    }
    this.drawing = true;
    this.last = p;
    if (this.tool === 'blur') this.blurAt(p.x, p.y);
    else this.stroke(p, p);
    this.blit();
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.drawing || !this.last) return;
    const p = this.locate(e.clientX, e.clientY);
    if (!p) return;
    this.stroke(this.last, p);
    this.last = p;
    this.blit();
  };

  private onUp = (): void => {
    if (!this.drawing) return;
    this.drawing = false;
    this.last = null;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.persist();
  };

  private locate(clientX: number, clientY: number): { x: number; y: number } | null {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-fish-pad]');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    const x = ((clientX - rect.left) / rect.width) * PAD_W;
    const y = ((clientY - rect.top) / rect.height) * PAD_H;
    if (x < -24 || y < -24 || x > PAD_W + 24 || y > PAD_H + 24) return null;
    return { x: clamp(x, 0, PAD_W), y: clamp(y, 0, PAD_H) };
  }

  private stroke(a: { x: number; y: number }, b: { x: number; y: number }): void {
    if (this.tool === 'blur') {
      this.dabBlur(a, b);
      return;
    }
    const g = this.ctx;
    g.save();
    g.lineWidth = this.size;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (this.tool === 'eraser') {
      g.globalCompositeOperation = 'destination-out';
      g.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = this.color;
    }
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x === a.x && b.y === a.y ? b.x + 0.01 : b.x, b.y);
    g.stroke();
    g.restore();
  }

  private dabBlur(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const step = Math.max(2, this.size * 0.45);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.blurAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }
  }

  private blurAt(x: number, y: number): void {
    const radius = Math.max(6, this.size);
    const blurR = Math.max(1, Math.round(this.blurStrength * 0.75));
    const pad = Math.ceil(radius);
    const sx = Math.max(0, Math.floor(x - pad));
    const sy = Math.max(0, Math.floor(y - pad));
    const ex = Math.min(PAD_W, Math.ceil(x + pad));
    const ey = Math.min(PAD_H, Math.ceil(y + pad));
    const w = ex - sx;
    const h = ey - sy;
    if (w < 2 || h < 2) return;
    const img = this.ctx.getImageData(sx, sy, w, h);
    const blurred = boxBlurRGBA(img.data, w, h, blurR);
    const cx = x - sx;
    const cy = y - sy;
    const out = img.data;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const d = Math.hypot(i - cx, j - cy);
        if (d > radius) continue;
        const edge = d > radius - 1.5 ? Math.max(0, (radius - d) / 1.5) : 1;
        const k = (j * w + i) * 4;
        for (let c = 0; c < 4; c++) {
          out[k + c] = (out[k + c] ?? 0) * (1 - edge) + (blurred[k + c] ?? 0) * edge;
        }
      }
    }
    this.ctx.putImageData(img, sx, sy);
  }

  private pushUndo(): void {
    this.undoStack.push(this.ctx.getImageData(0, 0, PAD_W, PAD_H));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
  }

  private blit(): void {
    const live = document.querySelector<HTMLCanvasElement>('[data-fish-pad]');
    if (!live) return;
    if (live.width !== PAD_W || live.height !== PAD_H) {
      live.width = PAD_W;
      live.height = PAD_H;
    }
    const g = live.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, PAD_W, PAD_H);
    g.drawImage(this.backing, 0, 0);
  }

  private persist(): void {
    try {
      localStorage.setItem(PAD_KEY, this.toPng());
    } catch {
      /* quota: the in-memory pad still works */
    }
  }
}

let padSingleton: FishPad | null = null;

export function fishPad(): FishPad {
  if (!padSingleton) padSingleton = new FishPad();
  return padSingleton;
}
