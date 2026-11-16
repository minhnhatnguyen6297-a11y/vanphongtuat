import { esc } from '../../shared/esc.js';
import {
  randomCreatureName,
  simplifyPoints,
  strokeBytes,
  templateFishBasic,
  templateFishRound,
  templatePlant,
  MAX_STROKE_BYTES,
  type Kind,
  type Stroke,
  type StrokeDoc,
  type Swim,
} from '../../shared/be.js';
import { drawStroke, mirrorStroke, paintStrokes, sampleColor } from './paint.js';

const SWATCHES = ['#1b1b1b', '#fffdf8', '#ef3c35', '#ffcf33', '#f28c28', '#1b7a43', '#1f5fd1', '#7ec8e3', '#f4a6c1', '#8d5a32'];

export type PadResult = {
  doc: StrokeDoc;
  name: string;
  swim: Swim;
  wave: boolean;
  growth: number;
};

export function openPad(
  host: HTMLElement,
  opts: {
    kind: Kind;
    unlocks: string[];
    initial?: StrokeDoc;
    name?: string;
    swim?: Swim;
    wave?: boolean;
    onCancel: () => void;
    onDone: (result: PadResult) => void;
  },
): void {
  const strokes: Stroke[] = opts.initial ? opts.initial.strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })) : [];
  const undone: Stroke[][] = [];
  let tool: Stroke['tool'] | 'pip' = 'pen';
  let color = '#ef6a2a';
  let size = 8;
  let alpha = 1;
  let smooth = true;
  let symH = false;
  let symV = false;
  let step = 1;
  let current: Stroke | null = null;
  let last: { x: number; y: number } | null = null;
  const name0 = opts.name || randomCreatureName(opts.kind);
  let swim: Swim = opts.swim || 'active';
  let wave = opts.wave !== false;
  let growth = 0.7;

  host.hidden = false;
  host.innerHTML = `<div class="hn-be-sheet" role="dialog" aria-label="Vẽ">
    <header class="hn-be-sheet-bar">
      <strong>${opts.kind === 'ca' ? 'Vẽ cá' : opts.kind === 'cay' ? 'Vẽ cây' : opts.kind === 'thuc_an' ? 'Vẽ mồi' : 'Vẽ đồ'}</strong>
      <span class="hn-be-steps" data-pad-steps>1 Vẽ · 2 Tô · 3 Cách bơi</span>
      <span class="hn-be-sheet-actions">
        <button type="button" class="hn-btn hn-btn-white" data-pad-cancel>Hủy</button>
        <button type="button" class="hn-btn" data-pad-next>Tiếp</button>
      </span>
    </header>
    <p class="hn-be-hint">Vẽ quay sang phải. Thu nhỏ ở bước 3 để xem lúc nằm trong bể.</p>
    <div class="hn-be-pad-canvas-wrap">
      <canvas data-pad-canvas width="512" height="256"></canvas>
    </div>
    <div class="hn-be-pad-tools" data-pad-tools>
      <button type="button" data-tool="pen" aria-pressed="true">Bút</button>
      <button type="button" data-tool="eraser">Tẩy</button>
      <button type="button" data-tool="line">Thẳng</button>
      <button type="button" data-tool="fill">Tô</button>
      <button type="button" data-tool="stamp" data-stamp="eye">Tem mắt</button>
      <button type="button" data-tool="stamp" data-stamp="fin" ${opts.unlocks.includes('stamp_fin') ? '' : 'disabled'}>Tem vây</button>
      <button type="button" data-tool="pip">Lấy màu</button>
      <button type="button" data-act="undo">Hoàn</button>
      <button type="button" data-act="redo">Làm lại</button>
      <button type="button" data-act="flip">Lật</button>
      <button type="button" data-act="symh" aria-pressed="false">Đối xứng ngang</button>
      <button type="button" data-act="symv" aria-pressed="false">Đối xứng dọc</button>
      <button type="button" data-act="smooth" aria-pressed="true">Mượt</button>
      <button type="button" data-act="khuon">Khuôn</button>
    </div>
    <div class="hn-be-pad-sliders">
      <label>Cỡ nét <input data-size type="range" min="2" max="36" value="8"></label>
      <label>Độ đậm <input data-alpha type="range" min="20" max="100" value="100"></label>
      <div class="hn-be-swatches" data-swatches>
        ${SWATCHES.map((c) => `<button type="button" data-swatch="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}
        <input data-color type="color" value="#ef6a2a" aria-label="Màu">
      </div>
    </div>
    <div class="hn-be-pad-step3" data-step3 hidden>
      <label>Tên <input data-name maxlength="24" value="${esc(name0)}"></label>
      ${
        opts.kind === 'ca'
          ? `<div class="hn-be-swims" data-swims>
        <button type="button" data-swim="active">Hoạt bát</button>
        <button type="button" data-swim="drift">Thong thả</button>
        <button type="button" data-swim="cruise">Như tàu</button>
        <button type="button" data-swim="bottom">Bám đáy</button>
      </div>
      <label class="hn-be-check"><input data-wave type="checkbox" checked> Uốn mình</label>`
          : ''
      }
      <label>Cỡ lúc thả <input data-growth type="range" min="62" max="105" value="70"></label>
      <canvas data-pad-preview width="192" height="96"></canvas>
    </div>
  </div>`;

  const canvas = host.querySelector('[data-pad-canvas]') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const preview = host.querySelector('[data-pad-preview]') as HTMLCanvasElement | null;
  const nextBtn = host.querySelector('[data-pad-next]') as HTMLButtonElement;

  function commitSnapshot() {
    undone.length = 0;
  }

  function render() {
    paintStrokes(ctx, { strokes }, canvas.width, canvas.height);
    if (current) {
      drawStroke(ctx, current, canvas.width, canvas.height);
      if (symH) drawStroke(ctx, mirrorStroke(current, 'h'), canvas.width, canvas.height);
      if (symV) drawStroke(ctx, mirrorStroke(current, 'v'), canvas.width, canvas.height);
    }
    if (preview) {
      const pg = preview.getContext('2d')!;
      paintStrokes(pg, { strokes }, preview.width, preview.height);
    }
    const bytes = strokeBytes({ strokes });
    const hint = host.querySelector('.hn-be-hint');
    if (hint && bytes > MAX_STROKE_BYTES) hint.textContent = 'Nét quá nhiều, xóa bớt.';
  }

  function pushStroke(s: Stroke) {
    strokes.push(s);
    if (symH) strokes.push(mirrorStroke(s, 'h'));
    if (symV) strokes.push(mirrorStroke(s, 'v'));
    commitSnapshot();
    current = null;
    render();
  }

  function pos(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    let x = (e.clientX - r.left) / r.width;
    let y = (e.clientY - r.top) / r.height;
    x = Math.min(1, Math.max(0, x));
    y = Math.min(1, Math.max(0, y));
    if (smooth && last && (tool === 'pen' || tool === 'eraser')) {
      x = last.x + (x - last.x) * 0.38;
      y = last.y + (y - last.y) * 0.38;
    }
    last = { x, y };
    return { x, y };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (step === 3) return;
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    if (tool === 'pip') {
      const picked = sampleColor(ctx, p, canvas.width, canvas.height);
      if (picked) {
        color = picked;
        (host.querySelector('[data-color]') as HTMLInputElement).value = picked;
      }
      tool = 'pen';
      markTools();
      return;
    }
    if (tool === 'fill') {
      pushStroke({ tool: 'fill', color, size, alpha, points: [p] });
      return;
    }
    if (tool === 'stamp') {
      const stamp = (host.querySelector('[data-tool="stamp"][aria-pressed="true"]') as HTMLElement | null)?.dataset.stamp;
      pushStroke({ tool: 'stamp', color, size: Math.max(size, 14), alpha, points: [p], stamp: stamp === 'fin' ? 'fin' : 'eye' });
      return;
    }
    current = { tool: tool === 'eraser' ? 'eraser' : tool === 'line' ? 'line' : 'pen', color, size, alpha, points: [p] };
    render();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    const p = pos(e);
    if (current.tool === 'line') current.points = [current.points[0], p];
    else current.points.push(p);
    render();
  });
  canvas.addEventListener('pointerup', () => {
    if (!current) return;
    if (current.tool === 'pen' || current.tool === 'eraser') {
      current.points = simplifyPoints(current.points, 0.012, 48);
    }
    if (current.points.length >= (current.tool === 'line' ? 2 : 1)) pushStroke(current);
    else current = null;
    last = null;
    render();
  });

  function markTools() {
    host.querySelectorAll('[data-tool]').forEach((btn) => {
      const el = btn as HTMLButtonElement;
      if (el.dataset.tool !== 'stamp') el.setAttribute('aria-pressed', String(el.dataset.tool === tool));
    });
  }

  host.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLButtonElement;
      if (el.disabled) return;
      tool = (el.dataset.tool as typeof tool) || 'pen';
      host.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      el.setAttribute('aria-pressed', 'true');
    });
  });
  host.querySelectorAll('[data-swatch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      color = (btn as HTMLElement).dataset.swatch || color;
      (host.querySelector('[data-color]') as HTMLInputElement).value = color;
    });
  });
  host.querySelector('[data-color]')?.addEventListener('input', (e) => {
    color = (e.target as HTMLInputElement).value;
  });
  host.querySelector('[data-size]')?.addEventListener('input', (e) => {
    size = Number((e.target as HTMLInputElement).value);
  });
  host.querySelector('[data-alpha]')?.addEventListener('input', (e) => {
    alpha = Number((e.target as HTMLInputElement).value) / 100;
  });

  function applyTemplate() {
    let doc = templateFishBasic();
    if (opts.kind === 'cay') doc = templatePlant();
    else if (opts.kind === 'ca' && opts.unlocks.includes('khuon_ca2')) doc = templateFishRound();
    else if (opts.kind === 'do') doc = templatePlant();
    strokes.splice(0, strokes.length, ...doc.strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })));
    commitSnapshot();
    render();
  }

  host.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = (btn as HTMLElement).dataset.act;
      if (act === 'undo' && strokes.length) {
        const n = symH || symV ? (symH && symV ? 4 : 2) : 1;
        undone.push(strokes.splice(Math.max(0, strokes.length - n), n));
        render();
      } else if (act === 'redo' && undone.length) {
        strokes.push(...(undone.pop() || []));
        render();
      } else if (act === 'flip') {
        for (const s of strokes) s.points = s.points.map((p) => ({ x: 1 - p.x, y: p.y }));
        render();
      } else if (act === 'symh') {
        symH = !symH;
        btn.setAttribute('aria-pressed', String(symH));
      } else if (act === 'symv') {
        symV = !symV;
        btn.setAttribute('aria-pressed', String(symV));
      } else if (act === 'smooth') {
        smooth = !smooth;
        btn.setAttribute('aria-pressed', String(smooth));
      } else if (act === 'khuon') {
        if (opts.kind === 'ca' && !opts.unlocks.includes('khuon_ca2') && strokes.length > 0) {
          /* khuôn cơ bản vẫn dùng được */
        }
        applyTemplate();
      }
    });
  });

  host.querySelectorAll('[data-swim]').forEach((btn) => {
    btn.addEventListener('click', () => {
      swim = ((btn as HTMLElement).dataset.swim as Swim) || 'active';
      host.querySelectorAll('[data-swim]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
    });
  });
  host.querySelector('[data-swim="active"]')?.setAttribute('aria-pressed', 'true');
  host.querySelector('[data-wave]')?.addEventListener('change', (e) => {
    wave = (e.target as HTMLInputElement).checked;
  });
  host.querySelector('[data-growth]')?.addEventListener('input', (e) => {
    growth = Number((e.target as HTMLInputElement).value) / 100;
  });

  function showStep() {
    const tools = host.querySelector('[data-pad-tools]') as HTMLElement;
    const sliders = host.querySelector('.hn-be-pad-sliders') as HTMLElement;
    const s3 = host.querySelector('[data-step3]') as HTMLElement;
    tools.hidden = step === 3;
    sliders.hidden = step === 3;
    s3.hidden = step !== 3;
    nextBtn.textContent = step === 3 ? 'Thả vào bể' : 'Tiếp';
    host.querySelector('[data-pad-steps]')!.textContent =
      step === 1 ? '1 Vẽ hình' : step === 2 ? '2 Tô màu' : '3 Cách bơi';
    if (step === 3) render();
  }

  host.querySelector('[data-pad-cancel]')?.addEventListener('click', () => {
    host.hidden = true;
    host.innerHTML = '';
    opts.onCancel();
  });
  nextBtn.addEventListener('click', () => {
    if (step < 3) {
      step += 1;
      if (step === 2) tool = 'fill';
      showStep();
      return;
    }
    if (!strokes.length) return;
    const doc = { strokes };
    if (strokeBytes(doc) > MAX_STROKE_BYTES) return;
    const name = ((host.querySelector('[data-name]') as HTMLInputElement | null)?.value || name0).trim().slice(0, 24);
    host.hidden = true;
    host.innerHTML = '';
    opts.onDone({ doc, name: name || name0, swim, wave, growth });
  });

  const onKey = (e: KeyboardEvent) => {
    if (host.hidden) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      host.querySelector('[data-act="undo"]')?.dispatchEvent(new Event('click'));
    }
  };
  window.addEventListener('keydown', onKey);
  const stop = new MutationObserver(() => {
    if (!host.isConnected || host.hidden) {
      window.removeEventListener('keydown', onKey);
      stop.disconnect();
    }
  });
  stop.observe(host, { attributes: true, childList: true });

  if (!strokes.length && (opts.kind === 'ca' || opts.kind === 'cay')) applyTemplate();
  else render();
  showStep();
}
