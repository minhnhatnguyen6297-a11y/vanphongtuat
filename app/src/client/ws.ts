import {
  state,
  notify,
  patch,
  applyChatMsg,
  replaceChatSnap,
  type PermsState,
} from './store.js';
import type { ChatMsg, GameRoom, Member, Shop, Spin, TableRow, Wheel } from '../shared/types.js';
import { toast } from './ui/toast.js';

type HelloMsg = { t: 'hello'; subs: string[] };
type CmdMsg = { t: 'cmd'; opId: string; name: string; args: unknown; baseVersion?: number };
type ClientMsg = HelloMsg | CmdMsg;

type SnapMsg = { t: 'snap'; scope: string; version: number; data: unknown };
type AckMsg = { t: 'ack'; opId: string; ok: boolean; result?: unknown; error?: string; current?: unknown };
type AiMsg = { t: 'ai'; jobId: string; ok: boolean; result?: unknown; error?: string };
type ChatEvt = { t: 'chat'; scope: string; msg: ChatMsg };
type ServerMsg = SnapMsg | AckMsg | AiMsg | ChatEvt | { t: string };

type Pending = {
  msg: CmdMsg;
  resolve: (v: AckMsg) => void;
  reject: (e: Error) => void;
};

let socket: WebSocket | null = null;
let backoff = 500;
let intentionalClose = false;
const pending = new Map<string, Pending>();
const aiWaiters = new Map<string, (msg: AiMsg) => void>();

declare global {
  interface Window {
    __HNG_LIVE__?: boolean;
  }
}

export function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

function applySnap(scope: string, version: number, data: unknown): void {
  state.versions[scope] = version;
  if (scope === 'members') {
    state.members = data as Member[];
    if (state.me) {
      const fresh = state.members.find((m) => m.id === state.me!.id);
      if (fresh) state.me = { ...state.me, ...fresh };
    }
  } else if (scope === 'perms') {
    const payload = data as PermsState;
    state.perms = {
      matrix: payload.matrix || { chu_xi: [], pho_xi: [], dan_den: [], no_le: [] },
      grants: payload.grants || [],
      requests: payload.requests || [],
    };
  } else if (scope === 'shops') {
    state.shops = data as Shop[];
  } else if (scope === 'games') {
    state.games = data as GameRoom[];
  } else if (scope === 'wheels') {
    const payload = data as { wheels: Wheel[]; spins?: Spin[] } | (Wheel & { recentSpins?: Spin[] })[];
    if (Array.isArray(payload)) {
      state.wheels = payload.map((w) => {
        const { recentSpins, ...rest } = w as Wheel & { recentSpins?: Spin[] };
        return rest as Wheel;
      });
      const fromRecent: Spin[] = [];
      for (const w of payload as (Wheel & { recentSpins?: Spin[] })[]) {
        for (const s of w.recentSpins || []) {
          fromRecent.push({
            id: s.id,
            wheelId: s.wheelId || w.id,
            byMember: s.byMember,
            itemsJson: s.itemsJson,
            resultIndex: s.resultIndex,
            resultName: s.resultName,
            startedAt: s.startedAt,
            durationMs: s.durationMs,
          });
        }
      }
      if (fromRecent.length) {
        const byId = new Map(state.spins.map((s) => [s.id, s]));
        for (const s of fromRecent) byId.set(s.id, s);
        state.spins = [...byId.values()].sort((a, b) => b.startedAt - a.startedAt);
      }
    } else {
      state.wheels = payload.wheels || [];
      if (payload.spins) state.spins = payload.spins;
    }
  } else if (scope.startsWith('chat:')) {
    const inner = scope.slice(5);
    const payload = data as { scope?: string; messages?: ChatMsg[] };
    replaceChatSnap(inner, payload.messages || []);
    return;
  } else if (scope === 'table:current') {
    const payload = data as { table: TableRow | null; tables?: TableRow[]; spins?: Spin[] } | TableRow | null;
    if (payload && typeof payload === 'object' && 'table' in payload) {
      state.table = payload.table;
      if (payload.tables) state.tables = payload.tables;
      if (payload.spins) state.spins = payload.spins;
    } else {
      // legacy: raw TableRow | null
      const row = payload as TableRow | null;
      state.table = row;
      if (row) {
        const i = state.tables.findIndex((x) => x.id === row.id);
        if (i >= 0) state.tables[i] = row;
        else state.tables.unshift(row);
      }
    }
  } else if (scope.startsWith('table:')) {
    const t = data as TableRow;
    const i = state.tables.findIndex((x) => x.id === t.id);
    if (i >= 0) state.tables[i] = t;
    else state.tables.push(t);
    if (state.table?.id === t.id) state.table = t;
  }
  notify();
}

