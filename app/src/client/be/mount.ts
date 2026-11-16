import { esc } from '../../shared/esc.js';
import { UNLOCKS, type QualityName, type UnlockId } from '../../shared/be/types.js';
import { notify, state } from '../store.js';
import { blockSessionReconnect, cmd, sendRaw, setWsOpenHook } from '../ws.js';
import { toast } from '../ui/toast.js';
import { getBe, isBeKicked, onBe, setKickHook, setNudge } from './model.js';
import { poke, startPresence, stopPresence } from './presence.js';
import { bindPad, openEdit, openPad, setPadPauseHandler } from './pad.js';
import {
  hitAt,
  pinQuality,
  pokeRender,
  setDrag,
  setPadPaused,
  startRender,
  stopRender,
} from './render.js';

const STAGE_HTML = `
<div class="hn-be-toolbar">
  <button type="button" class="hn-btn" data-be-add>Thêm</button>
  <button type="button" class="hn-btn" data-be-feed>Cho ăn</button>
  <button type="button" class="hn-btn" data-be-clean>Hút cặn</button>
  <button type="button" class="hn-btn" data-be-list>Danh sách cá</button>
  <label>Cát <select data-be-sand>
    <option value="vang">Vàng</option><option value="trang">Trắng</option>
    <option value="hong">Hồng</option><option value="xam">Xám</option>
  </select></label>
  <label>Đá <input data-be-rocks type="range" min="0" max="5" step="1" value="3"></label>
  <label>Gỗ <input data-be-wood type="range" min="0" max="3" step="1" value="1"></label>
  <label>Đèn <select data-be-light>
    <option value="auto">Theo giờ</option><option value="ngay">Ngày</option>
    <option value="chieu">Chiều</option><option value="dem">Đêm</option>
  </select></label>
  <label>Mực nước <input data-be-water type="range" min="55" max="92" step="1" value="78"></label>
  <label>Đồ họa <select data-be-quality>
    <option value="auto">Tự chỉnh</option><option value="cao">Cao</option>
    <option value="vua">Vừa</option><option value="nhe">Nhẹ</option><option value="tinh">Tĩnh</option>
  </select></label>
  <button type="button" class="hn-btn hn-btn-white" data-be-shop>Đổi vảy</button>
  <span data-be-scales>Vảy 0</span>
  <span data-be-count>Cá 0</span>
</div>
<div class="hn-be-warn" data-be-warn hidden>
  <span>Sắp rời bể vì vắng.</span>
  <button type="button" class="hn-btn" data-be-stay>Tôi vẫn ở đây</button>
</div>
<div class="hn-be-glass">
  <canvas data-be-canvas></canvas>
  <p class="hn-be-empty" data-be-empty>Bể đang trống — bấm Thêm để vẽ</p>
  <div class="hn-be-pop" data-be-addmenu hidden>
    <button type="button" data-be-kind="ca">Cá</button>
    <button type="button" data-be-kind="cay">Cây</button>
    <button type="button" data-be-kind="thuc_an">Thức ăn</button>
    <button type="button" data-be-kind="do">Đồ</button>
  </div>
  <div class="hn-be-pop hn-be-list" data-be-fishlist hidden><div data-be-listbody></div></div>
  <div class="hn-be-pop hn-be-shop" data-be-shopbox hidden></div>
  <div class="hn-be-card" data-be-card hidden></div>
  <div class="hn-be-pad" data-be-padwrap hidden>
    <div class="hn-be-pad-head">
      <strong data-be-pad-title>Vẽ cá</strong>
      <span data-be-steps>1. Vẽ hình</span>
      <button type="button" class="hn-btn hn-btn-white" data-be-cancel>Hủy</button>
      <button type="button" class="hn-btn hn-btn-green" data-be-next>Tiếp</button>
    </div>
    <label class="hn-be-name">Tên <input id="be-name" data-be-name maxlength="40"></label>
    <p class="hn-be-hint" data-be-hint>Vẽ cá quay sang phải</p>
    <canvas data-be-pad></canvas>
    <div class="hn-be-tools">
      <button type="button" data-be-tool="pen" aria-pressed="true">Bút</button>
      <button type="button" data-be-tool="erase">Tẩy</button>
      <button type="button" data-be-tool="fill">Tô</button>
      <button type="button" data-be-tool="line">Thẳng</button>
      <button type="button" data-be-tool="stamp">Tem mắt</button>
      <button type="button" data-be-sym>Đối xứng</button>
      <button type="button" data-be-flip>Lật</button>
      <button type="button" data-be-smooth aria-pressed="true">Mượt</button>
      <button type="button" data-be-undo>Hoàn</button>
      <button type="button" data-be-redo>Làm lại</button>
      <button type="button" data-be-zoom>Phóng</button>
      <button type="button" data-be-khuon>Khuôn</button>
      <button type="button" data-be-eye>Mắt</button>
      <button type="button" data-be-fin>Vây</button>
      <button type="button" data-be-van>Vân</button>
      <button type="button" data-be-pip>Pipet</button>
    </div>
    <div class="hn-be-sliders">
      <label>Cỡ nét <input data-be-size type="range" min="8" max="180" value="48"></label>
      <label>Độ đậm <input data-be-alpha type="range" min="20" max="100" value="100"></label>
      <label>Độ cứng <input data-be-hard type="checkbox"></label>
      <label>Màu <input data-be-color type="color" value="#f28c28"></label>
    </div>
    <div class="hn-be-swatches" data-be-swatches></div>
    <div class="hn-be-khuonbox" data-be-khuonbox hidden>
      <button type="button" data-be-template="basic">Khuôn cá</button>
      <button type="button" data-be-template="slim">Khuôn cá mảnh</button>
      <button type="button" data-be-template="plant">Khuôn cây</button>
      <button type="button" data-be-template="tall">Khuôn cây cao</button>
    </div>
    <div data-be-swimbox hidden>
      <label><input type="radio" name="be-swim" value="thuong" checked> Cá thường</label>
      <label><input type="radio" name="be-swim" value="cham"> Trôi chậm</label>
      <label><input type="radio" name="be-swim" value="tau"> Như tàu</label>
      <label><input type="radio" name="be-swim" value="day"> Bám đáy</label>
      <label><input type="checkbox" data-be-wave checked> Uốn mình</label>
    </div>
  </div>
</div>
<p class="hn-be-perf" data-be-perf hidden></p>`;

