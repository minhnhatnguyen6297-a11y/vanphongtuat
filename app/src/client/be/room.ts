import { LOBBY_CHAT_SCOPE } from '../../shared/chat.js';
import { esc } from '../../shared/esc.js';
import {
  countsAsPresence,
  idlePhase,
  IDLE_DEFAULTS,
  type IdleCfg,
  type Kind,
  type LightName,
  type Swim,
} from '../../shared/be.js';
import { canPerm, state } from '../store.js';
import { bindChatPanel, renderChatLogHtml, renderChatPanel } from '../ui/chat-panel.js';
import { toast } from '../ui/toast.js';
import { bePulse, cmd, onBeMessage, onWsReady, sealWs, setBeJoined } from '../ws.js';
import { bakeSprite } from './paint.js';
import { openPad, type PadResult } from './pad.js';
import { startTank, type CreatureView, type TankHandle, type TankModel } from './tank.js';

type Meta = {
  id: string;
  authorId: string;
  authorName: string;
  kind: Kind;
  name: string;
  swim: Swim;
  wave: boolean;
  hidden: boolean;
  sprite: string;
  growth: number;
  fed: number;
  createdAt: string;
  placementId: string | null;
  x: number;
  y: number;
  reports: number;
};

type NetDrawing = Omit<Meta, 'placementId' | 'x' | 'y' | 'swim'> & {
  swim: string;
  placement: { id: string; x: number; y: number } | null;
};

const model: TankModel = {
  sand: 0,
  lighting: 'auto',
  waterLevel: 0.78,
  rocks: 1,
  wood: true,
  dirt: 0,
  creatures: [],
  pellets: [],
  foodImg: null,
  now: () => Date.now(),
  fx: { hold: false, pointer: 0, drag: null, lure: null, startleUntil: 0, vacuum: null },
};

const metas: Meta[] = [];
const imgCache = new Map<string, HTMLImageElement>();
const imgLoading = new Set<string>();
let wallet = 0;
let unlocks: string[] = [];
let meId = '';
let offset = 0;
let tank: TankHandle | null = null;
let rootEl: HTMLElement | null = null;
let kicked = false;
let cfg: IdleCfg = { ...IDLE_DEFAULTS };
let lastActive = 0;
let hiddenAt: number | null = null;
let pulseTimer = 0;
let lastPulse = 0;
let idleTimer = 0;
let offBe: (() => void) | null = null;
let offReady: (() => void) | null = null;
const eatPending = new Set<string>();

function isBoss(): boolean {
  const me = state.me;
  return !!(me && (me.isOperator || me.tier === 'chu_xi'));
}

export function renderBeRoom(): string {
  return `<main class="hn-be" data-be-root data-be-fish-count="0">
    <div class="hn-be-stage" data-be-stage>
      <div class="hn-be-tools">
        <button type="button" class="hn-btn" data-be-add>Thêm</button>
        <button type="button" class="hn-btn" data-be-feed>Cho ăn</button>
        <button type="button" class="hn-btn" data-be-clean>Hút cặn</button>
        <button type="button" class="hn-btn hn-btn-white" data-be-list>Danh sách cá</button>
        <button type="button" class="hn-btn hn-btn-white" data-be-setup>Sửa bể</button>
        <span class="hn-be-scales" data-be-scales>Vảy 0</span>
        <span class="hn-be-count" data-be-count>Cá 0</span>
      </div>
      <div class="hn-be-glass">
        <canvas data-be-canvas aria-label="Bể cá văn phòng"></canvas>
        <div class="hn-be-warn" data-be-warn hidden>
          <span>Sắp rời bể vì vắng.</span>
          <button type="button" class="hn-btn" data-be-stay>Tôi vẫn ở đây</button>
        </div>
        <div class="hn-be-card" data-be-card hidden></div>
        <div class="hn-be-pop" data-be-pop hidden></div>
      </div>
    </div>
    <aside class="hn-be-chat">${renderChatPanel(LOBBY_CHAT_SCOPE, { title: 'PHÒNG CHAT' })}</aside>
    <div class="hn-be-pad" data-be-pad hidden></div>
    <div class="hn-be-kick" data-be-kick hidden>
      <div class="hn-be-kick-card">
        <h2>Bạn đã rời bể vì vắng lâu — tải lại trang để vào lại</h2>
        <button type="button" class="hn-btn hn-btn-red" data-be-reload>Vào lại</button>
      </div>
    </div>
  </main>`;
}