function onMessage(raw: string): void {
  let msg: ServerMsg;
  try {
    msg = JSON.parse(raw) as ServerMsg;
  } catch {
    return;
  }
  if (msg.t === 'snap') {
    const m = msg as SnapMsg;
    applySnap(m.scope, m.version, m.data);
    return;
  }
  if (msg.t === 'chat') {
    const m = msg as ChatEvt;
    applyChatMsg(m.scope, m.msg);
    return;
  }
  if (msg.t === 'ack') {
    const m = msg as AckMsg & { events?: Array<{ t: string; scope: string; msg: ChatMsg }> };
    const p = pending.get(m.opId);
    if (p) {
      pending.delete(m.opId);
      if (!m.ok && m.error === 'conflict') {
        toast('Có người vừa sửa, xem lại nhé');
      }
      // Sender cũng áp dụng chat event từ ack (tránh phụ thuộc fanout/sub race).
      if (m.ok && Array.isArray(m.events)) {
        for (const ev of m.events) {
          if (ev?.t === 'chat' && ev.scope && ev.msg) applyChatMsg(ev.scope, ev.msg);
        }
      }
      p.resolve(m);
    }
    return;
  }
  if (msg.t === 'ai') {
    const m = msg as AiMsg;
    const w = aiWaiters.get(m.jobId);
    if (w) {
      aiWaiters.delete(m.jobId);
      w(m);
    }
    return;
  }
}

function send(msg: ClientMsg): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function baseSubs(): string[] {
  return ['table:current', 'shops', 'wheels', 'members', 'perms', 'games', ...state.chatSubs];
}

function hello(): void {
  send({ t: 'hello', subs: baseSubs() });
}

/** Đổi chat sub (bàn / vòng) → hello lại; server không giữ sub cũ. */
export function setChatSubs(scopes: string[]): void {
  const next = scopes.map((s) => (s.startsWith('chat:') ? s : `chat:${s}`));
  const prev = state.chatSubs;
  const same =
    prev.length === next.length && prev.every((s, i) => s === next[i]);
  state.chatSubs = next;
  // Tránh vòng lặp: bind* gọi setChatSubs mỗi render → hello → snap → notify → render.
  if (same) return;
  if (socket?.readyState === WebSocket.OPEN) hello();
}

function resendPending(): void {
  for (const p of pending.values()) send(p.msg);
}

function scheduleReconnect(): void {
  if (intentionalClose || state.mock) return;
  const wait = backoff;
  backoff = Math.min(10_000, Math.round(backoff * 1.6));
  setTimeout(connectWs, wait);
}

export function connectWs(): void {
  if (state.mock) return;
  intentionalClose = false;
  try {
    socket?.close();
  } catch {
    /* ignore */
  }
  const ws = new WebSocket(wsUrl());
  socket = ws;
  ws.onopen = () => {
    backoff = 500;
    patch((s) => {
      s.connected = true;
    });
    hello();
    resendPending();
  };
  ws.onmessage = (ev) => onMessage(String(ev.data));
  ws.onclose = () => {
    patch((s) => {
      s.connected = false;
    });
    scheduleReconnect();
  };
  ws.onerror = () => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  };
}

