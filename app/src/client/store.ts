import type { ChatMsg, GameRoom, Member, Shop, Spin, TableRow, Wheel } from '../shared/types.js';
import type { PermKey, Tier } from '../shared/perms-catalog.js';

export type RouteId = 'home' | 'ban' | 'quay' | 'tien' | 'so' | 'kho' | 'quyen' | 'sanh';

export type PermsState = {
  matrix: Record<Tier, PermKey[]>;
  grants: Array<{
    id: string;
    memberId: string;
    permKey: string;
    grantedBy: string;
    expiresAt: string;
    createdAt: string;
  }>;
  requests: Array<{
    id: string;
    memberId: string;
    permKey: string;
    status: string;
    decidedBy: string | null;
    createdAt: string;
    decidedAt: string | null;
  }>;
};

export type AppState = {
  me: Member | null;
  members: Member[];
  shops: Shop[];
  table: TableRow | null;
  tables: TableRow[];
  wheels: Wheel[];
  spins: Spin[];
  games: GameRoom[];
  chatByScope: Record<string, ChatMsg[]>;
  chatSubs: string[];
  perms: PermsState;
  versions: Record<string, number>;
  route: RouteId;
  connected: boolean;
  mock: boolean;
  /** UI drafts */
  ui: {
    selectedPersonId: string | null;
    expandedLedgerId: number | null;
    wheelId: string | null;
    gameRoomId: string | null;
    soundOn: boolean;
    billPreviewUrl: string | null;
    aiBillTotal: number | null;
    khoFilter: 'all' | 'no' | 'vat' | 'uong' | '';
    khoEditId: string | null;
    menuDraftIds: string[];
    noteDraft: string;
    khoForm: {
      name: string;
      phone: string;
      type: '' | 'no' | 'vat' | 'uong';
      mapsUrl: string;
      menu: { name: string; price: number | null }[];
      paste: string;
    };
  };
};

type Listener = () => void;

const listeners = new Set<Listener>();

function loadSound(): boolean {
  try {
    return localStorage.getItem('hng_sound') !== '0';
  } catch {
    return true;
  }
}

export const state: AppState = {
  me: null,
  members: [],
  shops: [],
  table: null,
  tables: [],
  wheels: [],
  spins: [],
  games: [],
  chatByScope: {},
  chatSubs: [],
  perms: { matrix: { chu_xi: [], pho_xi: [], dan_den: [], no_le: [] }, grants: [], requests: [] },
  versions: {},
  route: 'home',
  connected: false,
  mock: false,
  ui: {
    selectedPersonId: null,
    expandedLedgerId: null,
    wheelId: null,
    gameRoomId: null,
    soundOn: loadSound(),
    billPreviewUrl: null,
    aiBillTotal: null,
    khoFilter: 'all',
    khoEditId: null,
    menuDraftIds: [],
    noteDraft: '',
    khoForm: { name: '', phone: '', type: '', mapsUrl: '', menu: [], paste: '' },
  },
};

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(): void {
  for (const fn of listeners) fn();
}

export function patch(mutator: (s: AppState) => void): void {
  mutator(state);
  notify();
}

export function setSound(on: boolean): void {
  state.ui.soundOn = on;
  try {
    localStorage.setItem('hng_sound', on ? '1' : '0');
  } catch {
    /* ignore */
  }
  notify();
}

export function memberById(id: string | null | undefined): Member | undefined {
  if (!id) return undefined;
  return state.members.find((m) => m.id === id);
}

export function shopById(id: string | null | undefined): Shop | undefined {
  if (!id) return undefined;
  return state.shops.find((s) => s.id === id);
}

/** host_id = người gánh lẻ / nhãn bàn — không authorize. */
export function isHost(): boolean {
  return !!(state.me && state.table && state.me.id === state.table.hostId);
}

export function canPerm(key: PermKey): boolean {
  const me = state.me;
  if (!me || me.disabled) return false;
  const tier = me.tier || (me.isOperator ? 'chu_xi' : 'dan_den');
  const list = state.perms.matrix[tier] || [];
  if (list.includes(key)) return true;
  if (key === 'perm.manage' || key === 'perm.approve' || key === 'member.admin') return false;
  const now = Date.now();
  return state.perms.grants.some(
    (g) => g.memberId === me.id && g.permKey === key && new Date(g.expiresAt).getTime() > now,
  );
}

/** Mọi member mở được màn Quyền (tab Xin phép); matrix/approve vẫn theo perm. */
export function canOpenQuyen(): boolean {
  return !!(state.me && !state.me.disabled);
}

export function applyChatMsg(scope: string, msg: ChatMsg): void {
  const list = [...(state.chatByScope[scope] || [])];
  const i = list.findIndex((m) => m.id === msg.id);
  if (i >= 0) list[i] = msg;
  else list.push(msg);
  if (list.length > 100) list.splice(0, list.length - 100);
  state.chatByScope[scope] = list;
  notify();
}

export function replaceChatSnap(scope: string, messages: ChatMsg[]): void {
  state.chatByScope[scope] = messages.slice(-100);
  notify();
}

export function formatDateChip(iso: string): string {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shortShopName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name.toUpperCase();
  return parts.slice(-2).join(' ').toUpperCase();
}

export function effectiveShopId(table: TableRow | null): string | null {
  if (!table) return null;
  if (table.winnerShopId) return table.winnerShopId;
  if (!table.shopIds.length) return null;
  const counts = new Map<string, number>();
  for (const id of table.shopIds) counts.set(id, 0);
  for (const v of table.votes) counts.set(v.shopId, (counts.get(v.shopId) || 0) + 1);
  let best = table.shopIds[0]!;
  let bestN = -1;
  for (const id of table.shopIds) {
    const n = counts.get(id) || 0;
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}