let stage: HTMLElement | null = null;
let joined = false;
let dragId: string | null = null;
let dragMoved = false;
let dragX = 0;
let dragY = 0;
let tweakTimer = 0;

setPadPauseHandler(setPadPaused);
setKickHook(() => {
  teardown(true);
  blockSessionReconnect();
  notify();
});
setWsOpenHook(() => {
  if (joined && !isBeKicked()) sendRaw({ t: 'be.join' });
});

export function beforeShellPaint(route: string): void {
  if (route === 'chat' && !isBeKicked()) {
    document.getElementById('be-stage')?.remove();
    return;
  }
  if (stage || joined) teardown(false);
}

export function ensureStage(root: HTMLElement): void {
  if (isBeKicked()) return;
  const slot = root.querySelector('#be-slot');
  if (!slot) return;
  if (!stage) {
    stage = document.createElement('div');
    stage.id = 'be-stage';
    stage.className = 'hn-be-stage';
    stage.dataset.beStage = '1';
    stage.dataset.beReady = '0';
    stage.innerHTML = STAGE_HTML;
    wire(stage);
    startRender(stage.querySelector('[data-be-canvas]') as HTMLCanvasElement);
    startPresence(stage);
    joined = true;
    sendRaw({ t: 'be.join' });
    onBe(paintChrome);
    paintChrome();
  }
  slot.replaceWith(stage);
}

function teardown(silent: boolean): void {
  if (!stage && !joined) return;
  if (joined && !silent && !isBeKicked()) sendRaw({ t: 'be.leave' });
  stopRender();
  stopPresence();
  stage?.remove();
  stage = null;
  joined = false;
  dragId = null;
}