export function disconnectWs(): void {
  intentionalClose = true;
  socket?.close();
  socket = null;
}

export function cmd(name: string, args: unknown, baseVersion?: number): Promise<AckMsg> {
  if (state.mock) {
    return Promise.resolve(mockCmd(name, args));
  }
  const opId = uuid();
  const msg: CmdMsg = { t: 'cmd', opId, name, args, baseVersion };
  return new Promise((resolve, reject) => {
    pending.set(opId, { msg, resolve, reject });
    if (socket?.readyState === WebSocket.OPEN) send(msg);
    // else: will resend on reconnect
  });
}

export function waitAi(jobId: string): Promise<AiMsg> {
  return new Promise((resolve) => {
    aiWaiters.set(jobId, resolve);
  });
}

/** Minimal mock command handlers for offline UI work */
function mockCmd(name: string, args: unknown): AckMsg {
  const a = args as Record<string, unknown>;
  const me = state.me!;
  if (name === 'vote.set') {
    const table = state.table!;
    table.votes = table.votes.filter((v) => v.memberId !== me.id);
    if (a.shopId) {
      table.votes.push({ tableId: table.id, memberId: me.id, shopId: String(a.shopId) });
    }
    table.version += 1;
    notify();
    return { t: 'ack', opId: uuid(), ok: true, result: {} };
  }
  if (name === 'table.create') {
    const shopIds = (a.shopIds as string[]) || [];
    const id = (state.tables.reduce((m, t) => Math.max(m, t.id), 0) || 11) + 1;
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const voteSec = typeof a.voteEndsInSec === 'number' ? a.voteEndsInSec : 0;
    const row: TableRow = {
      id,
      date,
      hostId: me.id,
      winnerShopId: null,
      winnerSpinId: null,
      pickupMemberId: null,
      pickupSpinId: null,
      billTotal: null,
      billMode: 'item',
      version: 1,
      voteEndsAt: voteSec > 0 ? new Date(Date.now() + voteSec * 1000).toISOString() : null,
      shopIds: [...shopIds],
      votes: [],
      orders: [],
    };
    state.tables.unshift(row);
    state.table = row;
    notify();
    return { t: 'ack', opId: uuid(), ok: true, result: { id } };
  }
  if (name === 'table.addShop') {
    const table = state.table!;
    const sid = String(a.shopId);
    if (!table.shopIds.includes(sid)) table.shopIds.push(sid);
    table.version += 1;
    notify();
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'table.setWinner') {
    const table = state.table!;
    table.winnerShopId = a.shopId ? String(a.shopId) : null;
    table.winnerSpinId = a.spinId ? String(a.spinId) : null;
    table.version += 1;
    notify();
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'table.setPickup') {
    const table = state.table!;
    table.pickupMemberId = String(a.memberId);
    table.pickupSpinId = a.spinId ? String(a.spinId) : null;
    table.version += 1;
    notify();
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'table.setBill') {
    const table = state.table!;
    table.billTotal = a.total == null ? null : Number(a.total);
    if (a.mode === 'item' || a.mode === 'equal') table.billMode = a.mode;
    table.version += 1;
    notify();
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'order.add') {
    const table = state.table!;
    const order = {
      id: uuid(),
      tableId: table.id,
      memberId: me.id,
      text: String(a.text || '').slice(0, 120),
      price: a.price == null ? null : Number(a.price),
      version: 1,
    };
    table.orders.push(order);
    table.version += 1;
    notify();
    return { t: 'ack', opId: uuid(), ok: true, result: order };
  }
  if (name === 'order.update') {
    const table = state.table!;
    const o = table.orders.find((x) => x.id === a.id);
    if (o) {
      if (a.text != null) o.text = String(a.text).slice(0, 120);
      if ('price' in a) o.price = a.price == null ? null : Number(a.price);
      o.version += 1;
      table.version += 1;
      notify();
    }
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'order.remove') {
    const table = state.table!;
    table.orders = table.orders.filter((x) => x.id !== a.id);
    table.version += 1;
    notify();
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'shop.upsert') {
    const id = a.id ? String(a.id) : uuid();
    let shop = state.shops.find((s) => s.id === id);
    if (!shop) {
      shop = {
        id,
        name: String(a.name || ''),
        phone: a.phone ? String(a.phone) : null,
        type: (a.type as Shop['type']) || '',
        mapsUrl: a.mapsUrl ? String(a.mapsUrl) : null,
        createdBy: me.id,
        version: 1,
        menu: [],
        stats: { times: 0, lastDate: null },
      };
      state.shops.push(shop);
    } else {
      shop.name = String(a.name || shop.name);
      shop.phone = a.phone ? String(a.phone) : null;
      shop.type = (a.type as Shop['type']) ?? shop.type;
      shop.mapsUrl = a.mapsUrl ? String(a.mapsUrl) : shop.mapsUrl;
      shop.version += 1;
    }
    notify();
    return { t: 'ack', opId: uuid(), ok: true, result: { id } };
  }
  if (name === 'shop.setMenu') {
    const shop = state.shops.find((s) => s.id === a.shopId);
    if (shop) {
      const items = (a.items as { name: string; price: number | null }[]) || [];
      shop.menu = items.map((it, i) => ({
        id: uuid(),
        shopId: shop.id,
        name: it.name,
        price: it.price,
        sort: i,
      }));
      shop.version += 1;
      notify();
    }
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'wheel.create') {
    const w: Wheel = {
      id: uuid(),
      title: String(a.title || 'Vòng mới'),
      kind: 'free',
      tableId: null,
      createdBy: me.id,
      version: 1,
      items: [],
    };
    state.wheels.push(w);
    state.ui.wheelId = w.id;
    notify();
    return { t: 'ack', opId: uuid(), ok: true, result: { id: w.id } };
  }
  if (name === 'wheel.rename') {
    const w = state.wheels.find((x) => x.id === a.wheelId);
    if (w) {
      w.title = String(a.title || w.title).slice(0, 120);
      w.version += 1;
      notify();
    }
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'wheel.item.add') {
    const w = state.wheels.find((x) => x.id === a.wheelId);
    if (w && w.items.length < 30) {
      w.items.push({
        id: uuid(),
        wheelId: w.id,
        name: String(a.name || 'Ô').slice(0, 120),
        weight: Math.min(100, Math.max(1, Number(a.weight) || 10)),
        refShopId: a.refShopId ? String(a.refShopId) : null,
        refMemberId: a.refMemberId ? String(a.refMemberId) : null,
        votes: null,
        sort: w.items.length,
      });
      w.version += 1;
      notify();
    }
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'wheel.item.update') {
    const w = state.wheels.find((x) => x.items.some((i) => i.id === a.id));
    const item = w?.items.find((i) => i.id === a.id);
    if (w && item) {
      if (a.name != null) item.name = String(a.name).slice(0, 120);
      if (a.weight != null) item.weight = Math.min(100, Math.max(1, Number(a.weight)));
      w.version += 1;
      notify();
    }
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'wheel.item.remove') {
    const w = state.wheels.find((x) => x.items.some((i) => i.id === a.id));
    if (w) {
      w.items = w.items.filter((i) => i.id !== a.id);
      w.version += 1;
      notify();
    }
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'wheel.equalize') {
    const w = state.wheels.find((x) => x.id === a.wheelId);
    if (w) {
      for (const it of w.items) it.weight = 10;
      w.version += 1;
      notify();
    }
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'wheel.byVote') {
    const w = state.wheels.find((x) => x.id === a.wheelId);
    const table = state.table;
    if (w && table) {
      for (const it of w.items) {
        const votes = table.votes.filter((v) => v.shopId === it.refShopId).length;
        it.votes = votes;
        it.weight = Math.max(5, votes * 10);
      }
      w.version += 1;
      notify();
    }
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'wheel.spin') {
    const w = state.wheels.find((x) => x.id === a.wheelId);
    if (!w || w.items.length < 2) {
      return { t: 'ack', opId: uuid(), ok: false, error: 'need_items' };
    }
    const active = state.spins.find(
      (s) => s.wheelId === w.id && Date.now() < s.startedAt + s.durationMs,
    );
    if (active) {
      toast('Đang quay mà');
      return { t: 'ack', opId: uuid(), ok: false, error: 'spinning' };
    }
    const weights = w.items.map((i) => i.weight);
    const total = weights.reduce((s, x) => s + x, 0);
    let r = Math.floor(Math.random() * total);
    let idx = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]!;
      if (r < 0) {
        idx = i;
        break;
      }
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const spin: Spin = {
      id: uuid(),
      wheelId: w.id,
      byMember: me.id,
      itemsJson: JSON.stringify(w.items),
      resultIndex: idx,
      resultName: w.items[idx]!.name,
      startedAt: Date.now(),
      durationMs: reduced ? 600 : 4300,
    };
    state.spins.unshift(spin);
    notify();
    return {
      t: 'ack',
      opId: uuid(),
      ok: true,
      result: {
        spinId: spin.id,
        wheelId: w.id,
        resultIndex: idx,
        resultName: spin.resultName,
        startedAt: spin.startedAt,
        durationMs: spin.durationMs,
        items: w.items,
      },
    };
  }
  if (name === 'wheel.delete') {
    const id = String(a.id || '');
    state.wheels = state.wheels.filter((w) => w.id !== id);
    if (state.ui.wheelId === id) state.ui.wheelId = state.wheels[0]?.id || null;
    notify();
    return { t: 'ack', opId: uuid(), ok: true, result: { id } };
  }
  if (name === 'shop.delete') {
    const id = String(a.id || '');
    state.shops = state.shops.filter((s) => s.id !== id);
    notify();
    return { t: 'ack', opId: uuid(), ok: true, result: { id } };
  }
  if (name === 'chat.send') {
    const scope = String(a.scope || '');
    const msg: ChatMsg = {
      id: uuid(),
      scope,
      memberId: me.id,
      body: String(a.body || '').slice(0, 500),
      createdAt: new Date().toISOString(),
      deletedAt: null,
      deletedBy: null,
    };
    applyChatMsg(scope, msg);
    return { t: 'ack', opId: uuid(), ok: true, result: { id: msg.id } };
  }
  if (name === 'chat.delete') {
    const id = String(a.id || '');
    for (const scope of Object.keys(state.chatByScope)) {
      const list = state.chatByScope[scope] || [];
      const hit = list.find((m) => m.id === id);
      if (hit) {
        hit.deletedAt = new Date().toISOString();
        hit.deletedBy = me.id;
        hit.body = '';
        notify();
        break;
      }
    }
    return { t: 'ack', opId: uuid(), ok: true, result: { id } };
  }
  if (name === 'member.updateProfile') {
    Object.assign(me, {
      displayName: a.displayName != null ? String(a.displayName) : me.displayName,
      avatarId: a.avatarId !== undefined ? (a.avatarId as string | null) : me.avatarId,
      bankBin: a.bankBin != null ? String(a.bankBin) : me.bankBin,
      bankAccount: a.bankAccount != null ? String(a.bankAccount) : me.bankAccount,
      bankNameDisplay: a.bankNameDisplay != null ? String(a.bankNameDisplay) : me.bankNameDisplay,
    });
    const i = state.members.findIndex((m) => m.id === me.id);
    if (i >= 0) state.members[i] = { ...me };
    notify();
    return { t: 'ack', opId: uuid(), ok: true };
  }
  if (name === 'member.changePin') {
    return { t: 'ack', opId: uuid(), ok: true };
  }
  return { t: 'ack', opId: uuid(), ok: true };
}
