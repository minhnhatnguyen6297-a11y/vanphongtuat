import { esc } from '../../shared/esc.js';
import { state, memberById } from '../store.js';
import { cmd } from '../ws.js';
import { toast } from '../ui/toast.js';
import { importEdgeError, importFileError, loadImage } from './image.js';
import { fishPad, type FishTool } from './pad.js';
import { FISH_PATTERNS } from './patterns.js';
import { fishTank, readLocalFish } from './tank.js';

const ONCE_KEY = 'hng_be_shared_once';

let drawOpen = false;
let keyBound = false;
let uploading = false;

function toolButton(tool: FishTool, label: string, current: FishTool): string {
  const on = tool === current;
  return `<button type="button" class="hn-btn hn-fish-tool" data-fish-tool="${tool}" aria-pressed="${on}">${label}</button>`;
}

function readOnce(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(ONCE_KEY) || '[]') as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeOnce(ids: Set<string>): void {
  try {
    localStorage.setItem(ONCE_KEY, JSON.stringify([...ids]));
  } catch {
    /* the button can be pressed again */
  }
}

export function renderTankFrame(): string {
  const pad = fishPad();
  const tank = fishTank();
  const me = state.me;
  const admin = !!me && (me.tier === 'chu_xi' || me.isOperator);
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
  const rows = tank
    .rows()
    .map((r) => {
      const mine = !!me && r.ownerId === me.id;
      const who = memberById(r.ownerId)?.displayName || 'ai đó';
      const canDel = mine || admin;
      return `<li class="hn-fish-row"><span>${mine ? 'Cá của bạn' : esc(who)}</span>${
        canDel ? `<button type="button" class="hn-btn" data-fish-del="${esc(r.id)}">Gỡ</button>` : ''
      }</li>`;
    })
    .join('');

  return `<div class="hn-tank-stage">
    <canvas class="hn-tank-view" data-fish-tank width="640" height="360" aria-label="Ao cá đang bơi"></canvas>
    <div class="hn-tank-bar">
      <button type="button" class="hn-btn hn-btn-red" data-fish-draw>Vẽ cá</button>
      <button type="button" class="hn-btn" data-fish-upload-mine>Đưa cá máy này lên ao</button>
      <span class="hn-fish-count" data-fish-count>${tank.count} cá trong ao</span>
    </div>
    <div class="hn-fish-pop" data-fish-pop ${drawOpen ? '' : 'hidden'}>
      <div class="hn-fish-pop-card" role="dialog" aria-label="Vẽ cá">
        <div class="hn-fish-pop-head">
          <h3>Vẽ cá</h3>
          <button type="button" class="hn-btn" data-fish-close>Đóng</button>
        </div>
        <p class="hn-hint">Nháp chỉ ở máy này. Thả mới đưa lên ao chung. Đóng hoặc Escape giữ nháp.</p>
        <canvas class="hn-fish-pad" data-fish-pad width="480" height="240" aria-label="Tranh cá"></canvas>
        <div class="hn-fish-tools">
          ${toolButton('pen', 'Bút', pad.tool)}
          ${toolButton('eraser', 'Tẩy', pad.tool)}
          ${toolButton('blur', 'Làm mờ', pad.tool)}
          <label class="hn-fish-label">Màu <input data-fish-color type="color" value="${esc(pad.color)}"></label>
          <label class="hn-fish-label">Nét <input data-fish-size type="range" min="2" max="32" value="${pad.size}"></label>
          <label class="hn-fish-label">Độ mờ <input data-fish-blur type="range" min="1" max="8" value="${pad.blurStrength}"></label>
          <button type="button" class="hn-btn" data-fish-undo>Hoàn tác</button>
          <button type="button" class="hn-btn" data-fish-clear>Xóa tranh</button>
        </div>
        <div class="hn-fish-patterns" role="group" aria-label="Mẫu cá">${patterns}</div>
        <div class="hn-fish-import-row">
          <input class="sr-only" data-fish-file type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp">
          <button type="button" class="hn-btn" data-fish-import>Nhập ảnh</button>
          <button type="button" class="hn-btn hn-btn-red" data-fish-release>Thả vào ao</button>
        </div>
        ${preview}
        <ul class="hn-fish-list">${rows || '<li class="hn-hint">Ao chưa có cá.</li>'}</ul>
      </div>
    </div>
  </div>`;
}

function refreshCount(): void {
  const el = document.querySelector('[data-fish-count]');
  if (el) el.textContent = `${fishTank().count} cá trong ao`;
}