function paintHud(): void {
  if (!rootEl) return;
  const fish = metas.filter((m) => m.kind === 'ca' && !m.hidden && m.placementId).length;
  rootEl.dataset.beFishCount = String(fish);
  const count = rootEl.querySelector('[data-be-count]');
  if (count) count.textContent = `Cá ${fish}`;
  const sc = rootEl.querySelector('[data-be-scales]');
  if (sc) sc.textContent = `Vảy ${wallet}`;
}

function rebuild(): void {
  const food = [...metas].reverse().find((m) => m.kind === 'thuc_an' && !m.hidden);
  model.foodImg = food ? imgCache.get(food.sprite) || null : null;
  if (food && !imgCache.has(food.sprite)) wantImg(food.sprite);
  const creatures: CreatureView[] = [];
  for (const m of metas) {
    if (m.hidden || !m.placementId) continue;
    if (!imgCache.has(m.sprite)) wantImg(m.sprite);
    const ready = imgCache.get(m.sprite);
    creatures.push({
      id: m.id,
      kind: m.kind,
      swim: m.swim,
      wave: m.wave,
      growth: m.growth,
      x: m.x,
      y: m.y,
      hidden: false,
      img: ready && ready.complete ? ready : null,
    });
  }
  model.creatures = creatures;
  paintHud();
  tank?.poke();
}

function wantImg(url: string): void {
  if (!url || imgCache.has(url) || imgLoading.has(url)) return;
  imgLoading.add(url);
  const img = new Image();
  img.onload = () => {
    imgLoading.delete(url);
    imgCache.set(url, img);
    rebuild();
  };
  img.onerror = () => imgLoading.delete(url);
  img.src = url;
}

function upsert(d: NetDrawing): void {
  const row: Meta = {
    id: d.id,
    authorId: d.authorId,
    authorName: d.authorName,
    kind: d.kind,
    name: d.name,
    swim: (d.swim as Swim) || 'active',
    wave: !!d.wave,
    hidden: !!d.hidden,
    sprite: d.sprite,
    growth: d.growth,
    fed: d.fed,
    createdAt: d.createdAt,
    placementId: d.placement?.id ?? null,
    x: d.placement?.x ?? 0.5,
    y: d.placement?.y ?? 0.5,
    reports: d.reports || 0,
  };
  const i = metas.findIndex((m) => m.id === row.id);
  if (i >= 0) metas[i] = { ...metas[i], ...row };
  else metas.push(row);
}

function applyState(data: {
  serverNow: number;
  idle: IdleCfg;
  tank: { sand: number; lighting: LightName; waterLevel: number; rocks: number; wood: boolean; dirt: number };
  wallet: number;
  unlocks: string[];
  drawings: NetDrawing[];
  pellets: { id: string; x: number; bornAt: string }[];
  meId: string;
}): void {
  offset = data.serverNow - Date.now();
  model.now = () => Date.now() + offset;
  cfg = data.idle || cfg;
  model.sand = data.tank.sand;
  model.lighting = data.tank.lighting;
  model.waterLevel = data.tank.waterLevel;
  model.rocks = data.tank.rocks;
  model.wood = data.tank.wood;
  model.dirt = data.tank.dirt;
  wallet = data.wallet;
  unlocks = data.unlocks || [];
  meId = data.meId;
  metas.splice(0, metas.length);
  for (const d of data.drawings || []) upsert(d);
  model.pellets = (data.pellets || []).map((p) => ({ id: p.id, x: p.x, bornAt: Date.parse(p.bornAt), eaten: false }));
  rebuild();
}

