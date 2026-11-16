import { rasterStrokes } from '../../shared/be/raster.js';
import {
  stampEye,
  stampFin,
  stampScales,
  templateFishBasic,
  templateFishSlim,
  templatePlant,
  templatePlantTall,
} from '../../shared/be/samples.js';
import { simplifyStroke } from '../../shared/be/strokes.js';
import { SPRITE_SIZE, type DrawingKind, type Stroke, type SwimType } from '../../shared/be/types.js';
import { cmd } from '../ws.js';
import { toast } from '../ui/toast.js';
import { getBe } from './model.js';

type PadStroke = Stroke & { gid: number };

const SWATCHES = [
  '#1b1b1b', '#ffffff', '#f28c28', '#e23b4a', '#f2c14e', '#1b7a43',
  '#1f5fd1', '#7a4bb5', '#e07a9a', '#2aa6a0', '#8d5a2b', '#7ec8e3',
];

let root: HTMLElement | null = null;
let pause: (on: boolean) => void = () => {};
let kind: DrawingKind = 'ca';
let drawingId = '';
let step = 1;
let strokes: PadStroke[] = [];
let redo: PadStroke[][] = [];
let draft: PadStroke | null = null;
let gid = 1;
let tool: Stroke['tool'] | 'stamp' = 'pen';
let color = '#f28c28';
let size = 48;
let alpha = 1;
let hard = false;
let smooth = true;
let sym: 'none' | 'h' | 'v' = 'none';
let wave = true;
let swim: SwimType = 'thuong';
let pip = false;
let zoom = false;
let drawing = false;

export function setPadPauseHandler(fn: (on: boolean) => void): void {
  pause = fn;
}

export function bindPad(stage: HTMLElement): void {
  root = stage;
  const pad = canvas();
  pad.addEventListener('pointerdown', onDown);
  pad.addEventListener('pointermove', onMove);
  pad.addEventListener('pointerup', onUp);
  pad.addEventListener('pointerleave', onUp);
  stage.querySelector('[data-be-cancel]')?.addEventListener('click', closePad);
  stage.querySelector('[data-be-next]')?.addEventListener('click', () => void next());
  stage.querySelector('[data-be-undo]')?.addEventListener('click', undo);
  stage.querySelector('[data-be-redo]')?.addEventListener('click', redoStroke);
  stage.querySelector('[data-be-flip]')?.addEventListener('click', flip);
  stage.querySelector('[data-be-smooth]')?.addEventListener('click', () => {
    smooth = !smooth;
    paintTools();
  });
  stage.querySelector('[data-be-sym]')?.addEventListener('click', () => {
    sym = sym === 'none' ? 'h' : sym === 'h' ? 'v' : 'none';
    paintTools();
  });
  stage.querySelector('[data-be-zoom]')?.addEventListener('click', () => {
    zoom = !zoom;
    pad.classList.toggle('is-zoom', zoom);
  });
  stage.querySelector('[data-be-pip]')?.addEventListener('click', () => {
    pip = !pip;
  });
  stage.querySelectorAll('[data-be-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = (btn as HTMLElement).dataset.beTool || 'pen';
      tool = name === 'stamp' ? 'stamp' : (name as Stroke['tool']);
      paintTools();
    });
  });
  stage.querySelector('[data-be-khuon]')?.addEventListener('click', () => {
    const box = stage.querySelector('[data-be-khuonbox]') as HTMLElement | null;
    if (box) box.hidden = !box.hidden;
  });
  stage.querySelector('[data-be-eye]')?.addEventListener('click', () => placeStamp('eye', 700, 420));
  stage.querySelector('[data-be-fin]')?.addEventListener('click', () => placeStamp('fin', 360, 420));
  stage.querySelector('[data-be-van]')?.addEventListener('click', () => placeStamp('van', 460, 480));
  stage.querySelectorAll('[data-be-template]').forEach((btn) => {
    btn.addEventListener('click', () => useTemplate((btn as HTMLElement).dataset.beTemplate || ''));
  });
  (stage.querySelector('[data-be-size]') as HTMLInputElement | null)?.addEventListener('input', (ev) => {
    size = Number((ev.target as HTMLInputElement).value);
  });
  (stage.querySelector('[data-be-alpha]') as HTMLInputElement | null)?.addEventListener('input', (ev) => {
    alpha = Number((ev.target as HTMLInputElement).value) / 100;
  });
  (stage.querySelector('[data-be-hard]') as HTMLInputElement | null)?.addEventListener('change', (ev) => {
    hard = (ev.target as HTMLInputElement).checked;
  });
  stage.querySelectorAll('input[name="be-swim"]').forEach((el) => {
    el.addEventListener('change', () => {
      swim = (el as HTMLInputElement).value as SwimType;
    });
  });
  (stage.querySelector('[data-be-wave]') as HTMLInputElement | null)?.addEventListener('change', (ev) => {
    wave = (ev.target as HTMLInputElement).checked;
  });
  const colors = stage.querySelector('[data-be-swatches]');
  if (colors) {
    colors.innerHTML = SWATCHES.map(
      (c) => `<button type="button" data-swatch="${c}" style="background:${c}" aria-label="${c}"></button>`,
    ).join('');
    colors.querySelectorAll('[data-swatch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        color = (btn as HTMLElement).dataset.swatch || color;
      });
    });
  }
  (stage.querySelector('[data-be-color]') as HTMLInputElement | null)?.addEventListener('input', (ev) => {
    color = (ev.target as HTMLInputElement).value;
  });
}

