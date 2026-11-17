import { esc } from '../../shared/esc.js';
import { adoptSpinClock, easeOutCubic, shouldRevealResult, spinProgress } from '../../shared/wheel-motion.js';
import { state, canPerm, setSound, memberById, notify } from '../store.js';
import type { Shop, Spin } from '../../shared/types.js';
import { ICONS, SHOP_COLORS } from '../icons.js';
import { cmd, setChatSubs, uuid } from '../ws.js';
import { toast } from '../ui/toast.js';
import { closeModal, openModal } from '../ui/modal.js';
import { renderChatPanel, bindChatPanel } from '../ui/chat-panel.js';

let audioCtx: AudioContext | null = null;
let lastTick = 0;
let spinRaf = 0;
let loopSpinId: string | null = null;
const localPlan = new Map<string, { start: number; dur: number; from: number; to: number }>();
const ownSpins = new Set<string>();
/** Thẻ đang gõ, chưa ghi máy chủ. Trọng số lúc lưu = 20 để các ô mới đều nhau. */
const drafts = new Map<string, { wheelId: string; text: string }>();
const savingDrafts = new Set<string>();
let focusDraftId: string | null = null;
const NEW_ITEM_WEIGHT = 20;

function resumeAudio(): void {
  if (!audioCtx) audioCtx = new AudioContext();
  void audioCtx.resume();
}