function applyEvent(name: string, data: unknown): void {
  const d = data as Record<string, any>;
  if (name === 'drawing' && d) upsert(d as NetDrawing);
  else if (name === 'feed') {
    model.dirt = Number(d.dirt ?? model.dirt);
    for (const p of d.pellets || []) {
      if (!model.pellets.some((x) => x.id === p.id)) {
        model.pellets.push({ id: p.id, x: p.x, bornAt: Date.parse(p.bornAt), eaten: false });
      }
    }
  } else if (name === 'eat') {
    const p = model.pellets.find((x) => x.id === d.pelletId);
    if (p) p.eaten = true;
    const m = metas.find((x) => x.id === d.drawingId);
    if (m) m.growth = d.growth;
    if (d.walletFor && d.walletFor === meId) wallet = d.wallet;
  } else if (name === 'clean') {
    model.pellets = [];
    model.dirt = Number(d.dirt ?? 0);
    if (d.walletFor === meId) wallet = d.wallet;
  } else if (name === 'tank') {
    model.sand = d.sand;
    model.lighting = d.lighting;
    model.waterLevel = d.waterLevel;
    model.rocks = d.rocks;
    model.wood = !!d.wood;
    model.dirt = d.dirt ?? model.dirt;
  } else if (name === 'move') {
    const m = metas.find((x) => x.placementId === d.placementId);
    if (m) {
      m.x = d.x;
      m.y = d.y;
    }
  } else if (name === 'rename') {
    const m = metas.find((x) => x.id === d.id);
    if (m) m.name = d.name;
  } else if (name === 'hide') {
    const m = metas.find((x) => x.id === d.id);
    if (m) m.hidden = true;
  }
  rebuild();
}

function idleCfg(): IdleCfg {
  const w = window as Window & { __BE_IDLE_VISIBLE_MS?: number; __BE_IDLE_HIDDEN_MS?: number; __BE_IDLE_WARN_MS?: number };
  if (!w.__BE_IDLE_VISIBLE_MS) return cfg;
  return {
    visibleMs: w.__BE_IDLE_VISIBLE_MS,
    hiddenMs: w.__BE_IDLE_HIDDEN_MS || Math.min(cfg.hiddenMs, w.__BE_IDLE_VISIBLE_MS),
    warnMs: w.__BE_IDLE_WARN_MS ?? cfg.warnMs,
  };
}

function markActive(kind: string): void {
  if (kicked || !countsAsPresence(kind)) return;
  lastActive = Date.now();
  const warn = rootEl?.querySelector('[data-be-warn]') as HTMLElement | null;
  if (warn) warn.hidden = true;
  const now = Date.now();
  if (now - lastPulse > 15000) {
    lastPulse = now;
    bePulse(true, !document.hidden);
    return;
  }
  if (pulseTimer) return;
  pulseTimer = window.setTimeout(() => {
    pulseTimer = 0;
    lastPulse = Date.now();
    if (!kicked) bePulse(true, !document.hidden);
  }, 15000);
}

function doKick(): void {
  if (kicked) return;
  kicked = true;
  window.clearTimeout(pulseTimer);
  window.clearInterval(idleTimer);
  tank?.stop();
  tank = null;
  for (const img of imgCache.values()) img.src = '';
  imgCache.clear();
  sealWs();
  if (!rootEl) return;
  const stage = rootEl.querySelector('[data-be-stage]') as HTMLElement | null;
  const chat = rootEl.querySelector('.hn-be-chat') as HTMLElement | null;
  const pad = rootEl.querySelector('[data-be-pad]') as HTMLElement | null;
  if (stage) stage.hidden = true;
  if (chat) chat.hidden = true;
  if (pad) pad.hidden = true;
  const kick = rootEl.querySelector('[data-be-kick]') as HTMLElement | null;
  if (kick) kick.hidden = false;
}

async function refresh(): Promise<void> {
  const ack = await cmd('be.open', {});
  if (!ack.ok || !ack.result) return;
  applyState(ack.result as Parameters<typeof applyState>[0]);
}