export function openPad(nextKind: DrawingKind): void {
  kind = nextKind;
  drawingId = crypto.randomUUID();
  step = 1;
  strokes = [];
  redo = [];
  draft = null;
  wave = nextKind === 'ca';
  swim = 'thuong';
  const name = root?.querySelector('[data-be-name]') as HTMLInputElement | null;
  if (name) name.value = suggest(nextKind);
  show(true);
}

export async function openEdit(id: string): Promise<void> {
  const ack = await cmd('be.getDrawing', { id });
  if (!ack.ok) {
    say(ack.error);
    return;
  }
  const data = ack.result as {
    kind: DrawingKind;
    name: string;
    strokes: Stroke[];
    swim: SwimType;
    wave: boolean;
  };
  kind = data.kind;
  drawingId = id;
  step = 1;
  gid += 1;
  strokes = data.strokes.map((s) => ({ ...s, gid }));
  redo = [];
  draft = null;
  wave = data.wave;
  swim = data.swim;
  const name = root?.querySelector('[data-be-name]') as HTMLInputElement | null;
  if (name) name.value = data.name;
  const waveEl = root?.querySelector('[data-be-wave]') as HTMLInputElement | null;
  if (waveEl) waveEl.checked = data.wave;
  const radio = root?.querySelector(`input[name="be-swim"][value="${data.swim}"]`) as HTMLInputElement | null;
  if (radio) radio.checked = true;
  show(true);
}

function show(open: boolean): void {
  const wrap = root?.querySelector('[data-be-padwrap]') as HTMLElement | null;
  if (!wrap) return;
  wrap.hidden = !open;
  pause(open);
  if (open) {
    paintTools();
    redraw();
  }
}

function closePad(): void {
  show(false);
}

async function next(): Promise<void> {
  if (!strokes.length) {
    toast('Vẽ một nét đã');
    return;
  }
  const last = kind === 'ca' ? 3 : 2;
  if (step < last) {
    step += 1;
    paintTools();
    return;
  }
  const name = ((root?.querySelector('[data-be-name]') as HTMLInputElement | null)?.value || suggest(kind)).trim();
  if (!name) {
    toast('Đặt tên đã');
    return;
  }
  const payload = strokes.map((s) => strip(s));
  const save = await cmd('be.saveDrawing', {
    id: drawingId,
    kind,
    name,
    strokes: payload,
    swim,
    wave: kind === 'ca' ? wave : false,
  });
  if (!save.ok) {
    say(save.error);
    return;
  }
  const released = await cmd('be.release', { id: drawingId });
  if (!released.ok) {
    say(released.error);
    return;
  }
  toast('Đã thả vào bể');
  closePad();
  const list = root?.querySelector('[data-be-fishlist]') as HTMLElement | null;
  if (list) list.hidden = false;
}