function beep(freq: number, dur = 0.05, type: OscillatorType = 'square'): void {
  if (!state.ui.soundOn || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = 0.04;
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start(t0);
  o.stop(t0 + dur);
}

type Seg = { start: number; end: number; mid: number; color: string; name: string };

function inkFor(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#1B1B1B';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.55 ? '#1B1B1B' : '#FFF4D6';
}

/** Một nguồn góc cho conic / vạch / nhãn / đích quay (0° = đỉnh, theo chiều kim đồng hồ). */
function segmentLayout(items: { weight: number; name?: string }[]): Seg[] {
  const total = items.reduce((s, i) => s + i.weight, 0) || 1;
  let acc = 0;
  return items.map((it, i) => {
    const start = (acc / total) * 360;
    acc += it.weight;
    const end = (acc / total) * 360;
    return {
      start,
      end,
      mid: (start + end) / 2,
      color: SHOP_COLORS[i % SHOP_COLORS.length]!,
      name: it.name || '',
    };
  });
}

function conic(items: { weight: number }[]): string {
  const segs = segmentLayout(items);
  if (!segs.length) return 'conic-gradient(#FFF4D6, #FFF4D6)';
  // Hard color stops (no blend between wedges)
  const stops = segs
    .flatMap((s) => [`${s.color} ${s.start}deg`, `${s.color} ${s.end}deg`])
    .join(', ');
  return `conic-gradient(from -90deg, ${stops})`;
}

function landingAngle(resultIndex: number, items: { weight: number }[]): number {
  const segs = segmentLayout(items);
  const mid = segs[resultIndex]?.mid ?? 0;
  return (360 - mid + 360) % 360;
}

function spinAngle(resultIndex: number, items: { weight: number }[]): number {
  return 360 * 5 + landingAngle(resultIndex, items);
}

function stopSpinRaf(): void {
  if (spinRaf) {
    cancelAnimationFrame(spinRaf);
    spinRaf = 0;
  }
}

function stopSpinLoop(): void {
  loopSpinId = null;
  stopSpinRaf();
}

/** Góc nghỉ của đúng vòng này, không lấy góc đang chạy của vòng khác. */
function restAngle(wheelId: string, exceptId: string): number {
  const prev = state.spins.find((s) => s.wheelId === wheelId && s.id !== exceptId);
  if (!prev) return 0;
  try {
    const items = JSON.parse(prev.itemsJson) as { weight: number }[];
    return spinAngle(prev.resultIndex, items);
  } catch {
    return 0;
  }
}

function spinArc(spinning: Spin): { from: number; to: number } {
  const existing = localPlan.get(spinning.id);
  if (existing) return { from: existing.from, to: existing.to };
  const itemsSnap = JSON.parse(spinning.itemsJson) as { weight: number }[];
  const landing = landingAngle(spinning.resultIndex, itemsSnap);
  const from = restAngle(spinning.wheelId, spinning.id);
  let to = from + 360 * 5;
  const mod = ((to % 360) + 360) % 360;
  to += (landing - mod + 360) % 360;
  if (to - from < 360 * 4) to += 360;
  return { from, to };
}

function angleNow(spinning: Spin): number {
  const arc = spinArc(spinning);
  const plan = planFor(spinning, arc.from, arc.to);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const p = spinProgress(performance.now() - plan.start, plan.dur);
  const eased = reduced ? p : easeOutCubic(p);
  return plan.from + (plan.to - plan.from) * eased;
}

function planFor(spinning: Spin, from: number, to: number): { start: number; dur: number; from: number; to: number } {
  const existing = localPlan.get(spinning.id);
  if (existing) return existing;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const adopted = adoptSpinClock(Date.now(), spinning.startedAt, spinning.durationMs, performance.now());
  let start = adopted.localStart;
  let dur = adopted.dur;
  if (ownSpins.has(spinning.id) && adopted.done) {
    start = performance.now();
    dur = Math.max(1, spinning.durationMs);
  }
  if (reduced) dur = Math.min(dur, 600);
  const plan = { start, dur, from, to };
  localPlan.set(spinning.id, plan);
  return plan;
}

export function spinSettled(spin: Spin): boolean {
  const plan = localPlan.get(spin.id);
  if (plan) return shouldRevealResult(spinProgress(performance.now() - plan.start, plan.dur));
  if (ownSpins.has(spin.id)) return false;
  return adoptSpinClock(Date.now(), spin.startedAt, spin.durationMs, performance.now()).done;
}

function runSpinLoop(spinning: Spin): void {
  if (loopSpinId === spinning.id && spinRaf) return;
  stopSpinRaf();
  loopSpinId = spinning.id;
  const id = spinning.id;
  const wheelId = spinning.wheelId;
  const tick = () => {
    if (loopSpinId !== id) return;
    if (state.route !== 'quay' || state.ui.wheelId !== wheelId) {
      stopSpinLoop();
      return;
    }
    const face = document.getElementById('wheel-face');
    const spin = state.spins.find((s) => s.id === id);
    if (!face || !spin || spin.wheelId !== wheelId) {
      stopSpinLoop();
      return;
    }
    const arc = spinArc(spin);
    const plan = planFor(spin, arc.from, arc.to);
    const p = spinProgress(performance.now() - plan.start, plan.dur);
    const angle = angleNow(spin);
    face.style.transition = 'none';
    face.style.transform = `rotate(${angle}deg)`;
    face.style.setProperty('--wheel-angle', `${angle}deg`);
    if (!shouldRevealResult(p)) {
      spinRaf = requestAnimationFrame(tick);
      return;
    }
    face.style.transform = `rotate(${plan.to}deg)`;
    face.style.setProperty('--wheel-angle', `${plan.to}deg`);
    loopSpinId = null;
    spinRaf = 0;
    notify();
  };
  spinRaf = requestAnimationFrame(tick);
}

/** Xóa đồng hồ quay trong bộ nhớ. Chỉ dùng cho kiểm thử. */
export function resetWheelSpinForTests(): void {
  stopSpinLoop();
  localPlan.clear();
  ownSpins.clear();
  drafts.clear();
  savingDrafts.clear();
  focusDraftId = null;
}

function activeSpin(wheelId: string) {
  return state.spins.find((s) => s.wheelId === wheelId && !spinSettled(s));
}

function latestSpin(wheelId: string) {
  return state.spins.find((s) => s.wheelId === wheelId);
}

function verdict(count: number): string {
  if (count <= 1) return 'Không cãi.';
  if (count === 2) return 'Quay lại lần 2. Cả bàn thấy hết.';
  return `Lần thứ ${count}. Có người chụp màn hình rồi.`;
}

function spinsToday(wheelId: string): number {
  const day = new Date().toDateString();
  return state.spins.filter(
    (s) => s.wheelId === wheelId && new Date(s.startedAt).toDateString() === day,
  ).length;
}

function freeWheels() {
  return state.wheels.filter((w) => w.kind === 'free');
}

function pickedWheel() {
  const wheels = freeWheels();
  return wheels.find((w) => w.id === state.ui.wheelId) || wheels[0];
}

function nameLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(0, 120));
}