function wire(el: HTMLElement): void {
  bindPad(el);
  el.querySelector('[data-be-add]')?.addEventListener('click', () => toggle('[data-be-addmenu]'));
  el.querySelectorAll('[data-be-kind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      hide('[data-be-addmenu]');
      openPad((btn as HTMLElement).dataset.beKind as 'ca' | 'cay' | 'thuc_an' | 'do');
    });
  });
  el.querySelector('[data-be-feed]')?.addEventListener('click', () => void run('be.feed', {}));
  el.querySelector('[data-be-clean]')?.addEventListener('click', () => void run('be.clean', {}));
  el.querySelector('[data-be-list]')?.addEventListener('click', () => toggle('[data-be-fishlist]'));
  el.querySelector('[data-be-shop]')?.addEventListener('click', () => {
    paintShop();
    toggle('[data-be-shopbox]');
  });
  el.querySelector('[data-be-stay]')?.addEventListener('click', () => poke());
  for (const sel of ['[data-be-sand]', '[data-be-light]']) {
    el.querySelector(sel)?.addEventListener('change', () => queueTweak());
  }
  for (const sel of ['[data-be-rocks]', '[data-be-wood]', '[data-be-water]']) {
    el.querySelector(sel)?.addEventListener('input', () => queueTweak());
  }
  el.querySelector('[data-be-quality]')?.addEventListener('change', (ev) => {
    pinQuality((ev.target as HTMLSelectElement).value as QualityName | 'auto');
  });
  const canvas = el.querySelector('[data-be-canvas]') as HTMLCanvasElement;
  canvas.addEventListener('pointerdown', (ev) => onTankDown(ev, canvas));
  canvas.addEventListener('pointermove', (ev) => onTankMove(ev, canvas));
  canvas.addEventListener('pointerup', (ev) => onTankUp(ev, canvas));
}

function toggle(sel: string): void {
  const el = stage?.querySelector(sel) as HTMLElement | null;
  if (el) el.hidden = !el.hidden;
}
function hide(sel: string): void {
  const el = stage?.querySelector(sel) as HTMLElement | null;
  if (el) el.hidden = true;
}

async function run(name: string, args: unknown): Promise<void> {
  const ack = await cmd(name, args);
  if (!ack.ok) {
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
    toast(map[ack.error || ''] || 'Chưa được');
  }
}

function queueTweak(): void {
  window.clearTimeout(tweakTimer);
  tweakTimer = window.setTimeout(() => {
    if (!stage) return;
    void run('be.tweak', {
      sand: (stage.querySelector('[data-be-sand]') as HTMLSelectElement).value,
      lighting: (stage.querySelector('[data-be-light]') as HTMLSelectElement).value,
      rockCount: Number((stage.querySelector('[data-be-rocks]') as HTMLInputElement).value),
      woodCount: Number((stage.querySelector('[data-be-wood]') as HTMLInputElement).value),
      waterLevel: Number((stage.querySelector('[data-be-water]') as HTMLInputElement).value) / 100,
    });
  }, 180);
}

function norm(ev: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (ev.clientX - rect.left) / Math.max(1, rect.width))),
    y: Math.min(1, Math.max(0, (ev.clientY - rect.top) / Math.max(1, rect.height))),
  };
}

function onTankDown(ev: PointerEvent, canvas: HTMLCanvasElement): void {
  const pad = stage?.querySelector('[data-be-padwrap]') as HTMLElement | null;
  if (pad && !pad.hidden) return;
  const p = norm(ev, canvas);
  const id = hitAt(p.x, p.y);
  if (!id) {
    const edge = p.x < 0.07 || p.x > 0.93 || p.y < 0.07 || p.y > 0.93;
    const kind = edge ? 'scare' : 'follow';
    sendRaw({ t: 'be.nudge', x: p.x, y: p.y, kind });
    setNudge({ x: p.x, y: p.y, kind, until: Date.now() + 1400 });
    hide('[data-be-card]');
    return;
  }
  dragId = id;
  dragMoved = false;
  dragX = p.x;
  dragY = p.y;
  canvas.setPointerCapture(ev.pointerId);
}

function onTankMove(ev: PointerEvent, canvas: HTMLCanvasElement): void {
  if (!dragId) return;
  const p = norm(ev, canvas);
  if (Math.hypot(p.x - dragX, p.y - dragY) > 0.02) dragMoved = true;
  setDrag(dragId, p.x, p.y);
  pokeRender();
}

function onTankUp(ev: PointerEvent, canvas: HTMLCanvasElement): void {
  if (!dragId) return;
  const id = dragId;
  const p = norm(ev, canvas);
  setDrag(null);
  dragId = null;
  if (dragMoved) void run('be.move', { id, x: p.x, y: p.y });
  else showCard(id);
}

