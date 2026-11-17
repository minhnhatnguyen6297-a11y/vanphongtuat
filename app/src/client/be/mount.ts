import { esc } from '../../shared/esc.js';
import { toast } from '../ui/toast.js';
import { loadImage } from './image.js';
import { fishPad, type FishTool } from './pad.js';
import { FISH_PATTERNS } from './patterns.js';
import { fishTank } from './tank.js';

const ACCEPT = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 4 * 1024 * 1024;

function toolButton(tool: FishTool, label: string, current: FishTool): string {
  const on = tool === current;
  return `<button type="button" class="hn-btn hn-fish-tool" data-fish-tool="${tool}" aria-pressed="${on}">${label}</button>`;
}

export function renderTankFrame(): string {
  const pad = fishPad();
  const tank = fishTank();
  const preview = pad.previewUrl
    ? `<div class="hn-fish-preview">
        <img data-fish-preview src="${esc(pad.previewUrl)}" alt="Xem trước ảnh cá">
        <button type="button" class="hn-btn hn-btn-green" data-fish-use>Đưa vào tranh</button>
        <button type="button" class="hn-btn" data-fish-cancel>Bỏ</button>
      </div>`
    : '';
  const patterns = FISH_PATTERNS.map(
    (p) =>
      `<button type="button" class="hn-fish-pattern" data-fish-pattern="${esc(p.id)}" aria-label="Mẫu ${esc(p.label)}" aria-pressed="${pad.patternId === p.id}">${p.svg}</button>`,
  ).join('');

  return `<section class="hn-tank-frame" aria-label="Bể cá">
    <h3 class="hn-tank-title">BỂ CÁ</h3>
    <canvas class="hn-tank-view" data-fish-tank width="640" height="280" aria-label="Bể cá đang bơi"></canvas>
    <p class="hn-fish-count" data-fish-count>${tank.count} cá · tranh của bạn</p>
    <canvas class="hn-fish-pad" data-fish-pad width="480" height="240" aria-label="Tranh cá"></canvas>
    <div class="hn-fish-tools">
      ${toolButton('pen', 'Bút', pad.tool)}
      ${toolButton('eraser', 'Tẩy', pad.tool)}
      ${toolButton('blur', 'Làm mờ', pad.tool)}
      <label class="hn-fish-label">Màu <input id="hn-fish-color" data-fish-color type="color" value="${esc(pad.color)}"></label>
      <label class="hn-fish-label">Nét <input id="hn-fish-size" data-fish-size type="range" min="2" max="32" value="${pad.size}"></label>
      <label class="hn-fish-label">Độ mờ <input id="hn-fish-blur" data-fish-blur type="range" min="1" max="8" value="${pad.blurStrength}"></label>
      <button type="button" class="hn-btn" data-fish-undo>Hoàn tác</button>
      <button type="button" class="hn-btn" data-fish-clear>Xóa tranh</button>
    </div>
    <div class="hn-fish-patterns" role="group" aria-label="Mẫu cá">${patterns}</div>
    <div class="hn-fish-import-row">
      <input class="sr-only" data-fish-file type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp">
      <button type="button" class="hn-btn" data-fish-import>Nhập ảnh</button>
      <button type="button" class="hn-btn hn-btn-blue" data-fish-release>Thả vào bể</button>
      <button type="button" class="hn-btn" data-fish-remove>Gỡ cá cuối</button>
    </div>
    ${preview}
  </section>`;
}

function refreshCount(): void {
  const el = document.querySelector('[data-fish-count]');
  if (el) el.textContent = `${fishTank().count} cá · tranh của bạn`;
}

function syncTools(): void {
  const pad = fishPad();
  document.querySelectorAll<HTMLButtonElement>('[data-fish-tool]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.fishTool === pad.tool));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-fish-pattern]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.fishPattern === pad.patternId));
  });
}