function toastCmd(ack: { ok: boolean; error?: string }): boolean {
  if (ack.ok) return true;
  if (ack.error === 'too_many_items') toast('Tối đa 60 ô');
  else if (ack.error === 'forbidden') toast('Không được sửa danh sách');
  else if (ack.error === 'conflict') toast('Danh sách vừa đổi, thử lại');
  else toast('Chưa lưu được');
  return false;
}

async function ensureList(): Promise<string | null> {
  const existing = pickedWheel();
  if (existing) {
    state.ui.wheelId = existing.id;
    return existing.id;
  }
  if (!canPerm('wheel.create')) {
    toast('Không được tạo danh sách');
    return null;
  }
  const ack = await cmd('wheel.create', { title: 'Danh sách' });
  if (!ack.ok || !ack.result) {
    toast('Chưa tạo được danh sách');
    return null;
  }
  const id = (ack.result as { id: string }).id;
  state.ui.wheelId = id;
  return id;
}

async function commitDraft(draftId: string): Promise<void> {
  if (savingDrafts.has(draftId)) return;
  const draft = drafts.get(draftId);
  if (!draft) return;
  const names = nameLines(draft.text);
  if (!names.length) return;
  savingDrafts.add(draftId);
  try {
    const wheel = state.wheels.find((w) => w.id === draft.wheelId);
    const version = wheel?.version ?? 1;
    const ack =
      names.length === 1
        ? await cmd(
            'wheel.item.add',
            { wheelId: draft.wheelId, name: names[0], weight: NEW_ITEM_WEIGHT },
            version,
          )
        : await cmd(
            'wheel.item.addMany',
            {
              wheelId: draft.wheelId,
              items: names.map((name) => ({ name, weight: NEW_ITEM_WEIGHT })),
            },
            version,
          );
    if (!toastCmd(ack)) return;
    drafts.delete(draftId);
    notify();
  } finally {
    savingDrafts.delete(draftId);
  }
}

function openShopPicker(): void {
  if (!state.shops.length) {
    toast('Kho chưa có quán');
    return;
  }
  const wheel = pickedWheel();
  const taken = new Set((wheel?.items || []).map((i) => i.refShopId).filter(Boolean) as string[]);
  openModal({
    title: 'Nhập cửa hàng',
    bodyHtml: `<div class="hn-wheel-picker-list" id="shop-pick">
      ${state.shops
        .map(
          (s) =>
            `<button type="button" class="hn-btn hn-btn-white" data-sid="${esc(s.id)}" aria-pressed="false">${esc(s.name)}</button>`,
        )
        .join('')}
    </div>
    <button type="button" class="hn-btn hn-btn-green" id="shop-pick-go" style="width:100%;margin-top:10px">Đưa vào danh sách</button>`,
    onMount: (root) => {
      const selected = new Set<string>();
      root.querySelectorAll('[data-sid]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.sid!;
          if (selected.has(id)) selected.delete(id);
          else selected.add(id);
          btn.setAttribute('aria-pressed', selected.has(id) ? 'true' : 'false');
        });
      });
      root.querySelector('#shop-pick-go')?.addEventListener('click', () => {
        void importShops([...selected], taken);
      });
    },
  });
}

