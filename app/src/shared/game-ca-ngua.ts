/** Cá ngựa / Ludo rút gọn — 2–4 người, 4 quân; ra chuồng cần 6; đá về; về đích exact. */

export const CA_NGUA_PIECES = 4;
export const CA_NGUA_TRACK = 52;
export const CA_NGUA_HOME_LEN = 5;
/** relative: -1 chuồng; 0..50 vòng ngoài; 51..55 đường về; 56 đích */
export const CA_NGUA_FINISH = 56;
export const CA_NGUA_ENTRY = 51; // first home-stretch cell

export type CaNguaState = {
  playerIds: string[];
  pieces: Record<string, number[]>;
  finishedCount: Record<string, number>;
  turnId: string | null;
  dice: number | null;
  rolled: boolean;
  winnerId: string | null;
  extraTurn: boolean;
};

export function emptyCaNgua(playerIds: string[]): CaNguaState {
  const pieces: Record<string, number[]> = {};
  const finishedCount: Record<string, number> = {};
  for (const id of playerIds) {
    pieces[id] = Array.from({ length: CA_NGUA_PIECES }, () => -1);
    finishedCount[id] = 0;
  }
  return {
    playerIds: [...playerIds],
    pieces,
    finishedCount,
    turnId: playerIds[0] ?? null,
    dice: null,
    rolled: false,
    winnerId: null,
    extraTurn: false,
  };
}

/** Absolute cell on shared ring for capture (null if barn/home/finish). */
export function absoluteCell(playerIds: string[], memberId: string, rel: number): number | null {
  if (rel < 0 || rel >= CA_NGUA_ENTRY) return null;
  const pi = playerIds.indexOf(memberId);
  if (pi < 0) return null;
  const start = (pi * 13) % CA_NGUA_TRACK;
  return (start + rel) % CA_NGUA_TRACK;
}

function nextPlayer(state: CaNguaState, fromId: string): string | null {
  const ids = state.playerIds;
  const i = ids.indexOf(fromId);
  if (i < 0 || !ids.length) return null;
  return ids[(i + 1) % ids.length]!;
}

export function legalPieceIndexes(state: CaNguaState, memberId: string): number[] {
  if (state.winnerId || !state.rolled || state.dice == null || state.turnId !== memberId) {
    return [];
  }
  const dice = state.dice;
  const mine = state.pieces[memberId] || [];
  const out: number[] = [];
  for (let i = 0; i < mine.length; i++) {
    const pos = mine[i]!;
    if (pos === CA_NGUA_FINISH) continue;
    if (pos === -1) {
      if (dice === 6) out.push(i);
      continue;
    }
    const dest = pos + dice;
    if (dest > CA_NGUA_FINISH) continue; // cần exact
    // block: own piece on dest (except finish)
    if (dest < CA_NGUA_FINISH && mine.includes(dest)) continue;
    out.push(i);
  }
  return out;
}

function captureAt(state: CaNguaState, moverId: string, abs: number): void {
  for (const pid of state.playerIds) {
    if (pid === moverId) continue;
    const arr = state.pieces[pid]!;
    for (let i = 0; i < arr.length; i++) {
      const rel = arr[i]!;
      const cell = absoluteCell(state.playerIds, pid, rel);
      if (cell === abs) {
        arr[i] = -1;
      }
    }
  }
}

export type CaNguaAction =
  | { action: 'roll'; dice?: number }
  | { action: 'move'; pieceId: number };

export type CaNguaMoveResult =
  | { ok: true; state: CaNguaState; ended: boolean }
  | { ok: false; error: 'illegal_move' | 'not_your_turn' | 'ended' | 'need_roll' };

export function applyCaNguaMove(
  state: CaNguaState,
  memberId: string,
  action: CaNguaAction,
): CaNguaMoveResult {
  if (state.winnerId) return { ok: false, error: 'ended' };
  if (state.turnId !== memberId) return { ok: false, error: 'not_your_turn' };

  if (action.action === 'roll') {
    if (state.rolled) return { ok: false, error: 'illegal_move' };
    const dice = action.dice ?? 0;
    if (dice < 1 || dice > 6) return { ok: false, error: 'illegal_move' };
    const next: CaNguaState = {
      ...state,
      pieces: Object.fromEntries(
        Object.entries(state.pieces).map(([k, v]) => [k, v.slice()]),
      ),
      finishedCount: { ...state.finishedCount },
      dice,
      rolled: true,
      extraTurn: dice === 6,
    };
    // nếu không có nước hợp lệ → hết lượt (trừ khi 6 thì vẫn hết vì không đi được)
    if (legalPieceIndexes(next, memberId).length === 0) {
      next.rolled = false;
      next.dice = null;
      next.extraTurn = false;
      next.turnId = nextPlayer(next, memberId);
    }
    return { ok: true, state: next, ended: false };
  }

  // move
  if (!state.rolled || state.dice == null) return { ok: false, error: 'need_roll' };
  const pieceId = action.pieceId;
  const legal = legalPieceIndexes(state, memberId);
  if (!legal.includes(pieceId)) return { ok: false, error: 'illegal_move' };

  const next: CaNguaState = {
    ...state,
    pieces: Object.fromEntries(
      Object.entries(state.pieces).map(([k, v]) => [k, v.slice()]),
    ),
    finishedCount: { ...state.finishedCount },
  };
  const mine = next.pieces[memberId]!;
  const from = mine[pieceId]!;
  const dice = state.dice;

  let dest: number;
  if (from === -1) {
    dest = 0;
  } else {
    dest = from + dice;
  }
  mine[pieceId] = dest;

  if (dest === CA_NGUA_FINISH) {
    next.finishedCount[memberId] = (next.finishedCount[memberId] || 0) + 1;
  } else if (dest < CA_NGUA_ENTRY) {
    const abs = absoluteCell(next.playerIds, memberId, dest);
    if (abs != null) captureAt(next, memberId, abs);
  }

  if ((next.finishedCount[memberId] || 0) >= CA_NGUA_PIECES) {
    next.winnerId = memberId;
    next.turnId = null;
    next.dice = null;
    next.rolled = false;
    return { ok: true, state: next, ended: true };
  }

  if (next.extraTurn) {
    next.rolled = false;
    next.dice = null;
    next.extraTurn = false;
    // keep turnId
  } else {
    next.rolled = false;
    next.dice = null;
    next.turnId = nextPlayer(next, memberId);
  }
  return { ok: true, state: next, ended: false };
}