function showCard(id: string): void {
  const drawing = getBe()?.drawings.find((d) => d.id === id);
  const card = stage?.querySelector('[data-be-card]') as HTMLElement | null;
  if (!drawing || !card) return;
  const mine = drawing.authorId === state.me?.id;
  const owner = state.me?.tier === 'chu_xi' || !!state.me?.isOperator;
  const born = Date.parse(drawing.createdAt);
  const days = Number.isFinite(born) ? Math.max(0, Math.floor((Date.now() - born) / 86_400_000)) : 0;
  card.hidden = false;
  card.innerHTML = `<p><b>${esc(drawing.name)}</b></p>
    <p>${esc(drawing.authorName)} · ${Math.round(drawing.scale * 100)}% · ăn ${drawing.feeds} · ${days} ngày</p>
    <p class="hn-be-card-actions">
      ${mine ? '<button type="button" data-card="edit">Sửa</button>' : ''}
      <button type="button" data-card="report">Báo</button>
      ${owner ? '<button type="button" data-card="hide">Ẩn</button>' : ''}
      <button type="button" data-card="close">Đóng</button>
    </p>`;
  card.querySelector('[data-card="edit"]')?.addEventListener('click', () => {
    card.hidden = true;
    void openEdit(id);
  });
  card.querySelector('[data-card="report"]')?.addEventListener('click', () => void run('be.report', { id }));
  card.querySelector('[data-card="hide"]')?.addEventListener('click', () => {
    card.hidden = true;
    void run('be.hide', { id });
  });
  card.querySelector('[data-card="close"]')?.addEventListener('click', () => {
    card.hidden = true;
  });
}

function paintChrome(): void {
  if (!stage) return;
  const snap = getBe();
  const fish = snap?.drawings.filter((d) => d.kind === 'ca' && d.placed && !d.hidden) ?? [];
  const count = stage.querySelector('[data-be-count]');
  if (count) count.textContent = `Cá ${fish.length}`;
  const scales = stage.querySelector('[data-be-scales]');
  if (scales) scales.textContent = `Vảy ${snap?.wallet.scales ?? 0}`;
  stage.dataset.beFish = String(fish.length);
  const empty = stage.querySelector('[data-be-empty]') as HTMLElement | null;
  if (empty) empty.hidden = fish.length > 0;
  if (snap) {
    setIfIdle('[data-be-sand]', snap.tank.sand);
    setIfIdle('[data-be-light]', snap.tank.lighting);
    setIfIdle('[data-be-rocks]', String(snap.tank.rockCount));
    setIfIdle('[data-be-wood]', String(snap.tank.woodCount));
    setIfIdle('[data-be-water]', String(Math.round(snap.tank.waterLevel * 100)));
  }
  const body = stage.querySelector('[data-be-listbody]');
  if (body) {
    const rows = snap?.drawings.filter((d) => d.kind === 'ca') ?? [];
    body.innerHTML = rows.length
      ? rows
          .map(
            (d) =>
              `<button type="button" data-be-fish-name="${esc(d.name)}" data-id="${esc(d.id)}">${esc(d.name)} · ${esc(d.authorName)}${d.hidden ? ' · đã ẩn' : ''}${d.reported ? ' · bị báo' : ''}</button>`,
          )
          .join('')
      : '<p>Chưa có cá</p>';
    body.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => showCard((btn as HTMLElement).dataset.id || ''));
    });
  }
  pokeRender();
}

function paintShop(): void {
  const box = stage?.querySelector('[data-be-shopbox]');
  const snap = getBe();
  if (!box || !snap) return;
  const items = Object.entries(UNLOCKS) as [UnlockId, { cost: number; label: string }][];
  box.innerHTML = items
    .map(([id, spec]) => {
      const have = snap.wallet.unlocks.includes(id);
      return `<button type="button" data-unlock="${id}" ${have ? 'disabled' : ''}>${esc(spec.label)} · ${spec.cost} vảy${have ? ' · có rồi' : ''}</button>`;
    })
    .join('');
  box.querySelectorAll('[data-unlock]').forEach((btn) => {
    btn.addEventListener('click', () => void run('be.unlock', { item: (btn as HTMLElement).dataset.unlock }));
  });
}

function setIfIdle(sel: string, value: string): void {
  const el = stage?.querySelector(sel) as HTMLInputElement | HTMLSelectElement | null;
  if (!el || document.activeElement === el) return;
  if (el.value !== value) el.value = value;
}