async function importShops(ids: string[], taken: Set<string>): Promise<void> {
  if (!ids.length) {
    toast('Chọn ít nhất một quán');
    return;
  }
  const fresh = ids.filter((id) => !taken.has(id));
  if (!fresh.length) {
    toast('Các quán này đã có trong danh sách');
    return;
  }
  const wheelId = await ensureList();
  if (!wheelId) return;
  const wheel = state.wheels.find((w) => w.id === wheelId);
  const items = fresh
    .map((id) => state.shops.find((s) => s.id === id))
    .filter((s): s is Shop => !!s)
    .map((s) => ({ name: s.name.slice(0, 120), weight: NEW_ITEM_WEIGHT, refShopId: s.id }));
  if (!items.length) return;
  const ack = await cmd('wheel.item.addMany', { wheelId, items }, wheel?.version ?? 1);
  if (!toastCmd(ack)) return;
  closeModal();
  toast(`Đã thêm ${items.length} quán`);
}

function openMenuPicker(): void {
  if (!state.shops.length) {
    toast('Kho chưa có quán');
    return;
  }
  openModal({
    title: 'Nhập món',
    bodyHtml: `<p style="margin:0 0 8px">Chọn một quán. Toàn bộ món vào một danh sách quay riêng.</p>
      <div class="hn-wheel-picker-list" id="menu-pick">
      ${state.shops
        .map(
          (s) =>
            `<button type="button" class="hn-btn hn-btn-white" data-sid="${esc(s.id)}">${esc(s.name)} <span style="font-weight:600">(${s.menu.length} món)</span></button>`,
        )
        .join('')}
      </div>`,
    onMount: (root) => {
      root.querySelectorAll('[data-sid]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const shop = state.shops.find((s) => s.id === (btn as HTMLElement).dataset.sid);
          if (shop) void importMenu(shop);
        });
      });
    },
  });
}

async function importMenu(shop: Shop): Promise<void> {
  if (!shop.menu.length) {
    toast('Quán chưa có món');
    return;
  }
  if (shop.menu.length > 60) {
    toast('Menu dài hơn 60 món');
    return;
  }
  if (!canPerm('wheel.create')) {
    toast('Không được tạo danh sách');
    return;
  }
  const title = `Món · ${shop.name}`.slice(0, 120);
  const created = await cmd('wheel.create', { title });
  if (!created.ok || !created.result) {
    toast('Chưa tạo được danh sách món');
    return;
  }
  const wheelId = (created.result as { id: string }).id;
  const ack = await cmd(
    'wheel.item.addMany',
    {
      wheelId,
      items: shop.menu.map((m) => ({ name: m.name.slice(0, 120), weight: NEW_ITEM_WEIGHT })),
    },
    1,
  );
  if (!toastCmd(ack)) {
    if (canPerm('wheel.delete')) await cmd('wheel.delete', { id: wheelId });
    return;
  }
  state.ui.wheelId = wheelId;
  closeModal();
  toast(`Đã nhập ${shop.menu.length} món`);
  notify();
}

export function titleQuay(): { chip: string; fun: string } {
  return { chip: 'VÒNG QUAY', fun: 'QUAY XONG KHÔNG CÃI!' };
}

