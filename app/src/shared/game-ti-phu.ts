/** Cờ tỉ phú văn phòng rút gọn — không nhà/KS; 2–6 người; theme VP. */

export type TiPhuTileKind = 'go' | 'prop' | 'tax' | 'chance' | 'jail' | 'park';

export type TiPhuTile = {
  id: number;
  name: string;
  kind: TiPhuTileKind;
  price?: number;
  rent?: number;
  tax?: number;
};

/** 16 ô — tên văn phòng, không copy trademark. */
export const TI_PHU_BOARD: TiPhuTile[] = [
  { id: 0, name: 'Lễ tân', kind: 'go' },
  { id: 1, name: 'Bàn góc cửa sổ', kind: 'prop', price: 60, rent: 10 },
  { id: 2, name: 'Phạt photo', kind: 'tax', tax: 50 },
  { id: 3, name: 'Phòng họp nhỏ', kind: 'prop', price: 80, rent: 15 },
  { id: 4, name: 'Phiếu nội bộ', kind: 'chance' },
  { id: 5, name: 'Tủ hồ sơ', kind: 'prop', price: 100, rent: 20 },
  { id: 6, name: 'Chờ IT', kind: 'jail' },
  { id: 7, name: 'Ban công hút thuốc', kind: 'prop', price: 120, rent: 25 },
  { id: 8, name: 'Bãi xe', kind: 'park' },
  { id: 9, name: 'Bếp trà đá', kind: 'prop', price: 140, rent: 30 },
  { id: 10, name: 'Đi muộn', kind: 'tax', tax: 80 },
  { id: 11, name: 'Phòng IT', kind: 'prop', price: 160, rent: 35 },
  { id: 12, name: 'Phiếu nội bộ', kind: 'chance' },
  { id: 13, name: 'Phòng GĐ', kind: 'prop', price: 200, rent: 50 },
  { id: 14, name: 'Kho văn phòng phẩm', kind: 'prop', price: 180, rent: 40 },
  { id: 15, name: 'Sảnh kính', kind: 'prop', price: 220, rent: 55 },
];

export const TI_PHU_GO_SALARY = 200;
export const TI_PHU_START_CASH = 1500;

const CHANCE_DELTA = [50, -30, 100, -50, 20, -80];

export type TiPhuState = {
  playerIds: string[];
  positions: Record<string, number>;
  cash: Record<string, number>;
  owned: Record<string, string>; // tileId -> memberId
  bankrupt: string[];
  turnId: string | null;
  dice: [number, number] | null;
  rolled: boolean;
  pendingBuy: number | null; // tile id awaiting buy/skip
  winnerId: string | null;
  chanceIndex: number;
  log: string[];
};

export function emptyTiPhu(playerIds: string[]): TiPhuState {
  const positions: Record<string, number> = {};
  const cash: Record<string, number> = {};
  for (const id of playerIds) {
    positions[id] = 0;
    cash[id] = TI_PHU_START_CASH;
  }
  return {
    playerIds: [...playerIds],
    positions,
    cash,
    owned: {},
    bankrupt: [],
    turnId: playerIds[0] ?? null,
    dice: null,
    rolled: false,
    pendingBuy: null,
    winnerId: null,
    chanceIndex: 0,
    log: [],
  };
}

function alive(state: TiPhuState): string[] {
  return state.playerIds.filter((id) => !state.bankrupt.includes(id));
}

function nextAlive(state: TiPhuState, fromId: string): string | null {
  const ids = alive(state);
  if (ids.length <= 1) return ids[0] ?? null;
  const i = ids.indexOf(fromId);
  if (i < 0) return ids[0]!;
  return ids[(i + 1) % ids.length]!;
}

function checkWinner(state: TiPhuState): void {
  const left = alive(state);
  if (left.length === 1) {
    state.winnerId = left[0]!;
    state.turnId = null;
  }
}

function bankruptPlayer(state: TiPhuState, memberId: string): void {
  if (state.bankrupt.includes(memberId)) return;
  state.bankrupt = [...state.bankrupt, memberId];
  state.cash[memberId] = 0;
  const nextOwned: Record<string, string> = {};
  for (const [tid, oid] of Object.entries(state.owned)) {
    if (oid !== memberId) nextOwned[tid] = oid;
  }
  state.owned = nextOwned;
  state.pendingBuy = null;
  checkWinner(state);
}

function pay(state: TiPhuState, from: string, amount: number, to: string | null): boolean {
  if ((state.cash[from] || 0) >= amount) {
    state.cash[from] = (state.cash[from] || 0) - amount;
    if (to) state.cash[to] = (state.cash[to] || 0) + amount;
    return true;
  }
  // không đủ → phá sản; chủ nợ nhận hết tiền còn
  const left = state.cash[from] || 0;
  state.cash[from] = 0;
  if (to) state.cash[to] = (state.cash[to] || 0) + left;
  bankruptPlayer(state, from);
  return false;
}

