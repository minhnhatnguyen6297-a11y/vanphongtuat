/** Caro 15×15 — thắng 5 liền. Pure helpers; server authoritative. */

export const CARO_SIZE = 15;
export const CARO_WIN = 5;

export type CaroState = {
  cells: (string | null)[];
  turnId: string | null;
  winnerId: string | null;
  playerIds: string[];
};

export function emptyCaro(playerIds: string[]): CaroState {
  return {
    cells: Array.from({ length: CARO_SIZE * CARO_SIZE }, () => null),
    turnId: playerIds[0] ?? null,
    winnerId: null,
    playerIds: [...playerIds],
  };
}

export function idx(row: number, col: number): number {
  return row * CARO_SIZE + col;
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < CARO_SIZE && col >= 0 && col < CARO_SIZE;
}

function countDir(
  cells: (string | null)[],
  row: number,
  col: number,
  dr: number,
  dc: number,
  who: string,
): number {
  let n = 0;
  let r = row + dr;
  let c = col + dc;
  while (inBounds(r, c) && cells[idx(r, c)] === who) {
    n++;
    r += dr;
    c += dc;
  }
  return n;
}

export function checkWin(cells: (string | null)[], row: number, col: number, who: string): boolean {
  const dirs: Array<[number, number]> = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (const [dr, dc] of dirs) {
    const total = 1 + countDir(cells, row, col, dr, dc, who) + countDir(cells, row, col, -dr, -dc, who);
    if (total >= CARO_WIN) return true;
  }
  return false;
}

export type CaroMoveResult =
  | { ok: true; state: CaroState; ended: boolean }
  | { ok: false; error: 'illegal_move' | 'not_your_turn' | 'ended' };

export function applyCaroMove(
  state: CaroState,
  memberId: string,
  row: number,
  col: number,
): CaroMoveResult {
  if (state.winnerId) return { ok: false, error: 'ended' };
  if (state.turnId !== memberId) return { ok: false, error: 'not_your_turn' };
  if (!inBounds(row, col)) return { ok: false, error: 'illegal_move' };
  const i = idx(row, col);
  if (state.cells[i] != null) return { ok: false, error: 'illegal_move' };

  const cells = state.cells.slice();
  cells[i] = memberId;
  const won = checkWin(cells, row, col, memberId);
  const next = state.playerIds.find((p) => p !== memberId) ?? null;
  const nextState: CaroState = {
    cells,
    turnId: won ? null : next,
    winnerId: won ? memberId : null,
    playerIds: state.playerIds,
  };
  if (!won && cells.every((c) => c != null)) {
    nextState.turnId = null;
    // draw — no winner
  }
  return { ok: true, state: nextState, ended: !!nextState.winnerId || nextState.turnId == null };
}
