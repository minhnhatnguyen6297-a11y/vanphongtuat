import { esc } from '../../shared/esc.js';
import { state, memberById } from '../store.js';
import { cmd } from '../ws.js';
import { toast } from '../ui/toast.js';
import { importEdgeError, importFileError, loadImage } from './image.js';
import { fishPad, type FishTool } from './pad.js';
import { FISH_PATTERNS } from './patterns.js';
import { fishTank, readLocalFish } from './tank.js';
import { hashQuery, wantsAoCaGl } from './gl/query.js';

const ONCE_KEY = 'hng_be_shared_once';

const SWATCHES = ['#8BC2C7', '#F3B48C', '#C4A484', '#7A8FA3', '#4A5560', '#F5F7FA'] as const;

let drawOpen = false;
let menuOpen = false;
let keyBound = false;
let uploading = false;

const FAB = {
  draw: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20z"/><path d="M13 6l3 3"/></svg>`,
  /* Viên thức ăn — không dùng icon người/cá gây nhầm */
  feed: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="9" cy="8" rx="3.2" ry="2.2"/><ellipse cx="15.5" cy="11" rx="2.6" ry="1.8"/><ellipse cx="11" cy="16.5" rx="2.8" ry="2"/></svg>`,
  scare: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12c2-2 4-3 7-2s5 2 8 0 3-3 3-3"/><path d="M3 17c2-2 4-3 7-2s5 2 8 0"/><path d="M3 7c2-2 4-3 7-2s5 2 8 0"/></svg>`,
  menu: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9h12M6 15h12"/></svg>`,
  chat: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 6h14v9H9l-4 3V6z"/></svg>`,
};