async function release(kind: Kind, result: PadResult, editId?: string): Promise<void> {
  markActive('draw');
  let blob: Blob;
  try {
    blob = await bakeSprite(result.doc);
  } catch {
    toast('Chưa nướng được');
    return;
  }
  const res = await fetch('/api/be/sprite', {
    method: 'POST',
    headers: { 'X-HNG': '1', 'Content-Type': 'image/png' },
    body: blob,
  });
  if (!res.ok) {
    toast('Chưa lưu được hình');
    return;
  }
  const saved = (await res.json()) as { hash: string; url: string };
  const preview = URL.createObjectURL(blob);
  const ack = await cmd('be.save', {
    ...(editId ? { id: editId } : {}),
    kind,
    name: result.name,
    strokes: result.doc,
    swim: result.swim,
    wave: result.wave,
    spriteHash: saved.hash,
    place: true,
    startGrowth: result.growth,
  });
  URL.revokeObjectURL(preview);
  if (!ack.ok) {
    toast(ack.error === 'be_full' ? 'Bể đủ cá rồi' : 'Chưa thả được');
    return;
  }
  const drawing = (ack.result as { drawing?: NetDrawing } | undefined)?.drawing;
  if (drawing) upsert(drawing);
  rebuild();
  toast('Đã thả');
}

function closePop(): void {
  const pop = rootEl?.querySelector('[data-be-pop]') as HTMLElement | null;
  if (pop) {
    pop.hidden = true;
    pop.innerHTML = '';
  }
}

function showPop(html: string): void {
  const pop = rootEl?.querySelector('[data-be-pop]') as HTMLElement | null;
  if (!pop) return;
  pop.hidden = false;
  pop.innerHTML = html;
  pop.querySelector('[data-pop-close]')?.addEventListener('click', closePop);
}

function openKind(kind: Kind, edit?: Meta, initialStrokes?: PadResult['doc']): void {
  const pad = rootEl?.querySelector('[data-be-pad]') as HTMLElement | null;
  if (!pad) return;
  closePop();
  tank?.setHold(true);
  openPad(pad, {
    kind,
    unlocks,
    initial: initialStrokes,
    name: edit?.name,
    swim: edit?.swim,
    wave: edit?.wave,
    onCancel: () => tank?.setHold(false),
    onDone: (result) => {
      tank?.setHold(false);
      void release(kind, result, edit?.id);
    },
  });
}

function showCard(id: string): void {
  const m = metas.find((x) => x.id === id);
  const card = rootEl?.querySelector('[data-be-card]') as HTMLElement | null;
  if (!m || !card) return;
  const ageMs = Date.now() - new Date(m.createdAt).getTime();
  const mins = Math.max(0, Math.floor(ageMs / 60000));
  const age = mins < 1 ? 'mới thả' : mins < 60 ? `${mins} phút` : `${Math.floor(mins / 60)} giờ`;
  const size = m.growth < 0.8 ? 'nhỏ' : m.growth < 1.05 ? 'vừa' : 'lớn';
  const mine = m.authorId === meId;
  card.hidden = false;
  card.innerHTML = `<div class="hn-be-card-inner">
    <b>${esc(m.name)}</b>
    <span>${age} · cỡ ${size} · ${esc(m.authorName)}</span>
    ${m.reports && isBoss() ? `<span>Báo cáo ${m.reports}</span>` : ''}
    ${mine ? `<input data-rename maxlength="24" value="${esc(m.name)}" aria-label="Tên cá"><button type="button" class="hn-btn hn-btn-white" data-rename-go>Đổi tên</button><button type="button" class="hn-btn hn-btn-white" data-edit>Sửa tranh</button>` : ''}
    <button type="button" class="hn-btn hn-btn-white" data-report>Báo cáo</button>
    ${isBoss() ? `<button type="button" class="hn-btn hn-btn-red" data-hide>Ẩn</button>` : ''}
    <button type="button" class="hn-btn hn-btn-white" data-card-close>Đóng</button>
  </div>`;
  card.querySelector('[data-card-close]')?.addEventListener('click', () => {
    card.hidden = true;
  });
  card.querySelector('[data-rename-go]')?.addEventListener('click', () => {
    const name = (card.querySelector('[data-rename]') as HTMLInputElement).value.trim();
    if (!name) return;
    markActive('draw');
    void cmd('be.rename', { id: m.id, name }).then((ack) => {
      if (ack.ok) {
        m.name = name;
        paintHud();
        toast('Đã đổi tên');
      }
    });
  });
  card.querySelector('[data-edit]')?.addEventListener('click', async () => {
    markActive('draw');
    const ack = await cmd('be.strokes', { id: m.id });
    if (!ack.ok) {
      toast('Không mở được');
      return;
    }
    const strokes = (ack.result as { strokes?: PadResult['doc'] }).strokes;
    card.hidden = true;
    openKind(m.kind, m, strokes);
  });
  card.querySelector('[data-report]')?.addEventListener('click', () => {
    markActive('pointer');
    void cmd('be.report', { id: m.id }).then((ack) => toast(ack.ok ? 'Đã báo' : 'Chưa báo được'));
  });
  card.querySelector('[data-hide]')?.addEventListener('click', () => {
    markActive('pointer');
    void cmd('be.hide', { id: m.id }).then((ack) => {
      if (!ack.ok) toast('Không ẩn được');
      else card.hidden = true;
    });
  });
}