function closeDraw(): void {
  drawOpen = false;
  document.querySelector('[data-fish-pop]')?.setAttribute('hidden', '');
}

function openDraw(root: HTMLElement): void {
  drawOpen = true;
  root.querySelector('[data-fish-pop]')?.removeAttribute('hidden');
  const board = root.querySelector<HTMLCanvasElement>('[data-fish-pad]');
  if (board) fishPad().attach(board);
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

function ensureKey(): void {
  if (keyBound) return;
  keyBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !drawOpen) return;
    e.preventDefault();
    closeDraw();
  });
}

export function bindTank(root: HTMLElement): void {
  const pad = fishPad();
  const tank = fishTank();
  const view = root.querySelector<HTMLCanvasElement>('[data-fish-tank]');
  if (view) tank.attach(view);
  ensureKey();
  if (drawOpen) openDraw(root);

  root.querySelector('[data-fish-draw]')?.addEventListener('click', () => openDraw(root));
  root.querySelector('[data-fish-close]')?.addEventListener('click', () => closeDraw());
  root.querySelector('[data-fish-pop]')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDraw();
  });
  root.querySelector('.hn-fish-pop-card')?.addEventListener('click', (e) => e.stopPropagation());

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
      if (!pad.isBlank() && !window.confirm('Mẫu sẽ thay tranh đang có. Tiếp tục?')) return;
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
    void releasePad();
  });
  root.querySelector('[data-fish-upload-mine]')?.addEventListener('click', () => {
    void uploadMine();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-fish-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.fishDel;
      if (id) void removeFish(id);
    });
  });
}

async function releasePad(): Promise<void> {
  const pad = fishPad();
  if (pad.isBlank()) {
    toast('Vẽ hoặc nhập ảnh trước');
    return;
  }
  if (state.mock) {
    const result = fishTank().addFish(pad.toPng());
    if (result === 'full') toast('Bể đủ cá');
    else toast('Đã thả (máy này)');
    refreshCount();
    return;
  }
  if (!state.connected) {
    toast('Mất mạng, chưa thả');
    return;
  }
  const ack = await cmd('fish.release', { png: pad.toPng() });
  if (!ack.ok) {
    toast(ack.error === 'slow_down' ? 'Chậm thôi' : ack.error === 'tank_full' ? 'Ao đầy' : 'Không thả được');
    return;
  }
  toast('Đã thả lên ao chung');
}

async function removeFish(id: string): Promise<void> {
  if (state.mock) return;
  if (!state.connected) {
    toast('Mất mạng');
    return;
  }
  const ack = await cmd('fish.remove', { id });
  if (!ack.ok) toast(ack.error === 'forbidden' ? 'Không gỡ cá của người khác' : 'Không gỡ được');
}

async function uploadMine(): Promise<void> {
  if (uploading) return;
  const local = readLocalFish();
  const done = readOnce();
  const pending = local.filter((f) => f.png && !done.has(f.id));
  if (!pending.length) {
    toast('Không còn cá máy này để đưa');
    return;
  }
  if (!state.connected && !state.mock) {
    toast('Mất mạng, chưa đưa');
    return;
  }
  uploading = true;
  let n = 0;
  try {
    for (const fish of pending) {
      if (state.mock) {
        if (fishTank().addFish(fish.png) === 'ok') {
          done.add(fish.id);
          n += 1;
        }
      } else {
        const ack = await cmd('fish.release', { png: fish.png });
        if (!ack.ok) {
          toast(ack.error === 'slow_down' ? 'Chậm thôi, bấm lại để đưa nốt' : 'Dừng đưa cá');
          break;
        }
        done.add(fish.id);
        n += 1;
        await new Promise((r) => setTimeout(r, 1600));
      }
    }
  } finally {
    writeOnce(done);
    uploading = false;
    refreshCount();
  }
  if (n) toast(`Đã đưa ${n} cá lên ao`);
}

async function stageImport(file: File): Promise<void> {
  const fileError = importFileError(file);
  if (fileError) {
    toast(fileError);
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const edgeError = importEdgeError(img.naturalWidth, img.naturalHeight);
    if (edgeError) {
      URL.revokeObjectURL(url);
      toast(edgeError);
      return;
    }
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
  const host = document.querySelector('.hn-fish-pop-card');
  host?.querySelector('.hn-fish-preview')?.remove();
  if (!pad.previewUrl || !host) return;
  const row = host.querySelector('.hn-fish-import-row');
  row?.insertAdjacentHTML(
    'afterend',
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