export function renderQuay(): string {
  const wheels = freeWheels();
  let wheel = wheels.find((w) => w.id === state.ui.wheelId) || wheels[0];
  if (wheel && state.ui.wheelId !== wheel.id) state.ui.wheelId = wheel.id;

  const items = wheel?.items || [];
  const spinning = wheel ? activeSpin(wheel.id) : undefined;
  const last = wheel ? latestSpin(wheel.id) : undefined;
  const layout = segmentLayout(items);

  let angle = 0;
  if (spinning) angle = angleNow(spinning);
  else if (last) {
    const itemsSnap = JSON.parse(last.itemsJson) as { weight: number }[];
    angle = spinAngle(last.resultIndex, itemsSnap);
  }

  const segs = layout.map((s, i) => {
    const ink = inkFor(s.color);
    return {
      sep: s.start - 90,
      rot: s.mid - 90,
      name: s.name || items[i]?.name || '',
      ink,
      span: Math.max(8, s.end - s.start),
    };
  });

  const canEdit = canPerm('wheel.edit');
  const canCreate = canPerm('wheel.create');
  let spinLabel = 'Quay';
  let disabled = false;
  if (!canPerm('wheel.spin')) {
    spinLabel = 'Chỉ xem';
    disabled = true;
  } else if (items.length < 2) {
    spinLabel = 'Thêm ít nhất 2 ô';
    disabled = true;
  } else if (spinning) {
    spinLabel = 'Đang quay…';
    disabled = true;
  }

  const hasWinner = !!(last && !spinning && wheel);
  const count = wheel ? spinsToday(wheel.id) : 0;
  const soundIcon = state.ui.soundOn ? ICONS.soundOn : ICONS.soundOff;
  const current = wheel;
  const draftRows = current ? [...drafts.entries()].filter(([, d]) => d.wheelId === current.id) : [];

  const rows = items
    .map((r, i) => {
      const dot = SHOP_COLORS[i % SHOP_COLORS.length];
      return `<li class="hn-wheel-row">
        <span class="hn-wheel-swatch" aria-hidden="true" style="background:${dot}"></span>
        <input class="hn-input" data-iname="${r.id}" aria-label="Tên ô" value="${esc(r.name)}" ${canEdit ? '' : 'readonly'}>
        ${canEdit ? `<button class="hn-wheel-remove" type="button" data-iremove="${r.id}" aria-label="Bỏ ${esc(r.name)}">${ICONS.x}</button>` : ''}
      </li>`;
    })
    .join('');

  const draftHtml = draftRows
    .map(([id, d], i) => {
      const dot = SHOP_COLORS[(items.length + i) % SHOP_COLORS.length];
      return `<li class="hn-wheel-row">
        <span class="hn-wheel-swatch" aria-hidden="true" style="background:${dot}"></span>
        <input class="hn-input" data-draft="${id}" aria-label="Tên ô mới" placeholder="Gõ tên, hoặc dán nhiều dòng" value="${esc(d.text)}">
        <button class="hn-wheel-remove" type="button" data-draft-remove="${id}" aria-label="Bỏ thẻ">${ICONS.x}</button>
      </li>`;
    })
    .join('');

  const history = current ? state.spins.filter((s) => s.wheelId === current.id).slice(0, 20) : [];
  const log = history
    .map((s) => {
      const d = new Date(s.startedAt);
      const when = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const who = memberById(s.byMember)?.displayName || '—';
      const name = spinSettled(s) ? s.resultName : 'đang quay';
      return `<div class="hn-wheel-log-row"><time>${when}</time><span class="hn-wheel-log-who">${esc(who)}</span><b>${esc(name)}</b></div>`;
    })
    .join('');

  const picker =
    wheels.length > 1
      ? `<label class="hn-wheel-pick-label">Danh sách quay
          <select class="hn-input" id="wheel-pick" aria-label="Danh sách quay">
            ${wheels
              .map(
                (w) =>
                  `<option value="${esc(w.id)}" ${w.id === wheel?.id ? 'selected' : ''}>${esc(w.title)} (${w.items.length})</option>`,
              )
              .join('')}
          </select>
        </label>`
      : '';

  const actions =
    canEdit
      ? `<div class="hn-wheel-actions">
          <button type="button" class="hn-btn hn-btn-green" data-act="add-card">Thêm</button>
          <button type="button" class="hn-btn hn-btn-white" data-act="import-shops">Nhập cửa hàng</button>
          <button type="button" class="hn-btn hn-btn-white" data-act="import-menu" ${canCreate ? '' : 'disabled'}>Nhập món</button>
        </div>`
      : '';

  return `<main class="hn-main">
    ${wheel ? `<div class="hn-wheel-chat">${renderChatPanel(`wheel:${wheel.id}`, { title: 'Chat vòng', collapsible: true })}</div>` : ''}
    <div class="hn-quay-wrap">
      <section aria-label="Bàn xoay" class="hn-panel hn-paper-fold hn-wheel-stage">
        <button type="button" class="hn-btn hn-btn-white hn-wheel-sound" data-act="sound" aria-pressed="${state.ui.soundOn}" aria-label="${state.ui.soundOn ? 'Tắt tiếng' : 'Bật tiếng'}">${soundIcon} Âm thanh <span aria-hidden="true"></span></button>
        <div class="hn-wheel-play${hasWinner ? ' has-winner' : ''}">
        <div class="hn-wheel-controls">
        <div class="hn-wheel-disk">
          <div class="hn-pointer-outer" aria-hidden="true"></div>
          <div class="hn-pointer-inner" aria-hidden="true"></div>
          <div class="hn-wheel-clip">
          <div class="hn-wheel-face" id="wheel-face" style="background:${conic(items)};--wheel-angle:${angle}deg;transform:rotate(${angle}deg);transition:none">
            ${segs
              .map(
                (s) => `
              <div style="position:absolute;left:50%;top:50%;width:50%;height:3px;margin-top:-1.5px;background:#1B1B1B;transform-origin:0 50%;transform:rotate(${s.sep}deg);z-index:1"></div>
              <div class="hn-wheel-ray" style="--ray-angle:${s.rot}deg">
                <span class="hn-wheel-label" title="${esc(s.name)}" style="color:${s.ink};font-size:${s.span < 28 ? 11 : 13}px;max-width:${Math.min(110, s.span * 2.2)}px">${esc(s.name)}</span>
              </div>`,
              )
              .join('')}
          </div>
          </div>
          <div class="hn-hub">${ICONS.paw}</div>
        </div>
        <button type="button" class="hn-btn hn-btn-red hn-wheel-spin" data-act="spin" data-cmd="wheel.spin" ${disabled ? 'disabled' : ''}>${ICONS.history}${spinLabel}</button>
        </div>
        ${
          hasWinner
            ? `<div role="status" class="hn-wheel-result">
          <span class="hn-wheel-stamp">TRỜI ĐÃ ĐỊNH</span>
          <div class="hn-wheel-verdict">
            <div class="hn-wheel-winner">${esc(last!.resultName)}</div>
            <div style="font-size:14px;color:#3D3D3D;margin-top:2px">${esc(verdict(count))}</div>
          </div>
        </div>`
            : ''
        }
        </div>
      </section>
      <section style="min-width:0">
        <div class="hn-panel hn-paper-fold hn-wheel-editor">
          <div class="hn-section-head"><h2 class="hn-h2"><span>Danh sách</span></h2></div>
          ${picker}
          ${
            wheel
              ? `<input class="hn-input" id="wheel-title" aria-label="Tên danh sách" value="${esc(wheel.title)}" ${canEdit ? '' : 'readonly'}>`
              : '<p>Chưa có danh sách</p>'
          }
          <ul class="hn-wheel-items">${rows}${draftHtml}</ul>
          ${actions}
          <div class="hn-wheel-log">
            <h3>Lịch sử quay</h3>
            ${log || '<p>Chưa có lượt quay</p>'}
          </div>
        </div>
      </section>
    </div>
  </main>`;
}