function bindCanvas(canvas: HTMLCanvasElement): void {
  let dragId: string | null = null;
  let moved = false;
  let holdTimer = 0;
  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, px: e.clientX - r.left, py: e.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    markActive('pointer');
    const p = local(e);
    const hit = tank?.hits().find((h) => Math.hypot(h.x - p.px, h.y - p.py) < h.r);
    if (hit) {
      dragId = hit.id;
      moved = false;
      const m = metas.find((x) => x.id === hit.id);
      model.fx.drag = { id: hit.id, x: m?.x ?? p.x, y: m?.y ?? p.y };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    model.fx.lure = { x: p.x, y: p.y, until: model.now() + 2000 };
    window.clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      model.fx.startleUntil = model.now() + 420;
    }, 260);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragId || !model.fx.drag) return;
    const p = local(e);
    model.fx.drag = { id: dragId, x: Math.min(0.96, Math.max(0.04, p.x)), y: Math.min(0.92, Math.max(0.12, p.y)) };
    moved = true;
    markActive('drag');
  });
  canvas.addEventListener('pointerup', () => {
    window.clearTimeout(holdTimer);
    if (dragId && model.fx.drag) {
      const m = metas.find((x) => x.id === dragId);
      if (moved && m?.placementId) {
        m.x = model.fx.drag.x;
        m.y = model.fx.drag.y;
        void cmd('be.move', { placementId: m.placementId, x: m.x, y: m.y });
        rebuild();
      } else if (dragId) showCard(dragId);
    }
    model.fx.drag = null;
    dragId = null;
  });
}