function toolButton(tool: FishTool, label: string, current: FishTool): string {
  const on = tool === current;
  return `<button type="button" class="hn-fab-tool" data-fish-tool="${tool}" aria-pressed="${on}" title="${label}">${label}</button>`;
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

function fab(mode: string, label: string, icon: string, pressed: boolean): string {
  return `<button type="button" class="hn-fab" data-fish-fab="${mode}" aria-label="${label}" aria-pressed="${pressed}" title="${label}">${icon}</button>`;
}

export function renderTankFrame(): string {
  const pad = fishPad();
  const tank = fishTank();
  const me = state.me;
  const admin = !!me && (me.tier === 'chu_xi' || me.isOperator);
  const mode = tank.mode;
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
  const swatches = SWATCHES.map(
    (c) =>
      `<button type="button" class="hn-fish-swatch" data-fish-swatch="${c}" style="--sw:${c}" aria-label="Màu ${c}" aria-pressed="${pad.color.toLowerCase() === c.toLowerCase()}"></button>`,
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
    <canvas class="hn-tank-view" data-fish-tank width="960" height="540" aria-label="Ao cá đang bơi"></canvas>
    <div class="hn-fab-cluster hn-fab-bl">
      ${fab('draw', 'Vẽ cá', FAB.draw, drawOpen)}
      ${fab('feed', 'Cho ăn', FAB.feed, mode === 'feed')}
      ${fab('scare', 'Xua', FAB.scare, mode === 'scare')}
    </div>
    <div class="hn-fab-cluster hn-fab-tr">
      ${fab('menu', 'Menu', FAB.menu, menuOpen)}
    </div>
    <div class="hn-fab-cluster hn-fab-br">
      ${fab('chat', 'Chat', FAB.chat, false)}
    </div>
    <div class="hn-fish-menu" data-fish-menu ${menuOpen ? '' : 'hidden'}>
      <a href="#/home">Trang chủ</a>
      <a href="#/sanh">Sảnh</a>
      <a href="#/ban">Bàn hôm nay</a>
      <button type="button" data-fish-bg-default>Ảnh nền Hang Đá</button>
      <label class="hn-fish-menu-file">Chọn ảnh từ máy
        <input class="sr-only" data-fish-bg-file type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp">
      </label>
      <button type="button" data-fish-upload-mine>Đưa cá máy này lên ao</button>
      <p class="hn-fish-count" data-fish-count>${tank.count} cá trong ao</p>
    </div>
    <div class="hn-fish-pop" data-fish-pop ${drawOpen ? '' : 'hidden'}>
      <div class="hn-fish-pop-card" role="dialog" aria-label="Vẽ cá">
        <div class="hn-fish-pop-head">
          <h3>Vẽ cá</h3>
          <div class="hn-fish-pop-actions">
            <button type="button" class="hn-btn hn-btn-green" data-fish-release>Thả cá</button>
            <button type="button" class="hn-btn" data-fish-close>Đóng Esc</button>
          </div>
        </div>
        <div class="hn-fish-pop-body">
          <canvas class="hn-fish-pad" data-fish-pad width="480" height="240" aria-label="Tranh cá"></canvas>
          <aside class="hn-fish-tools">
            <div class="hn-fish-tool-row">
              ${toolButton('pen', 'Cọ', pad.tool)}
              ${toolButton('eraser', 'Tẩy', pad.tool)}
              ${toolButton('blur', 'Làm mờ', pad.tool)}
            </div>
            <p class="hn-fish-tools-label">Màu</p>
            <div class="hn-fish-swatches">${swatches}</div>
            <label class="hn-fish-label">Cỡ cọ <input data-fish-size type="range" min="4" max="40" value="${pad.size}"> <span data-fish-size-val>${pad.size} px</span></label>
            <label class="hn-fish-label">Độ mạnh <input data-fish-blur type="range" min="1" max="8" value="${pad.blurStrength}"> <span data-fish-blur-val>${Math.round((pad.blurStrength / 8) * 100)}%</span></label>
            <button type="button" class="hn-btn" data-fish-undo>Hoàn tác</button>
            <button type="button" class="hn-btn" data-fish-clear>Xóa tranh</button>
            <div class="hn-fish-patterns" role="group" aria-label="Mẫu cá">${patterns}</div>
            <div class="hn-fish-import-row">
              <input class="sr-only" data-fish-file type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp">
              <button type="button" class="hn-btn" data-fish-import>Nhập ảnh</button>
            </div>
            ${preview}
            <ul class="hn-fish-list">${rows || '<li class="hn-hint">Ao chưa có cá.</li>'}</ul>
          </aside>
        </div>
      </div>
    </div>
  </div>`;
}

function refreshCount(): void {
  const el = document.querySelector('[data-fish-count]');
  if (el) el.textContent = `${fishTank().count} cá trong ao`;
}

function syncFabs(): void {
  const mode = fishTank().mode;
  document.querySelectorAll<HTMLButtonElement>('[data-fish-fab]:not([data-fish-fab="chat"])').forEach((btn) => {
    const id = btn.dataset.fishFab;
    let on = false;
    if (id === 'draw') on = drawOpen;
    else if (id === 'feed') on = mode === 'feed';
    else if (id === 'scare') on = mode === 'scare';
    else if (id === 'menu') on = menuOpen;
    btn.setAttribute('aria-pressed', String(on));
  });
}

function closeDraw(): void {
  drawOpen = false;
  document.querySelector('[data-fish-pop]')?.setAttribute('hidden', '');
  syncFabs();
}

function openDraw(root: HTMLElement): void {
  drawOpen = true;
  fishTank().setMode('none');
  root.querySelector('[data-fish-pop]')?.removeAttribute('hidden');
  const board = root.querySelector<HTMLCanvasElement>('[data-fish-pad]');
  if (board) fishPad().attach(board);
  syncFabs();
}

function setMenu(open: boolean): void {
  menuOpen = open;
  const el = document.querySelector('[data-fish-menu]');
  if (!el) return;
  if (open) el.removeAttribute('hidden');
  else el.setAttribute('hidden', '');
  syncFabs();
}

function syncTools(): void {
  const pad = fishPad();
  document.querySelectorAll<HTMLButtonElement>('[data-fish-tool]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.fishTool === pad.tool));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-fish-pattern]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.fishPattern === pad.patternId));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-fish-swatch]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String((btn.dataset.fishSwatch || '').toLowerCase() === pad.color.toLowerCase()));
  });
}

function ensureKey(): void {
  if (keyBound) return;
  keyBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (drawOpen) {
      e.preventDefault();
      closeDraw();
    } else if (menuOpen) {
      e.preventDefault();
      setMenu(false);
    }
  });
}

function bindPointer(view: HTMLCanvasElement): void {
  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drawOpen) return;
    const tank = fishTank();
    if (tank.mode === 'none') return;
    const rect = view.getBoundingClientRect();
    tank.handlePointer(e.clientX - rect.left, e.clientY - rect.top);
  });
}

export function bindTank(root: HTMLElement): void {
  const pad = fishPad();
  // mặc định theo ảnh A: cỡ 28px, độ mạnh ~35%
  if (pad.size === 8) pad.size = 28;
  if (pad.blurStrength === 4) pad.blurStrength = 3;
  if (pad.color === '#13110F') pad.color = SWATCHES[0]!;

  const tank = fishTank();
  const view = root.querySelector<HTMLCanvasElement>('[data-fish-tank]');
  const glQuery = hashQuery();
  const useGl = wantsAoCaGl(glQuery);
  if (view && useGl) {
    // P0+: three chunk loaded only when ?bench / ?perf — ao v2 giữ nguyên khi không có.
    void import('./gl/renderer.js')
      .then((m) => m.mountAoCaGl({ root, canvas: view, query: glQuery }))
      .catch((err) => {
        console.error('ao-ca gl mount failed', err);
        tank.attach(view);
        bindPointer(view);
      });
  } else if (view) {
    tank.attach(view);
    bindPointer(view);
  }
  ensureKey();
  if (drawOpen) openDraw(root);
  syncFabs();

  root.querySelectorAll<HTMLButtonElement>('[data-fish-fab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.fishFab;
      if (id === 'draw') {
        if (drawOpen) closeDraw();
        else {
          setMenu(false);
          openDraw(root);
        }
        return;
      }
      if (id === 'feed') {
        tank.setMode(tank.mode === 'feed' ? 'none' : 'feed');
        closeDraw();
        setMenu(false);
        syncFabs();
        toast(tank.mode === 'feed' ? 'Chạm ao để cho ăn' : 'Tắt cho ăn');
        return;
      }
      if (id === 'scare') {
        tank.setMode(tank.mode === 'scare' ? 'none' : 'scare');
        closeDraw();
        setMenu(false);
        syncFabs();
        toast(tank.mode === 'scare' ? 'Chạm ao để xua' : 'Tắt xua');
        return;
      }
      if (id === 'menu') {
        setMenu(!menuOpen);
        return;
      }
    });
  });

  root.querySelector('[data-fish-close]')?.addEventListener('click', () => closeDraw());
  root.querySelector('[data-fish-pop]')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDraw();
  });
  root.querySelector('.hn-fish-pop-card')?.addEventListener('click', (e) => e.stopPropagation());

  root.querySelector('[data-fish-bg-default]')?.addEventListener('click', () => {
    tank.resetBackground();
    toast('Đã dùng nền Hang Đá');
    setMenu(false);
  });
  const bgFile = root.querySelector<HTMLInputElement>('[data-fish-bg-file]');
  bgFile?.addEventListener('change', () => {
    const file = bgFile.files?.[0];
    bgFile.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    void loadImage(url)
      .then((img) => {
        const c = document.createElement('canvas');
        const max = 1920;
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
        return tank.setBackground(c.toDataURL('image/jpeg', 0.88));
      })
      .then(() => {
        URL.revokeObjectURL(url);
        toast('Đã đổi nền');
        setMenu(false);
      })
      .catch(() => {
        URL.revokeObjectURL(url);
        toast('Không đọc được ảnh nền');
      });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-fish-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.fishTool;
      if (tool === 'pen' || tool === 'eraser' || tool === 'blur') pad.tool = tool;
      syncTools();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-fish-swatch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = btn.dataset.fishSwatch;
      if (c) pad.color = c;
      syncTools();
    });
  });

  const size = root.querySelector<HTMLInputElement>('[data-fish-size]');
  size?.addEventListener('input', () => {
    pad.size = Number(size.value) || 28;
    const val = root.querySelector('[data-fish-size-val]');
    if (val) val.textContent = `${pad.size} px`;
  });
  const blur = root.querySelector<HTMLInputElement>('[data-fish-blur]');
  blur?.addEventListener('input', () => {
    pad.blurStrength = Number(blur.value) || 3;
    const val = root.querySelector('[data-fish-blur-val]');
    if (val) val.textContent = `${Math.round((pad.blurStrength / 8) * 100)}%`;
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
        const ack = await cmd('fish.release', { png: fish.png, localId: fish.id });
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
  const host = document.querySelector('.hn-fish-tools');
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