function land(state: TiPhuState, memberId: string): void {
  const pos = state.positions[memberId]!;
  const tile = TI_PHU_BOARD[pos]!;
  if (tile.kind === 'prop') {
    const owner = state.owned[String(tile.id)];
    if (!owner) {
      state.pendingBuy = tile.id;
      return;
    }
    if (owner !== memberId && !state.bankrupt.includes(owner)) {
      pay(state, memberId, tile.rent || 0, owner);
      state.log = [...state.log, `thuê ${tile.name}`].slice(-8);
    }
    return;
  }
  if (tile.kind === 'tax') {
    pay(state, memberId, tile.tax || 0, null);
    state.log = [...state.log, `thuế ${tile.name}`].slice(-8);
    return;
  }
  if (tile.kind === 'chance') {
    const delta = CHANCE_DELTA[state.chanceIndex % CHANCE_DELTA.length]!;
    state.chanceIndex += 1;
    if (delta >= 0) state.cash[memberId] = (state.cash[memberId] || 0) + delta;
    else pay(state, memberId, -delta, null);
    state.log = [...state.log, `phiếu ${delta > 0 ? '+' : ''}${delta}`].slice(-8);
  }
}

export type TiPhuAction =
  | { action: 'roll'; dice?: [number, number] }
  | { action: 'buy' }
  | { action: 'skip' };

export type TiPhuMoveResult =
  | { ok: true; state: TiPhuState; ended: boolean }
  | { ok: false; error: 'illegal_move' | 'not_your_turn' | 'ended' | 'need_roll' };

function endTurn(state: TiPhuState, memberId: string): void {
  state.rolled = false;
  state.dice = null;
  state.pendingBuy = null;
  if (!state.winnerId) {
    state.turnId = nextAlive(state, memberId);
  }
}

export function applyTiPhuMove(
  state: TiPhuState,
  memberId: string,
  action: TiPhuAction,
): TiPhuMoveResult {
  if (state.winnerId) return { ok: false, error: 'ended' };
  if (state.turnId !== memberId) return { ok: false, error: 'not_your_turn' };
  if (state.bankrupt.includes(memberId)) return { ok: false, error: 'illegal_move' };

  const next: TiPhuState = {
    ...state,
    positions: { ...state.positions },
    cash: { ...state.cash },
    owned: { ...state.owned },
    bankrupt: [...state.bankrupt],
    log: [...state.log],
    dice: state.dice ? ([...state.dice] as [number, number]) : null,
  };

  if (action.action === 'roll') {
    if (next.rolled || next.pendingBuy != null) return { ok: false, error: 'illegal_move' };
    const d0 = action.dice?.[0] ?? 0;
    const d1 = action.dice?.[1] ?? 0;
    if (d0 < 1 || d0 > 6 || d1 < 1 || d1 > 6) return { ok: false, error: 'illegal_move' };
    const steps = d0 + d1;
    next.dice = [d0, d1];
    next.rolled = true;
    const from = next.positions[memberId] || 0;
    const to = (from + steps) % TI_PHU_BOARD.length;
    if (to < from || from + steps >= TI_PHU_BOARD.length) {
      next.cash[memberId] = (next.cash[memberId] || 0) + TI_PHU_GO_SALARY;
    }
    next.positions[memberId] = to;
    land(next, memberId);
    if (next.winnerId) {
      return { ok: true, state: next, ended: true };
    }
    if (next.pendingBuy == null) {
      endTurn(next, memberId);
    }
    return { ok: true, state: next, ended: !!next.winnerId };
  }

  if (action.action === 'buy') {
    if (next.pendingBuy == null) return { ok: false, error: 'illegal_move' };
    const tile = TI_PHU_BOARD[next.pendingBuy]!;
    if (tile.kind !== 'prop' || tile.price == null) return { ok: false, error: 'illegal_move' };
    if ((next.cash[memberId] || 0) < tile.price) return { ok: false, error: 'illegal_move' };
    next.cash[memberId] = (next.cash[memberId] || 0) - tile.price;
    next.owned[String(tile.id)] = memberId;
    next.log = [...next.log, `mua ${tile.name}`].slice(-8);
    endTurn(next, memberId);
    return { ok: true, state: next, ended: false };
  }

  if (action.action === 'skip') {
    if (next.pendingBuy == null) return { ok: false, error: 'illegal_move' };
    endTurn(next, memberId);
    return { ok: true, state: next, ended: false };
  }

  return { ok: false, error: 'illegal_move' };
}