function onDown(ev: PointerEvent): void {
  if ((ev.target as HTMLElement) !== canvas()) return;
  const p = point(ev);
  if (pip) {
    sample(p.x, p.y);
    pip = false;
    return;
  }
  if (tool === 'stamp') {
    placeStamp('eye', p.x, p.y);
    return;
  }
  canvas().setPointerCapture(ev.pointerId);
  drawing = true;
  gid += 1;
  const strokeTool: Stroke['tool'] = tool;
  draft = {
    gid,
    tool: strokeTool,
    color,
    size,
    alpha,
    points: [round(p.x), round(p.y)],
    ...(hard ? { hard: true } : {}),
  };
  redraw();
}

function onMove(ev: PointerEvent): void {
  if (!drawing || !draft) return;
  const p = point(ev);
  if (draft.tool === 'line') {
    draft.points = [draft.points[0], draft.points[1], round(p.x), round(p.y)];
  } else if (draft.tool === 'pen' || draft.tool === 'erase') {
    let x = p.x;
    let y = p.y;
    if (smooth) {
      const lx = draft.points[draft.points.length - 2];
      const ly = draft.points[draft.points.length - 1];
      x = lx + (p.x - lx) * 0.35;
      y = ly + (p.y - ly) * 0.35;
    }
    const lx = draft.points[draft.points.length - 2];
    const ly = draft.points[draft.points.length - 1];
    if (Math.hypot(x - lx, y - ly) < 8) return;
    if (draft.points.length >= 460) return;
    draft.points.push(round(x), round(y));
  }
  redraw();
}

function onUp(): void {
  if (!drawing || !draft) return;
  drawing = false;
  const piece: PadStroke = { ...simplifyStroke(draft, 7), gid: draft.gid };
  const batch = [piece];
  if (sym === 'h') batch.push(mirror(piece, 'h'));
  if (sym === 'v') batch.push(mirror(piece, 'v'));
  strokes.push(...batch);
  draft = null;
  redo = [];
  redraw();
}

function undo(): void {
  if (!strokes.length) return;
  const id = strokes[strokes.length - 1].gid;
  const taken: PadStroke[] = [];
  while (strokes.length && strokes[strokes.length - 1].gid === id) taken.unshift(strokes.pop()!);
  redo.push(taken);
  redraw();
}

function redoStroke(): void {
  const batch = redo.pop();
  if (!batch) return;
  strokes.push(...batch);
  redraw();
}

function flip(): void {
  for (const s of strokes) {
    for (let i = 0; i < s.points.length; i += 2) s.points[i] = round(1000 - s.points[i]);
  }
  redraw();
}

function placeStamp(which: 'eye' | 'fin' | 'van', x: number, y: number): void {
  const unlocks = getBe()?.wallet.unlocks ?? [];
  if (which === 'fin' && !unlocks.includes('tem_vay')) {
    toast('Đổi vảy để mở tem vây');
    return;
  }
  if (which === 'van' && !unlocks.includes('tem_van')) {
    toast('Đổi vảy để mở tem vân');
    return;
  }
  gid += 1;
  const made = which === 'eye' ? stampEye(x, y) : which === 'fin' ? stampFin(x, y) : stampScales(x, y);
  strokes.push(...made.map((s) => withGid(s)));
  redraw();
}

function useTemplate(which: string): void {
  const unlocks = getBe()?.wallet.unlocks ?? [];
  if (which === 'slim' && !unlocks.includes('khuon_ca2')) {
    toast('Đổi vảy để mở khuôn này');
    return;
  }
  if (which === 'tall' && !unlocks.includes('khuon_cay2')) {
    toast('Đổi vảy để mở khuôn này');
    return;
  }
  const made =
    which === 'slim' ? templateFishSlim()
    : which === 'plant' ? templatePlant()
    : which === 'tall' ? templatePlantTall()
    : templateFishBasic();
  gid += 1;
  strokes.push(...made.map((s) => withGid(s)));
  redraw();
  const box = root?.querySelector('[data-be-khuonbox]') as HTMLElement | null;
  if (box) box.hidden = true;
}

function redraw(): void {
  const pad = canvas();
  const { w, h } = SPRITE_SIZE[kind];
  if (pad.width !== w || pad.height !== h) {
    pad.width = w;
    pad.height = h;
  }
  const all: Stroke[] = strokes.map((s) => strip(s));
  if (draft) all.push(strip(draft));
  const ctx = pad.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (all.length) {
    const rgba = rasterStrokes(all, w, h);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
  }
}