export function bindTank(root: HTMLElement): void {
  const pad = fishPad();
  const tank = fishTank();
  const view = root.querySelector<HTMLCanvasElement>('[data-fish-tank]');
  const board = root.querySelector<HTMLCanvasElement>('[data-fish-pad]');
  if (view) tank.attach(view);
  if (board) pad.attach(board);

  root.querySelectorAll<HTMLButtonElement>('[data-fish-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.fishTool;
      if (tool === 'pen' || tool === 'eraser' || tool === 'blur') pad.tool = tool;
      syncTools();
    });
  });

  const color = root.querySelector<HTMLInputElement>('[data-fish-color]');
  color?.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(color.value)) pad.color = color.value;
  });
  const size = root.querySelector<HTMLInputElement>('[data-fish-size]');
  size?.addEventListener('input', () => {
    pad.size = Number(size.value) || 8;
  });
  const blur = root.querySelector<HTMLInputElement>('[data-fish-blur]');
  blur?.addEventListener('input', () => {
    pad.blurStrength = Number(blur.value) || 4;
  });

  root.querySelector('[data-fish-undo]')?.addEventListener('click', () => pad.undo());
  root.querySelector('[data-fish-clear]')?.addEventListener('click', () => {
    pad.clear();
    syncTools();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-fish-pattern]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.fishPattern || '';
      const pattern = FISH_PATTERNS.find((p) => p.id === id);
      if (!pattern) return;
      void pad.stampSvg(pattern.id, pattern.svg).then(() => syncTools());
    });
  });

  const file = root.querySelector<HTMLInputElement>('[data-fish-file]');
  root.querySelector('[data-fish-import]')?.addEventListener('click', () => file?.click());
  file?.addEventListener('change', () => {
    const picked = file.files?.[0];
    file.value = '';
    if (!picked) return;
    void stageImport(picked);
  });
  root.querySelector('[data-fish-use]')?.addEventListener('click', () => {
    void usePreview();
  });
  root.querySelector('[data-fish-cancel]')?.addEventListener('click', () => {
    pad.setPreview(null);
    paintImport();
  });

  root.querySelector('[data-fish-release]')?.addEventListener('click', () => {
    if (pad.isBlank()) {
      toast('Vẽ hoặc nhập ảnh trước');
      return;
    }
    const result = tank.addFish(pad.toPng());
    if (result === 'full') {
      toast('Bể đủ 8 cá');
      return;
    }
    refreshCount();
    toast('Đã thả vào bể');
  });
  root.querySelector('[data-fish-remove]')?.addEventListener('click', () => {
    tank.removeLast();
    refreshCount();
  });
}

async function stageImport(file: File): Promise<void> {
  const name = file.name.toLowerCase();
  const extOk = name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp');
  if ((!file.type || !ACCEPT.includes(file.type)) && !extOk) {
    toast('Chỉ PNG, JPG, WebP');
    return;
  }
  if (file.type && !ACCEPT.includes(file.type)) {
    toast('Chỉ PNG, JPG, WebP');
    return;
  }
  if (file.size > MAX_BYTES) {
    toast('Ảnh lớn hơn 4MB');
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    await loadImage(url);
  } catch {
    URL.revokeObjectURL(url);
    toast('Không đọc được ảnh');
    return;
  }
  fishPad().setPreview(url);
  paintImport();
}

async function usePreview(): Promise<void> {
  const img = document.querySelector<HTMLImageElement>('[data-fish-preview]');
  if (!img || !img.complete || !img.naturalWidth) {
    toast('Chưa xem được ảnh');
    return;
  }
  fishPad().placeImage(img, img.naturalWidth, img.naturalHeight);
  fishPad().setPreview(null);
  paintImport();
  toast('Đã đưa vào tranh');
}

function paintImport(): void {
  const pad = fishPad();
  const host = document.querySelector('.hn-tank-frame');
  host?.querySelector('.hn-fish-preview')?.remove();
  if (!pad.previewUrl || !host) return;
  host.insertAdjacentHTML(
    'beforeend',
    `<div class="hn-fish-preview">
      <img data-fish-preview src="${esc(pad.previewUrl)}" alt="Xem trước ảnh cá">
      <button type="button" class="hn-btn hn-btn-green" data-fish-use>Đưa vào tranh</button>
      <button type="button" class="hn-btn" data-fish-cancel>Bỏ</button>
    </div>`,
  );
  host.querySelector('[data-fish-use]')?.addEventListener('click', () => {
    void usePreview();
  });
  host.querySelector('[data-fish-cancel]')?.addEventListener('click', () => {
    pad.setPreview(null);
    paintImport();
  });
}