export function bindBeRoom(root: HTMLElement): void {
  rootEl = root.querySelector('[data-be-root]') as HTMLElement | null;
  if (!rootEl || kicked) return;
  if (tank) return;
  lastActive = Date.now();
  hiddenAt = document.hidden ? Date.now() : null;
  const canvas = rootEl.querySelector('[data-be-canvas]') as HTMLCanvasElement;
  tank = startTank(canvas, model, (pelletId, fishId) => {
    if (eatPending.has(pelletId)) return;
    const p = model.pellets.find((x) => x.id === pelletId);
    if (!p || p.eaten) return;
    p.eaten = true;
    eatPending.add(pelletId);
    void cmd('be.eat', { pelletId, drawingId: fishId }).then((ack) => {
      eatPending.delete(pelletId);
      if (!ack.ok) p.eaten = false;
    });
  });
  bindCanvas(canvas);
  bindChatPanel(rootEl);
  setBeJoined(true);
  void refresh();
  offReady = onWsReady(() => {
    if (!kicked) void refresh();
  });
  offBe = onBeMessage((msg) => {
    if (msg.t === 'be:kicked') doKick();
    else if (msg.t === 'be' && msg.name) applyEvent(msg.name, msg.data);
  });

  const onVis = () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      bePulse(false, false);
    } else {
      hiddenAt = null;
      bePulse(false, true);
    }
  };
  document.addEventListener('visibilitychange', onVis);
  const onPointer = () => markActive('pointer');
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return;
    markActive('key');
  };
  const onWheel = () => markActive('wheel');
  rootEl.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);
  rootEl.addEventListener('wheel', onWheel, { passive: true });

  rootEl.querySelector('[data-be-stay]')?.addEventListener('click', () => markActive('still-here'));
  rootEl.querySelector('[data-be-reload]')?.addEventListener('click', () => location.reload());
  rootEl.querySelector('[data-chat-input]')?.addEventListener('keydown', () => markActive('key'));
  rootEl.querySelector('[data-chat-send]')?.addEventListener('click', () => markActive('chat-send'));

  rootEl.querySelector('[data-be-add]')?.addEventListener('click', () => {
    markActive('pointer');
    const shop = (['stamp_fin', 'khuon_ca2', 'khuon_cay'] as const)
      .filter((id) => !unlocks.includes(id))
      .map((id) => {
        const cost = id === 'stamp_fin' || id === 'khuon_cay' ? 2 : 3;
        const label = id === 'stamp_fin' ? 'Tem vây' : id === 'khuon_ca2' ? 'Khuôn cá tròn' : 'Khuôn cây';
        return `<button type="button" data-unlock="${id}">Mở ${label} · ${cost} vảy</button>`;
      })
      .join('');
    showPop(`<div class="hn-be-panel">
      <button type="button" data-kind="ca">Vẽ cá</button>
      <button type="button" data-kind="cay">Vẽ cây</button>
      <button type="button" data-kind="thuc_an">Vẽ mồi</button>
      <button type="button" data-kind="do">Vẽ đồ</button>
      ${shop}
      <button type="button" data-pop-close>Đóng</button>
    </div>`);
    rootEl?.querySelectorAll('[data-kind]').forEach((btn) => {
      btn.addEventListener('click', () => openKind((btn as HTMLElement).dataset.kind as Kind));
    });
    rootEl?.querySelectorAll('[data-unlock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = (btn as HTMLElement).dataset.unlock;
        void cmd('be.unlock', { item }).then((ack) => {
          if (!ack.ok) toast(ack.error === 'be_poor' ? 'Thiếu vảy' : 'Chưa mở được');
          else {
            const r = ack.result as { wallet: number; unlocks: string[] };
            wallet = r.wallet;
            unlocks = r.unlocks;
            paintHud();
            toast('Đã mở');
            closePop();
          }
        });
      });
    });
  });

  rootEl.querySelector('[data-be-feed]')?.addEventListener('click', () => {
    markActive('feed');
    void cmd('be.feed', {}).then((ack) => {
      if (!ack.ok) toast(ack.error === 'too_much' ? 'Thừa mồi, hút đã' : 'Chưa cho ăn được');
    });
  });
  rootEl.querySelector('[data-be-clean]')?.addEventListener('click', () => {
    markActive('clean');
    model.fx.vacuum = { x: 0.5, y: 0.7, until: model.now() + 900 };
    void cmd('be.clean', {}).then((ack) => {
      if (!ack.ok) toast('Chưa hút được');
    });
  });
  rootEl.querySelector('[data-be-list]')?.addEventListener('click', () => {
    markActive('pointer');
    const rows = metas
      .filter((m) => m.kind === 'ca')
      .map(
        (m) =>
          `<button type="button" data-focus="${esc(m.id)}">${esc(m.name)}${m.hidden ? ' (ẩn)' : ''} · ${esc(m.authorName)}</button>`,
      )
      .join('');
    showPop(`<div class="hn-be-panel hn-be-list">${rows || '<p>Chưa có cá</p>'}<button type="button" data-pop-close>Đóng</button></div>`);
    rootEl?.querySelectorAll('[data-focus]').forEach((btn) => {
      btn.addEventListener('click', () => {
        closePop();
        showCard((btn as HTMLElement).dataset.focus || '');
      });
    });
  });
  rootEl.querySelector('[data-be-setup]')?.addEventListener('click', () => {
    markActive('tank-edit');
    showPop(`<div class="hn-be-panel">
      <p>Cát</p>
      <div>${[0, 1, 2].map((n) => `<button type="button" data-sand="${n}" ${model.sand === n ? 'aria-pressed="true"' : ''}>${n + 1}</button>`).join('')}</div>
      <p>Đá</p>
      <div>${[0, 1, 2].map((n) => `<button type="button" data-rock="${n}" ${model.rocks === n ? 'aria-pressed="true"' : ''}>${n + 1}</button>`).join('')}</div>
      <label><input data-wood type="checkbox" ${model.wood ? 'checked' : ''}> Gỗ lũa</label>
      <label>Mực nước <input data-water type="range" min="55" max="92" value="${Math.round(model.waterLevel * 100)}"></label>
      <label>Đèn
        <select data-light>
          <option value="auto">Theo giờ</option>
          <option value="day">Ngày</option>
          <option value="warm">Chiều</option>
          <option value="night">Đêm</option>
        </select>
      </label>
      <button type="button" class="hn-btn" data-tank-save>Lưu bể</button>
      <button type="button" data-pop-close>Đóng</button>
    </div>`);
    const light = rootEl?.querySelector('[data-light]') as HTMLSelectElement | null;
    if (light) light.value = model.lighting;
    let sand = model.sand;
    let rocks = model.rocks;
    rootEl?.querySelectorAll('[data-sand]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sand = Number((btn as HTMLElement).dataset.sand);
      });
    });
    rootEl?.querySelectorAll('[data-rock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        rocks = Number((btn as HTMLElement).dataset.rock);
      });
    });
    rootEl?.querySelector('[data-tank-save]')?.addEventListener('click', () => {
      const wood = (rootEl?.querySelector('[data-wood]') as HTMLInputElement).checked;
      const waterLevel = Number((rootEl?.querySelector('[data-water]') as HTMLInputElement).value) / 100;
      const lighting = (rootEl?.querySelector('[data-light]') as HTMLSelectElement).value;
      markActive('tank-edit');
      void cmd('be.tank', { sand, rocks, wood, waterLevel, lighting }).then((ack) => {
        if (!ack.ok) toast('Chưa lưu bể');
        else {
          toast('Đã lưu bể');
          closePop();
        }
      });
    });
  });

  idleTimer = window.setInterval(() => {
    if (kicked) return;
    const phase = idlePhase({
      now: Date.now(),
      lastActive,
      visible: !document.hidden,
      hiddenAt,
      cfg: idleCfg(),
    });
    const warn = rootEl?.querySelector('[data-be-warn]') as HTMLElement | null;
    if (phase === 'kick') doKick();
    else if (warn) warn.hidden = phase !== 'warn';
  }, 1000);

  const stopVis = onVis;
  rootEl.dataset.bound = '1';
  const prevDestroy = destroyBeRoom;
  destroyBeRoom = () => {
    document.removeEventListener('visibilitychange', stopVis);
    window.removeEventListener('keydown', onKey);
    prevDestroy();
  };
}