function sample(x: number, y: number): void {
  const pad = canvas();
  const { w, h } = SPRITE_SIZE[kind];
  const ctx = pad.getContext('2d');
  if (!ctx) return;
  const px = Math.round((x / 1000) * (w - 1));
  const py = Math.round((y / 1000) * (h - 1));
  const data = ctx.getImageData(px, py, 1, 1).data;
  if (data[3] < 20) return;
  color = '#' + [data[0], data[1], data[2]].map((n) => n.toString(16).padStart(2, '0')).join('');
  const input = root?.querySelector('[data-be-color]') as HTMLInputElement | null;
  if (input) input.value = color;
}

function paintTools(): void {
  if (!root) return;
  root.querySelectorAll('[data-be-tool]').forEach((btn) => {
    const name = (btn as HTMLElement).dataset.beTool;
    btn.setAttribute('aria-pressed', String(name === tool));
  });
  root.querySelector('[data-be-smooth]')?.setAttribute('aria-pressed', String(smooth));
  const symBtn = root.querySelector('[data-be-sym]');
  if (symBtn) symBtn.textContent = sym === 'h' ? 'Đối xứng ngang' : sym === 'v' ? 'Đối xứng dọc' : 'Đối xứng';
  const title = root.querySelector('[data-be-pad-title]');
  if (title) title.textContent = kind === 'ca' ? 'Vẽ cá' : kind === 'cay' ? 'Vẽ cây' : kind === 'thuc_an' ? 'Vẽ mồi' : 'Vẽ đồ';
  const steps = root.querySelector('[data-be-steps]');
  const labels = ['1. Vẽ hình', '2. Tô màu', '3. Cách bơi'];
  if (steps) steps.textContent = labels[step - 1] || labels[0];
  const nextBtn = root.querySelector('[data-be-next]');
  const last = kind === 'ca' ? 3 : 2;
  if (nextBtn) nextBtn.textContent = step >= last ? 'Thả vào bể' : 'Tiếp';
  const swimBox = root.querySelector('[data-be-swimbox]') as HTMLElement | null;
  if (swimBox) swimBox.hidden = !(kind === 'ca' && step === 3);
  const hint = root.querySelector('[data-be-hint]') as HTMLElement | null;
  if (hint) hint.hidden = kind !== 'ca';
}

function canvas(): HTMLCanvasElement {
  return root!.querySelector('[data-be-pad]') as HTMLCanvasElement;
}

function point(ev: PointerEvent): { x: number; y: number } {
  const rect = canvas().getBoundingClientRect();
  return {
    x: clamp(((ev.clientX - rect.left) / rect.width) * 1000),
    y: clamp(((ev.clientY - rect.top) / rect.height) * 1000),
  };
}

function withGid(s: Stroke): PadStroke {
  return { ...s, gid };
}

function mirror(s: PadStroke, mode: 'h' | 'v'): PadStroke {
  const points = s.points.slice();
  for (let i = 0; i < points.length; i += 2) {
    if (mode === 'h') points[i] = round(1000 - points[i]);
    else points[i + 1] = round(1000 - points[i + 1]);
  }
  return { ...s, points };
}

function suggest(k: DrawingKind): string {
  const lists: Record<DrawingKind, string[]> = {
    ca: ['Bống', 'Mập', 'Sọc', 'Bơn', 'Đèn', 'Heo', 'Sao'],
    cay: ['Rong', 'Lá', 'Bụi'],
    thuc_an: ['Mồi', 'Cốm', 'Viên'],
    do: ['Ốc', 'San hô', 'Lọ'],
  };
  const list = lists[k];
  return `${list[Math.floor(Math.random() * list.length)]} ${1 + Math.floor(Math.random() * 9)}`;
}

function say(error?: string): void {
  const map: Record<string, string> = {
    be_full: 'Bể đủ rồi',
    be_dirty: 'Bể bẩn — hút cặn đã',
    be_food: 'Hút mồi thừa đã',
    be_strokes: 'Nét không hợp lệ',
    be_rate: 'Khoan đã',
    be_scales: 'Chưa đủ vảy',
    forbidden: 'Không làm được',
    not_found: 'Không thấy',
  };
  toast(map[error || ''] || 'Chưa được');
}

function strip(s: PadStroke): Stroke {
  const { gid, ...rest } = s;
  void gid;
  return rest;
}

function round(n: number): number {
  return Math.round(clamp(n) * 10) / 10;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1000, n));
}