export function bindQuay(root: HTMLElement): void {
  const wheel = pickedWheel();
  if (wheel && state.ui.wheelId !== wheel.id) state.ui.wheelId = wheel.id;
  if (wheel) setChatSubs([`wheel:${wheel.id}`]);
  else setChatSubs([]);
  bindChatPanel(root);

  const spinning = wheel ? activeSpin(wheel.id) : undefined;
  if (spinning) runSpinLoop(spinning);
  else stopSpinLoop();

  root.querySelector('[data-act="sound"]')?.addEventListener('click', () => {
    resumeAudio();
    setSound(!state.ui.soundOn);
  });

  root.querySelector('#wheel-pick')?.addEventListener('change', (e) => {
    state.ui.wheelId = (e.target as HTMLSelectElement).value;
    notify();
  });

  root.querySelector('#wheel-title')?.addEventListener('change', async (e) => {
    if (!wheel) return;
    await cmd(
      'wheel.rename',
      { id: wheel.id, title: (e.target as HTMLInputElement).value },
      wheel.version,
    );
  });

  root.querySelectorAll('[data-iname]').forEach((el) => {
    el.addEventListener('change', async () => {
      await cmd(
        'wheel.item.update',
        { id: (el as HTMLElement).dataset.iname, name: (el as HTMLInputElement).value },
        wheel?.version,
      );
    });
  });

  root.querySelectorAll('[data-iremove]').forEach((el) => {
    el.addEventListener('click', async () => {
      await cmd('wheel.item.remove', { id: (el as HTMLElement).dataset.iremove });
    });
  });

  root.querySelectorAll('[data-draft]').forEach((el) => {
    const input = el as HTMLInputElement;
    const id = input.dataset.draft!;
    input.addEventListener('input', () => {
      const row = drafts.get(id);
      if (row) row.text = input.value;
    });
    input.addEventListener('paste', (e) => {
      const text = (e as ClipboardEvent).clipboardData?.getData('text') || '';
      if (!/[\r\n]/.test(text)) return;
      e.preventDefault();
      const row = drafts.get(id);
      if (!row) return;
      row.text = text;
      input.value = text;
      void commitDraft(id);
    });
    input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        e.preventDefault();
        void commitDraft(id);
      }
    });
    input.addEventListener('blur', () => {
      void commitDraft(id);
    });
  });

  root.querySelectorAll('[data-draft-remove]').forEach((el) => {
    el.addEventListener('click', () => {
      drafts.delete((el as HTMLElement).dataset.draftRemove!);
      notify();
    });
  });

  root.querySelector('[data-act="add-card"]')?.addEventListener('click', async () => {
    const wheelId = await ensureList();
    if (!wheelId) return;
    const id = uuid();
    drafts.set(id, { wheelId, text: '' });
    focusDraftId = id;
    notify();
  });

  root.querySelector('[data-act="import-shops"]')?.addEventListener('click', () => {
    openShopPicker();
  });

  root.querySelector('[data-act="import-menu"]')?.addEventListener('click', () => {
    openMenuPicker();
  });

  root.querySelector('[data-act="spin"]')?.addEventListener('click', async () => {
    if (!wheel || !canPerm('wheel.spin')) return;
    if (!state.connected && !state.mock) {
      toast('Mất mạng, chưa quay');
      return;
    }
    resumeAudio();
    lastTick = Date.now();
    const ack = await cmd('wheel.spin', { wheelId: wheel.id });
    if (!ack.ok) {
      if (ack.error === 'spinning') toast('Đang quay mà');
      else if (ack.error === 'forbidden') toast('Không được quay');
      return;
    }
    const res = ack.result as {
      spinId?: string;
      id?: string;
      wheelId: string;
      resultIndex: number;
      resultName: string;
      startedAt: number;
      durationMs: number;
      items?: unknown[];
    };
    if (res && !state.mock) {
      const spin: Spin = {
        id: res.spinId || res.id || uuid(),
        wheelId: res.wheelId || wheel.id,
        byMember: state.me!.id,
        itemsJson: JSON.stringify(res.items || wheel.items),
        resultIndex: res.resultIndex,
        resultName: res.resultName,
        startedAt: res.startedAt,
        durationMs: res.durationMs,
      };
      ownSpins.add(spin.id);
      if (!state.spins.some((s) => s.id === spin.id)) state.spins.unshift(spin);
      notify();
    } else if (res && state.mock) {
      const id = res.spinId || res.id;
      if (id) ownSpins.add(id);
    }
    if (res && state.ui.soundOn) {
      const dur = Math.max(1, res.durationMs || 4300);
      const t0 = performance.now();
      const tick = () => {
        if (shouldRevealResult(spinProgress(performance.now() - t0, dur))) {
          beep(880, 0.15, 'sine');
          return;
        }
        if (Date.now() - lastTick > 80) {
          beep(420 + Math.random() * 80, 0.03);
          lastTick = Date.now();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });

  if (focusDraftId) {
    const el = root.querySelector<HTMLInputElement>(`[data-draft="${CSS.escape(focusDraftId)}"]`);
    focusDraftId = null;
    el?.focus();
  }
}