let destroyBeRoom = function destroyImpl(): void {
  window.clearTimeout(pulseTimer);
  window.clearInterval(idleTimer);
  tank?.stop();
  tank = null;
  offBe?.();
  offReady?.();
  offBe = null;
  offReady = null;
  if (!kicked) setBeJoined(false);
  rootEl = null;
};

export { destroyBeRoom };

export function syncBeRoom(root: HTMLElement): void {
  if (kicked) return;
  const canSend = canPerm('chat.send');
  const input = root.querySelector('[data-be-root] [data-chat-input]') as HTMLInputElement | null;
  const send = root.querySelector('[data-be-root] [data-chat-send]') as HTMLButtonElement | null;
  if (input) {
    input.disabled = !canSend;
    input.placeholder = canSend ? 'Nhắn…' : 'Không gửi được';
  }
  if (send) send.disabled = !canSend;
  const fun = document.querySelector('.hn-fun');
  if (fun && !fun.querySelector('img')) {
    const n = state.members.filter((m) => !m.disabled).length;
    fun.textContent = `DRAWQUARIUM · ${n} NGƯỜI`;
  }
  const log = root.querySelector('[data-be-root] [data-chat-log]');
  if (!log) return;
  const html = renderChatLogHtml(LOBBY_CHAT_SCOPE);
  if (log.innerHTML === html) return;
  const near = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
  log.innerHTML = html;
  if (near) log.scrollTop = log.scrollHeight;
  log.querySelectorAll('[data-chat-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      markActive('pointer');
      const id = (btn as HTMLElement).dataset.chatDel || '';
      void cmd('chat.delete', { id }).then((ack) => {
        if (!ack.ok) toast('Không xóa được');
      });
    });
  });
}
