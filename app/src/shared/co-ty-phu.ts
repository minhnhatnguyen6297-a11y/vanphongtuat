/**
 * Cờ tỷ phú — luật bàn 32 ô (cùng cấu trúc ván ZingPlay), tên ô và hình là bản gốc.
 * Thuần hàm: UI và (sau này) phòng online chỉ việc gọi applyCtp.
 */

export const BOARD_LEN = 32;
export const START_CASH = 2000;
export const GO_SALARY = 300;
export const JAIL_FINE = 100;
export const BUS_FEE = 40;
export const FEST_FEE = 40;
export const GAME_MIN = 100;
export const ROUND_LIMIT = 30;
export const JAIL_INDEX = 8;

export type Group = 'sky' | 'sea' | 'lime' | 'forest' | 'orange' | 'red' | 'pink' | 'violet';

export type TileKind =
  | 'start'
  | 'city'
  | 'resort'
  | 'chance'
  | 'jail'
  | 'festival'
  | 'bus'
  | 'tax'
  | 'game';

export type Tile = {
  id: number;
  name: string;
  kind: TileKind;
  side: 0 | 1 | 2 | 3;
  group?: Group;
  price: number;
  rent: [number, number, number, number, number];
  build: [number, number, number, number];
};

const ZERO_RENT: Tile['rent'] = [0, 0, 0, 0, 0];
const ZERO_BUILD: Tile['build'] = [0, 0, 0, 0];

function prop(
  id: number,
  name: string,
  kind: 'city' | 'resort',
  side: 0 | 1 | 2 | 3,
  price: number,
  rent: Tile['rent'],
  build: Tile['build'],
  group?: Group,
): Tile {
  return { id, name, kind, side, group, price, rent, build };
}

function spec(id: number, name: string, kind: TileKind, side: 0 | 1 | 2 | 3): Tile {
  return { id, name, kind, side, price: 0, rent: ZERO_RENT, build: ZERO_BUILD };
}

/** Chiều kim đồng hồ từ góc Bắt đầu (dưới-trái). 9 ô mỗi cạnh, góc dùng chung. */
export const BOARD: Tile[] = [
  spec(0, 'Bắt đầu', 'start', 0),
  prop(1, 'Cù Lao', 'city', 0, 70, [6, 20, 50, 140, 280], [30, 30, 50, 80], 'sky'),
  prop(2, 'Đồi Thông', 'city', 0, 70, [6, 20, 50, 140, 280], [30, 30, 50, 80], 'sky'),
  spec(3, 'Cơ hội', 'chance', 0),
  prop(4, 'Bãi Neo', 'resort', 0, 100, [10, 30, 80, 180, 320], [40, 40, 60, 90]),
  prop(5, 'Ải Bắc', 'city', 0, 110, [8, 28, 80, 200, 400], [40, 40, 70, 100], 'sea'),
  prop(6, 'Phố Đò', 'city', 0, 110, [8, 28, 80, 200, 400], [40, 40, 70, 100], 'sea'),
  prop(7, 'Ruộng Muối', 'city', 0, 120, [10, 32, 90, 220, 440], [40, 40, 70, 100], 'sea'),
  spec(8, 'Côn Đảo', 'jail', 1),
  prop(9, 'Cao Nguyên', 'city', 1, 150, [12, 40, 110, 280, 520], [50, 50, 90, 130], 'lime'),
  prop(10, 'Suối Vàng', 'city', 1, 150, [12, 40, 110, 280, 520], [50, 50, 90, 130], 'lime'),
  spec(11, 'Đỏ Đen', 'game', 1),
  prop(12, 'Rừng Tràm', 'city', 1, 190, [16, 50, 150, 360, 640], [60, 60, 110, 160], 'forest'),
  prop(13, 'Cảng Khuya', 'city', 1, 190, [16, 50, 150, 360, 640], [60, 60, 110, 160], 'forest'),
  prop(14, 'Vịnh Biếc', 'resort', 1, 180, [16, 50, 140, 320, 560], [60, 60, 100, 140]),
  spec(15, 'Cơ hội', 'chance', 1),
  spec(16, 'Lễ hội', 'festival', 2),
  prop(17, 'Phố Lồng', 'city', 2, 280, [26, 90, 240, 560, 950], [90, 90, 160, 220], 'red'),
  prop(18, 'Phố Cổ', 'city', 2, 280, [26, 90, 240, 560, 950], [90, 90, 160, 220], 'red'),
  prop(19, 'Cầu Sông', 'city', 2, 300, [28, 100, 260, 600, 1000], [90, 90, 160, 220], 'red'),
  prop(20, 'Đảo Ngọc', 'resort', 2, 260, [24, 70, 200, 460, 800], [80, 80, 140, 200]),
  prop(21, 'Đồng Bằng', 'city', 2, 340, [34, 110, 300, 700, 1200], [110, 110, 180, 260], 'pink'),
  prop(22, 'Vườn Sông', 'city', 2, 340, [34, 110, 300, 700, 1200], [110, 110, 180, 260], 'pink'),
  spec(23, 'Thuế', 'tax', 2),
  spec(24, 'Bến xe', 'bus', 3),
  prop(25, 'Núi Đá', 'city', 3, 240, [20, 70, 190, 450, 800], [80, 80, 140, 200], 'orange'),
  prop(26, 'Bản Mây', 'city', 3, 240, [20, 70, 190, 450, 800], [80, 80, 140, 200], 'orange'),
  prop(27, 'Biển Sớm', 'resort', 3, 320, [30, 90, 250, 560, 980], [100, 100, 160, 240]),
  prop(28, 'Phố Lớn', 'city', 3, 400, [44, 140, 380, 900, 1500], [130, 130, 220, 300], 'violet'),
  prop(29, 'Bến Thượng', 'city', 3, 400, [44, 140, 380, 900, 1500], [130, 130, 220, 300], 'violet'),
  spec(30, 'Cơ hội', 'chance', 3),
  prop(31, 'Ghềnh Vàng', 'resort', 3, 400, [40, 120, 320, 720, 1200], [120, 120, 200, 280]),
];

export const GROUP_COLOR: Record<Group, string> = {
  sky: '#2bb8d6',
  sea: '#1a66d6',
  lime: '#7dbe3a',
  forest: '#1c8a48',
  orange: '#ef8d12',
  red: '#e23a32',
  pink: '#e45b9a',
  violet: '#7a3ff2',
};

export const GROUP_LABEL: Record<Group, string> = {
  sky: 'Xanh da trời',
  sea: 'Xanh nước biển',
  lime: 'Xanh lá nhạt',
  forest: 'Xanh lá đậm',
  orange: 'Cam',
  red: 'Đỏ',
  pink: 'Hồng',
  violet: 'Tím',
};

export const SEAT_COLOR = ['#d92b2b', '#1c6fe6', '#128a45', '#e09400'] as const;

/** Thành phố trên từng cạnh — không tính góc, điểm nghỉ, ô đặc biệt. */
export const ROWS: number[][] = [
  [1, 2, 5, 6, 7],
  [9, 10, 12, 13],
  [17, 18, 19, 21, 22],
  [25, 26, 28, 29],
];

export const GROUPS: Group[] = ['sky', 'sea', 'lime', 'forest', 'orange', 'red', 'pink', 'violet'];

export const RESORT_IDS = BOARD.filter((t) => t.kind === 'resort').map((t) => t.id);

const LEVEL_NAME = ['đất', 'nhà', 'chung cư', 'khách sạn', 'khu nghỉ'];

export type CardId =
  | 'cash100'
  | 'cash150'
  | 'lose80'
  | 'lose120'
  | 'jailcard'
  | 'freeRent'
  | 'halfRent'
  | 'demolish'
  | 'blackout'
  | 'plague'
  | 'forceSell'
  | 'goTax'
  | 'goFestival'
  | 'goBus'
  | 'goJail'
  | 'goStart'
  | 'freeFest'
  | 'world'
  | 'swap';

const CARD_LABEL: Record<CardId, string> = {
  cash100: 'Nhận 100',
  cash150: 'Nhận 150',
  lose80: 'Mất 80',
  lose120: 'Mất 120',
  jailcard: 'Thẻ ra đảo',
  freeRent: 'Miễn một lần thuê',
  halfRent: 'Lần thuê sau giảm một nửa',
  demolish: 'Phá một cấp nhà đối thủ',
  blackout: 'Mất điện: phí tham quan ÷2',
  plague: 'Dịch: miễn phí tham quan 5 lượt ghé',
  forceSell: 'Buộc bán một cấp',
  goTax: 'Đến ô Thuế',
  goFestival: 'Đến ô Lễ hội',
  goBus: 'Đến Bến xe',
  goJail: 'Vào Côn Đảo',
  goStart: 'Về Bắt đầu',
  freeFest: 'Mở lễ hội miễn phí',
  world: 'Du lịch thế giới',
  swap: 'Đổi thành phố',
};

const DECK_SRC: CardId[] = [
  'cash100',
  'cash100',
  'cash150',
  'lose80',
  'lose80',
  'lose120',
  'jailcard',
  'jailcard',
  'freeRent',
  'halfRent',
  'demolish',
  'blackout',
  'plague',
  'forceSell',
  'goTax',
  'goFestival',
  'goBus',
  'goJail',
  'goStart',
  'freeFest',
  'world',
  'swap',
  'cash100',
  'lose80',
];

export type Seat = { id: string; name: string; bot: boolean };

export type Ailment = { kind: 'half' | 'free'; left: number };

export type Resume = { kind: 'done' } | { kind: 'buyout'; tileId: number } | { kind: 'move'; steps: number } | { kind: 'unjail' };

export type Decision =
  | { kind: 'buy'; tileId: number }
  | { kind: 'upgrade'; tileId: number | null }
  | { kind: 'buyout'; tileId: number; price: number }
  | { kind: 'festival'; free: boolean }
  | { kind: 'bus' }
  | { kind: 'game' }
  | { kind: 'world' }
  | { kind: 'short'; due: number; to: string | null; resume: Resume };

export type LastMove = {
  from: number;
  to: number;
  path: number[];
  jailed: boolean;
  fly: boolean;
};

export type WinReason = 'bankrupt' | 'resorts' | 'sets' | 'row' | 'rounds';

export type CtpState = {
  players: Seat[];
  cash: Record<string, number>;
  pos: Record<string, number>;
  laps: Record<string, number>;
  jailed: Record<string, number>;
  jailCards: Record<string, number>;
  freeRent: Record<string, number>;
  halfRent: Record<string, number>;
  travel: Record<string, boolean>;
  owned: Record<string, string>;
  level: Record<string, number>;
  ailment: Record<string, Ailment>;
  gold: number[];
  festivalOn: number | null;
  turn: string;
  round: number;
  streak: number;
  extra: boolean;
  dice: [number, number] | null;
  decision: Decision | null;
  last: LastMove | null;
  deck: CardId[];
  deckI: number;
  bankrupt: string[];
  log: string[];
  winnerId: string | null;
  winReason: WinReason | null;
  rng: number;
};

export type CtpAction =
  | { type: 'roll'; dice?: [number, number] }
  | { type: 'buy'; level: number }
  | { type: 'skip' }
  | { type: 'upgrade'; tileId: number; toLevel: number }
  | { type: 'buyout' }
  | { type: 'festival'; tileId: number | null }
  | { type: 'bus'; take: boolean }
  | { type: 'game'; color: 'do' | 'den'; stake: number; face?: 'do' | 'den' }
  | { type: 'travel'; tileId: number }
  | { type: 'jail'; choice: 'pay' | 'card' | 'roll'; dice?: [number, number] }
  | { type: 'sell'; tileId: number }
  | { type: 'settle' }
  | { type: 'bust' };

export type CtpResult = { ok: true; state: CtpState } | { ok: false; error: 'ended' | 'illegal' };

export function isProperty(tile: Tile): boolean {
  return tile.kind === 'city' || tile.kind === 'resort';
}

export function levelName(level: number): string {
  return LEVEL_NAME[level] ?? 'đất';
}

export function buildCap(laps: number): number {
  return laps >= 1 ? 4 : 2;
}

export function buildSpent(tile: Tile, level: number): number {
  let n = 0;
  for (let i = 0; i < level; i++) n += tile.build[i] ?? 0;
  return n;
}

export function assetValue(state: CtpState, id: string): number {
  let n = 0;
  for (const tile of BOARD) {
    if (state.owned[String(tile.id)] !== id) continue;
    n += tile.price + buildSpent(tile, state.level[String(tile.id)] || 0);
  }
  return n;
}

export function netWorth(state: CtpState, id: string): number {
  if (state.bankrupt.includes(id)) return 0;
  return (state.cash[id] || 0) + assetValue(state, id);
}

export function ownsGroup(state: CtpState, id: string, group: Group): boolean {
  return BOARD.filter((t) => t.group === group).every((t) => state.owned[String(t.id)] === id);
}

export function setCount(state: CtpState, id: string): number {
  return GROUPS.filter((g) => ownsGroup(state, id, g)).length;
}

export function rentDue(state: CtpState, tileId: number, visitorId: string): number {
  const tile = BOARD[tileId];
  if (!tile || !isProperty(tile)) return 0;
  const owner = state.owned[String(tileId)];
  if (!owner || owner === visitorId) return 0;
  const level = state.level[String(tileId)] || 0;
  let n = tile.rent[level] ?? 0;
  if (tile.group && ownsGroup(state, owner, tile.group)) n *= 2;
  if (state.festivalOn === tileId) n *= 2;
  if (state.gold.includes(tileId)) n *= 2;
  const ail = state.ailment[String(tileId)];
  if (ail?.kind === 'free') n = 0;
  else if (ail?.kind === 'half') n = Math.floor(n / 2);
  if ((state.freeRent[visitorId] || 0) > 0) n = 0;
  else if ((state.halfRent[visitorId] || 0) > 0) n = Math.floor(n / 2);
  return n;
}

function consumeRentMods(state: CtpState, tileId: number, visitorId: string): void {
  const key = String(tileId);
  const ail = state.ailment[key];
  if (ail) {
    ail.left -= 1;
    if (ail.left <= 0) delete state.ailment[key];
  }
  if ((state.freeRent[visitorId] || 0) > 0) state.freeRent[visitorId] -= 1;
  else if ((state.halfRent[visitorId] || 0) > 0) state.halfRent[visitorId] -= 1;
}

export function buyoutPrice(state: CtpState, tileId: number): number | null {
  const tile = BOARD[tileId];
  if (!tile || tile.kind !== 'city') return null;
  const level = state.level[String(tileId)] || 0;
  if (level >= 4) return null;
  const owner = state.owned[String(tileId)];
  if (!owner) return null;
  return 2 * (tile.price + buildSpent(tile, level));
}

function rng(state: CtpState): number {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(state.rng ^ (state.rng >>> 15), 1 | state.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function rollDie(state: CtpState): number {
  return 1 + Math.floor(rng(state) * 6);
}

function shuffle<T>(items: T[], state: CtpState): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng(state) * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function pname(state: CtpState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? id;
}

function pushLog(state: CtpState, line: string): void {
  state.log = [...state.log, line].slice(-16);
}

export function createGame(seats: Seat[], seed = 1): CtpState {
  if (seats.length < 2 || seats.length > 4) throw new Error('need 2-4 players');
  const ids = new Set<string>();
  for (const seat of seats) {
    if (!seat.id || !seat.name.trim() || ids.has(seat.id)) throw new Error('bad seat');
    ids.add(seat.id);
  }
  const cash: CtpState['cash'] = {};
  const pos: CtpState['pos'] = {};
  const laps: CtpState['laps'] = {};
  const jailed: CtpState['jailed'] = {};
  const jailCards: CtpState['jailCards'] = {};
  const freeRent: CtpState['freeRent'] = {};
  const halfRent: CtpState['halfRent'] = {};
  const travel: CtpState['travel'] = {};
  for (const seat of seats) {
    cash[seat.id] = START_CASH;
    pos[seat.id] = 0;
    laps[seat.id] = 0;
    jailed[seat.id] = 0;
    jailCards[seat.id] = 0;
    freeRent[seat.id] = 0;
    halfRent[seat.id] = 0;
    travel[seat.id] = false;
  }
  const state: CtpState = {
    players: seats.map((s) => ({ id: s.id, name: s.name.trim(), bot: s.bot })),
    cash,
    pos,
    laps,
    jailed,
    jailCards,
    freeRent,
    halfRent,
    travel,
    owned: {},
    level: {},
    ailment: {},
    gold: [],
    festivalOn: null,
    turn: seats[0]!.id,
    round: 0,
    streak: 0,
    extra: false,
    dice: null,
    decision: null,
    last: null,
    deck: [],
    deckI: 0,
    bankrupt: [],
    log: ['Ván mới. Mỗi người 2.000.'],
    winnerId: null,
    winReason: null,
    rng: seed | 0,
  };
  const cities = BOARD.filter((t) => t.kind === 'city').map((t) => t.id);
  state.gold = shuffle(cities, state).slice(0, 3);
  state.deck = shuffle(DECK_SRC, state);
  pushLog(state, `Đất vàng: ${state.gold.map((id) => BOARD[id]!.name).join(', ')}.`);
  return state;
}

function alive(state: CtpState): Seat[] {
  return state.players.filter((p) => !state.bankrupt.includes(p.id));
}

function crown(state: CtpState, id: string, reason: WinReason): void {
  state.winnerId = id;
  state.winReason = reason;
  state.decision = null;
  state.extra = false;
  const why: Record<WinReason, string> = {
    bankrupt: 'người cuối cùng còn tiền',
    resorts: 'gom đủ 5 điểm nghỉ',
    sets: 'gom đủ 3 bộ màu',
    row: 'sở hữu trọn một cạnh',
    rounds: 'hết 30 vòng, nhiều của nhất',
  };
  pushLog(state, `${pname(state, id)} thắng — ${why[reason]}.`);
}

function checkWin(state: CtpState, focus?: string): void {
  if (state.winnerId) return;
  const left = alive(state);
  if (left.length <= 1) {
    if (left[0]) crown(state, left[0].id, 'bankrupt');
    return;
  }
  const ids = focus ? [focus] : left.map((p) => p.id);
  for (const id of ids) {
    if (!id || state.bankrupt.includes(id)) continue;
    const resorts = RESORT_IDS.filter((tid) => state.owned[String(tid)] === id).length;
    if (resorts >= 5) {
      crown(state, id, 'resorts');
      return;
    }
    if (setCount(state, id) >= 3) {
      crown(state, id, 'sets');
      return;
    }
    for (const row of ROWS) {
      if (row.every((tid) => state.owned[String(tid)] === id)) {
        crown(state, id, 'row');
        return;
      }
    }
  }
}

function awardRichest(state: CtpState): void {
  let best: string | null = null;
  let bestN = -1;
  for (const p of state.players) {
    if (state.bankrupt.includes(p.id)) continue;
    const n = netWorth(state, p.id);
    if (n > bestN) {
      bestN = n;
      best = p.id;
    }
  }
  if (best) crown(state, best, 'rounds');
}

function finishTurn(state: CtpState): void {
  if (state.winnerId) return;
  state.streak = 0;
  state.extra = false;
  state.decision = null;
  const order = state.players.map((p) => p.id);
  let i = order.indexOf(state.turn);
  if (i < 0) i = 0;
  for (let n = 0; n < order.length; n++) {
    i = (i + 1) % order.length;
    if (i === 0) state.round += 1;
    const id = order[i]!;
    if (!state.bankrupt.includes(id)) {
      state.turn = id;
      break;
    }
  }
  if (state.round >= ROUND_LIMIT) awardRichest(state);
}

function finishTile(state: CtpState): void {
  if (state.winnerId || state.decision) return;
  if (state.extra) {
    state.extra = false;
    return;
  }
  finishTurn(state);
}

function doMove(state: CtpState, id: string, steps: number): void {
  const from = state.pos[id] ?? 0;
  const path: number[] = [];
  let pos = from;
  for (let i = 0; i < steps; i++) {
    pos = (pos + 1) % BOARD_LEN;
    path.push(pos);
    if (pos === 0) {
      state.cash[id] = (state.cash[id] || 0) + GO_SALARY;
      state.laps[id] = (state.laps[id] || 0) + 1;
      pushLog(state, `${pname(state, id)} qua Bắt đầu, +${GO_SALARY}.`);
    }
  }
  state.pos[id] = pos;
  state.last = { from, to: pos, path, jailed: false, fly: false };
}

function sendJail(state: CtpState, id: string): void {
  const from = state.pos[id] ?? 0;
  state.pos[id] = JAIL_INDEX;
  state.jailed[id] = 3;
  state.extra = false;
  state.streak = 0;
  state.decision = null;
  state.last = {
    from,
    to: JAIL_INDEX,
    path: from === JAIL_INDEX ? [] : [JAIL_INDEX],
    jailed: true,
    fly: true,
  };
  pushLog(state, `${pname(state, id)} vào Côn Đảo.`);
  finishTurn(state);
}

function demand(state: CtpState, from: string, amount: number, to: string | null, resume: Resume): void {
  if (state.winnerId) return;
  if (amount <= 0) {
    continueResume(state, resume);
    return;
  }
  if ((state.cash[from] || 0) >= amount) {
    state.cash[from] = (state.cash[from] || 0) - amount;
    if (to && !state.bankrupt.includes(to)) state.cash[to] = (state.cash[to] || 0) + amount;
    continueResume(state, resume);
    return;
  }
  state.decision = { kind: 'short', due: amount, to, resume };
  pushLog(state, `${pname(state, from)} thiếu ${amount}. Bán nhà hoặc phá sản.`);
}

function continueResume(state: CtpState, resume: Resume): void {
  if (state.winnerId) return;
  if (resume.kind === 'done') {
    finishTile(state);
    return;
  }
  if (resume.kind === 'unjail') {
    state.jailed[state.turn] = 0;
    pushLog(state, `${pname(state, state.turn)} ra đảo, đổ tiếp.`);
    return;
  }
  if (resume.kind === 'buyout') {
    offerBuyout(state, resume.tileId);
    return;
  }
  doMove(state, state.turn, resume.steps);
  resolveLand(state, state.turn);
}

function offerBuyout(state: CtpState, tileId: number): void {
  const price = buyoutPrice(state, tileId);
  const me = state.turn;
  if (price == null || (state.cash[me] || 0) < price) {
    finishTile(state);
    return;
  }
  state.decision = { kind: 'buyout', tileId, price };
}

function ownedCities(state: CtpState, id: string, kind?: 'city' | 'resort'): Tile[] {
  return BOARD.filter((t) => {
    if (state.owned[String(t.id)] !== id) return false;
    if (kind) return t.kind === kind;
    return isProperty(t);
  });
}

function resolveLand(state: CtpState, id: string): void {
  if (state.winnerId) return;
  const pos = state.pos[id] ?? 0;
  const tile = BOARD[pos]!;
  if (tile.kind === 'start') {
    const cap = buildCap(state.laps[id] || 0);
    const can = (state.laps[id] || 0) >= 2 && ownedCities(state, id, 'city').some((t) => (state.level[String(t.id)] || 0) < cap);
    if (can) state.decision = { kind: 'upgrade', tileId: null };
    else finishTile(state);
    return;
  }
  if (tile.kind === 'jail') {
    sendJail(state, id);
    return;
  }
  if (tile.kind === 'chance') {
    drawChance(state, id);
    return;
  }
  if (tile.kind === 'festival') {
    if (!ownedCities(state, id, 'city').length) {
      pushLog(state, `${pname(state, id)} không có thành phố để mở hội.`);
      finishTile(state);
      return;
    }
    state.decision = { kind: 'festival', free: false };
    return;
  }
  if (tile.kind === 'bus') {
    if ((state.cash[id] || 0) < BUS_FEE) {
      pushLog(state, `${pname(state, id)} không đủ tiền bến xe.`);
      finishTile(state);
      return;
    }
    state.decision = { kind: 'bus' };
    return;
  }
  if (tile.kind === 'tax') {
    const due = Math.floor(assetValue(state, id) * 0.1);
    pushLog(state, `${pname(state, id)} đóng thuế ${due}.`);
    demand(state, id, due, null, { kind: 'done' });
    return;
  }
  if (tile.kind === 'game') {
    if ((state.cash[id] || 0) <= 0) {
      pushLog(state, `${pname(state, id)} hết tiền, bỏ ô đỏ đen.`);
      finishTile(state);
      return;
    }
    state.decision = { kind: 'game' };
    return;
  }
  const owner = state.owned[String(tile.id)];
  if (!owner) {
    state.decision = { kind: 'buy', tileId: tile.id };
    return;
  }
  if (owner === id) {
    const cap = buildCap(state.laps[id] || 0);
    const lv = state.level[String(tile.id)] || 0;
    if (lv < cap) state.decision = { kind: 'upgrade', tileId: tile.id };
    else finishTile(state);
    return;
  }
  const due = rentDue(state, tile.id, id);
  consumeRentMods(state, tile.id, id);
  pushLog(state, `${pname(state, id)} trả ${due} cho ${pname(state, owner)} tại ${tile.name}.`);
  demand(state, id, due, owner, { kind: 'buyout', tileId: tile.id });
}

function drawChance(state: CtpState, id: string): void {
  if (state.deckI >= state.deck.length) {
    state.deck = shuffle(DECK_SRC, state);
    state.deckI = 0;
  }
  const card = state.deck[state.deckI] ?? 'cash100';
  state.deckI += 1;
  pushLog(state, `${pname(state, id)} rút: ${CARD_LABEL[card]}.`);
  applyCard(state, id, card);
}

function richestOther(state: CtpState, id: string): string | null {
  let best: string | null = null;
  let n = -1;
  for (const p of alive(state)) {
    if (p.id === id) continue;
    const w = netWorth(state, p.id);
    if (w > n) {
      n = w;
      best = p.id;
    }
  }
  return best;
}

function topTile(state: CtpState, id: string, pred: (t: Tile, level: number) => boolean): Tile | null {
  let best: Tile | null = null;
  let score = -1;
  for (const t of ownedCities(state, id)) {
    const level = state.level[String(t.id)] || 0;
    if (!pred(t, level)) continue;
    const s = level * 10000 + t.price;
    if (s > score) {
      score = s;
      best = t;
    }
  }
  return best;
}

function applyCard(state: CtpState, id: string, card: CardId): void {
  if (card === 'cash100' || card === 'cash150') {
    const n = card === 'cash100' ? 100 : 150;
    state.cash[id] = (state.cash[id] || 0) + n;
    finishTile(state);
    return;
  }
  if (card === 'lose80' || card === 'lose120') {
    demand(state, id, card === 'lose80' ? 80 : 120, null, { kind: 'done' });
    return;
  }
  if (card === 'jailcard') {
    state.jailCards[id] = (state.jailCards[id] || 0) + 1;
    finishTile(state);
    return;
  }
  if (card === 'freeRent') {
    state.freeRent[id] = (state.freeRent[id] || 0) + 1;
    finishTile(state);
    return;
  }
  if (card === 'halfRent') {
    state.halfRent[id] = (state.halfRent[id] || 0) + 1;
    finishTile(state);
    return;
  }
  if (card === 'freeFest') {
    if (!ownedCities(state, id, 'city').length) {
      pushLog(state, 'Thẻ lễ hội vô hiệu.');
      finishTile(state);
      return;
    }
    state.decision = { kind: 'festival', free: true };
    return;
  }
  if (card === 'world') {
    state.decision = { kind: 'world' };
    return;
  }
  if (card === 'goJail') {
    sendJail(state, id);
    return;
  }
  if (card === 'goTax') {
    travelForward(state, id, 23);
    return;
  }
  if (card === 'goFestival') {
    travelForward(state, id, 16);
    return;
  }
  if (card === 'goBus') {
    travelForward(state, id, 24);
    return;
  }
  if (card === 'goStart') {
    travelForward(state, id, 0);
    return;
  }
  if (card === 'demolish') {
    demolish(state, id);
    finishTile(state);
    return;
  }
  if (card === 'blackout' || card === 'plague') {
    const other = richestOther(state, id);
    const tile = other ? topTile(state, other, (t) => t.kind === 'city') : null;
    if (tile) {
      state.ailment[String(tile.id)] = { kind: card === 'plague' ? 'free' : 'half', left: 5 };
      pushLog(state, `${tile.name} bị ${card === 'plague' ? 'dịch' : 'mất điện'}.`);
    } else pushLog(state, 'Thẻ vô hiệu.');
    finishTile(state);
    return;
  }
  if (card === 'forceSell') {
    forceSell(state, id);
    finishTile(state);
    return;
  }
  swapCities(state, id);
  finishTile(state);
}

function travelForward(state: CtpState, id: string, dest: number): void {
  const steps = (dest - (state.pos[id] ?? 0) + BOARD_LEN) % BOARD_LEN;
  if (steps === 0) {
    resolveLand(state, id);
    return;
  }
  doMove(state, id, steps);
  resolveLand(state, id);
}

function demolish(state: CtpState, id: string): void {
  let victim: Tile | null = null;
  let owner = '';
  let score = 0;
  for (const p of alive(state)) {
    if (p.id === id) continue;
    for (const t of ownedCities(state, p.id)) {
      const level = state.level[String(t.id)] || 0;
      if (level <= 0) continue;
      const s = level * 10000 + t.price;
      if (s > score) {
        score = s;
        victim = t;
        owner = p.id;
      }
    }
  }
  if (!victim) {
    pushLog(state, 'Không có nhà để phá.');
    return;
  }
  const drop = (tile: Tile) => {
    const k = String(tile.id);
    const lv = state.level[k] || 0;
    if (lv <= 0) return;
    state.level[k] = lv - 1;
  };
  drop(victim);
  for (const d of [-1, 1]) {
    const nid = (victim.id + d + BOARD_LEN) % BOARD_LEN;
    const n = BOARD[nid]!;
    if (state.owned[String(nid)] === owner && isProperty(n)) drop(n);
  }
  pushLog(state, `Phá cấp tại ${victim.name}.`);
}

function forceSell(state: CtpState, id: string): void {
  const other = richestOther(state, id);
  if (!other) return;
  const built = topTile(state, other, (_t, level) => level > 0);
  if (built) {
    refundDowngrade(state, other, built);
    pushLog(state, `${pname(state, other)} phải hạ cấp ${built.name}.`);
    return;
  }
  const lands = ownedCities(state, other).sort((a, b) => a.price - b.price);
  const land = lands[0];
  if (!land) {
    pushLog(state, 'Thẻ bán nhà vô hiệu.');
    return;
  }
  const gain = Math.floor(land.price / 2);
  delete state.owned[String(land.id)];
  delete state.level[String(land.id)];
  if (state.festivalOn === land.id) state.festivalOn = null;
  state.cash[other] = (state.cash[other] || 0) + gain;
  pushLog(state, `${pname(state, other)} bị bán ${land.name}, +${gain}.`);
}

function swapCities(state: CtpState, id: string): void {
  const mine = ownedCities(state, id, 'city').filter((t) => (state.level[String(t.id)] || 0) < 4);
  const others: Tile[] = [];
  for (const p of alive(state)) {
    if (p.id === id) continue;
    for (const t of ownedCities(state, p.id, 'city')) {
      if ((state.level[String(t.id)] || 0) < 4) others.push(t);
    }
  }
  if (!mine.length || !others.length) {
    pushLog(state, 'Thẻ đổi nhà vô hiệu.');
    return;
  }
  const give = [...mine].sort((a, b) => a.price - b.price)[0]!;
  const take = [...others].sort((a, b) => b.price - a.price)[0]!;
  const owner = state.owned[String(take.id)]!;
  state.owned[String(give.id)] = owner;
  state.owned[String(take.id)] = id;
  pushLog(state, `${pname(state, id)} đổi ${give.name} lấy ${take.name}.`);
  checkWin(state, id);
}

function refundDowngrade(state: CtpState, id: string, tile: Tile): number {
  const k = String(tile.id);
  const lv = state.level[k] || 0;
  if (lv <= 0) return 0;
  const gain = Math.floor((tile.build[lv - 1] ?? 0) / 2);
  state.level[k] = lv - 1;
  state.cash[id] = (state.cash[id] || 0) + gain;
  return gain;
}

function bust(state: CtpState, id: string, to: string | null): void {
  if (state.bankrupt.includes(id)) return;
  const left = state.cash[id] || 0;
  state.cash[id] = 0;
  if (to && !state.bankrupt.includes(to)) state.cash[to] = (state.cash[to] || 0) + left;
  for (const tile of BOARD) {
    const k = String(tile.id);
    if (state.owned[k] !== id) continue;
    if (to && !state.bankrupt.includes(to)) state.owned[k] = to;
    else {
      delete state.owned[k];
      delete state.level[k];
      delete state.ailment[k];
      if (state.festivalOn === tile.id) state.festivalOn = null;
    }
  }
  state.bankrupt = [...state.bankrupt, id];
  state.jailed[id] = 0;
  state.travel[id] = false;
  state.decision = null;
  state.extra = false;
  pushLog(state, `${pname(state, id)} phá sản.`);
  checkWin(state, to ?? undefined);
  if (!state.winnerId) finishTurn(state);
}

function diceOk(dice: [number, number] | undefined, state: CtpState): [number, number] | null {
  if (!dice) return [rollDie(state), rollDie(state)];
  if (dice[0] < 1 || dice[0] > 6 || dice[1] < 1 || dice[1] > 6) return null;
  if (!Number.isInteger(dice[0]) || !Number.isInteger(dice[1])) return null;
  return [dice[0], dice[1]];
}

function handleRoll(state: CtpState, diceIn: [number, number] | undefined): CtpResult | null {
  const id = state.turn;
  const dice = diceOk(diceIn, state);
  if (!dice) return { ok: false, error: 'illegal' };
  state.dice = dice;
  const sum = dice[0] + dice[1];
  if (dice[0] === dice[1]) {
    state.streak += 1;
    if (state.streak >= 3) {
      pushLog(state, `${pname(state, id)} đổ đôi lần ba — vào đảo.`);
      sendJail(state, id);
      return { ok: true, state };
    }
    state.extra = true;
    pushLog(state, `${pname(state, id)} đổ đôi ${dice[0]}-${dice[1]}.`);
  } else {
    state.streak = 0;
    state.extra = false;
    pushLog(state, `${pname(state, id)} đổ ${dice[0]}-${dice[1]}.`);
  }
  doMove(state, id, sum);
  resolveLand(state, id);
  return { ok: true, state };
}

function payBuild(state: CtpState, id: string, tile: Tile, from: number, to: number): number | null {
  let cost = 0;
  for (let i = from; i < to; i++) cost += tile.build[i] ?? 0;
  if ((state.cash[id] || 0) < cost) return null;
  state.cash[id] = (state.cash[id] || 0) - cost;
  state.level[String(tile.id)] = to;
  return cost;
}

function handleDecision(state: CtpState, action: CtpAction): CtpResult | null {
  const me = state.turn;
  const d = state.decision;
  if (!d) return null;

  if (d.kind === 'short') {
    if (action.type === 'sell') {
      const tile = BOARD[action.tileId];
      if (!tile || state.owned[String(tile.id)] !== me || !isProperty(tile)) return { ok: false, error: 'illegal' };
      const lv = state.level[String(tile.id)] || 0;
      if (lv > 0) {
        const gain = refundDowngrade(state, me, tile);
        pushLog(state, `Hạ cấp ${tile.name}, +${gain}.`);
      } else {
        const gain = Math.floor(tile.price / 2);
        delete state.owned[String(tile.id)];
        delete state.level[String(tile.id)];
        if (state.festivalOn === tile.id) state.festivalOn = null;
        state.cash[me] = (state.cash[me] || 0) + gain;
        pushLog(state, `Bán ${tile.name} cho nhà cái, +${gain}.`);
      }
      return { ok: true, state };
    }
    if (action.type === 'settle') {
      if ((state.cash[me] || 0) < d.due) return { ok: false, error: 'illegal' };
      state.cash[me] -= d.due;
      if (d.to && !state.bankrupt.includes(d.to)) state.cash[d.to] = (state.cash[d.to] || 0) + d.due;
      const resume = d.resume;
      state.decision = null;
      continueResume(state, resume);
      return { ok: true, state };
    }
    if (action.type === 'bust') {
      bust(state, me, d.to);
      return { ok: true, state };
    }
    return { ok: false, error: 'illegal' };
  }

  if (d.kind === 'buy' && action.type === 'skip') {
    pushLog(state, `${pname(state, me)} bỏ ${BOARD[d.tileId]!.name}.`);
    state.decision = null;
    finishTile(state);
    return { ok: true, state };
  }
  if (d.kind === 'buy' && action.type === 'buy') {
    const tile = BOARD[d.tileId]!;
    const cap = buildCap(state.laps[me] || 0);
    if (!isProperty(tile) || action.level < 0 || action.level > cap || !Number.isInteger(action.level)) {
      return { ok: false, error: 'illegal' };
    }
    let cost = tile.price;
    for (let i = 0; i < action.level; i++) cost += tile.build[i] ?? 0;
    if ((state.cash[me] || 0) < cost) return { ok: false, error: 'illegal' };
    state.cash[me] -= cost;
    state.owned[String(tile.id)] = me;
    state.level[String(tile.id)] = action.level;
    state.decision = null;
    pushLog(state, `${pname(state, me)} mua ${tile.name} (${levelName(action.level)}).`);
    checkWin(state, me);
    finishTile(state);
    return { ok: true, state };
  }

  if (d.kind === 'upgrade' && action.type === 'skip') {
    state.decision = null;
    finishTile(state);
    return { ok: true, state };
  }
  if (d.kind === 'upgrade' && action.type === 'upgrade') {
    const tile = BOARD[action.tileId];
    if (!tile || !isProperty(tile) || state.owned[String(tile.id)] !== me) return { ok: false, error: 'illegal' };
    if (d.tileId != null && d.tileId !== tile.id) return { ok: false, error: 'illegal' };
    if (d.tileId == null && tile.kind !== 'city') return { ok: false, error: 'illegal' };
    const cur = state.level[String(tile.id)] || 0;
    const cap = buildCap(state.laps[me] || 0);
    if (action.toLevel <= cur || action.toLevel > cap) return { ok: false, error: 'illegal' };
    const cost = payBuild(state, me, tile, cur, action.toLevel);
    if (cost == null) return { ok: false, error: 'illegal' };
    state.decision = null;
    pushLog(state, `${pname(state, me)} xây ${tile.name} lên ${levelName(action.toLevel)}.`);
    finishTile(state);
    return { ok: true, state };
  }

  if (d.kind === 'buyout' && action.type === 'skip') {
    state.decision = null;
    finishTile(state);
    return { ok: true, state };
  }
  if (d.kind === 'buyout' && action.type === 'buyout') {
    const price = buyoutPrice(state, d.tileId);
    const owner = state.owned[String(d.tileId)];
    if (price == null || owner == null || owner === me || (state.cash[me] || 0) < price) {
      return { ok: false, error: 'illegal' };
    }
    state.cash[me] -= price;
    state.cash[owner] = (state.cash[owner] || 0) + price;
    state.owned[String(d.tileId)] = me;
    state.decision = null;
    pushLog(state, `${pname(state, me)} mua lại ${BOARD[d.tileId]!.name} giá ${price}.`);
    checkWin(state, me);
    finishTile(state);
    return { ok: true, state };
  }

  if (d.kind === 'festival' && action.type === 'festival') {
    if (action.tileId == null) {
      state.decision = null;
      finishTile(state);
      return { ok: true, state };
    }
    const tile = BOARD[action.tileId];
    if (!tile || tile.kind !== 'city' || state.owned[String(tile.id)] !== me) return { ok: false, error: 'illegal' };
    const fee = d.free ? 0 : FEST_FEE;
    if ((state.cash[me] || 0) < fee) return { ok: false, error: 'illegal' };
    state.cash[me] -= fee;
    state.festivalOn = tile.id;
    state.decision = null;
    pushLog(state, `${pname(state, me)} mở hội tại ${tile.name}. Phí ghé ×2.`);
    finishTile(state);
    return { ok: true, state };
  }

  if (d.kind === 'bus' && action.type === 'bus') {
    if (action.take) {
      if ((state.cash[me] || 0) < BUS_FEE) return { ok: false, error: 'illegal' };
      state.cash[me] -= BUS_FEE;
      state.travel[me] = true;
      pushLog(state, `${pname(state, me)} mua vé bến xe. Lượt sau chọn ô.`);
    }
    state.decision = null;
    finishTile(state);
    return { ok: true, state };
  }

  if (d.kind === 'game' && action.type === 'game') {
    const cash = state.cash[me] || 0;
    const min = Math.min(GAME_MIN, cash);
    if (action.stake < min || action.stake > cash || !Number.isInteger(action.stake) || action.stake <= 0) {
      return { ok: false, error: 'illegal' };
    }
    const face = action.face ?? (rng(state) < 0.5 ? 'do' : 'den');
    state.cash[me] = cash - action.stake;
    if (face === action.color) {
      state.cash[me] += action.stake * 2;
      pushLog(state, `Đỏ đen ra ${face === 'do' ? 'đỏ' : 'đen'}. Thắng ${action.stake}.`);
    } else {
      pushLog(state, `Đỏ đen ra ${face === 'do' ? 'đỏ' : 'đen'}. Mất ${action.stake}.`);
    }
    state.decision = null;
    finishTile(state);
    return { ok: true, state };
  }

  if (d.kind === 'world' && action.type === 'skip') {
    state.decision = null;
    finishTile(state);
    return { ok: true, state };
  }
  if (d.kind === 'world' && action.type === 'travel') {
    const tile = BOARD[action.tileId];
    if (!tile || tile.kind !== 'resort') return { ok: false, error: 'illegal' };
    state.decision = null;
    const from = state.pos[me] ?? 0;
    state.pos[me] = tile.id;
    state.last = { from, to: tile.id, path: [tile.id], jailed: false, fly: true };
    pushLog(state, `${pname(state, me)} bay tới ${tile.name}.`);
    resolveLand(state, me);
    return { ok: true, state };
  }

  return { ok: false, error: 'illegal' };
}

function handleJail(state: CtpState, action: Extract<CtpAction, { type: 'jail' }>): CtpResult | null {
  const me = state.turn;
  if ((state.jailed[me] || 0) <= 0) return { ok: false, error: 'illegal' };
  if (action.choice === 'card') {
    if ((state.jailCards[me] || 0) <= 0) return { ok: false, error: 'illegal' };
    state.jailCards[me] -= 1;
    state.jailed[me] = 0;
    pushLog(state, `${pname(state, me)} dùng thẻ ra đảo.`);
    return { ok: true, state };
  }
  if (action.choice === 'pay') {
    demand(state, me, JAIL_FINE, null, { kind: 'unjail' });
    return { ok: true, state };
  }
  const dice = diceOk(action.dice, state);
  if (!dice) return { ok: false, error: 'illegal' };
  state.dice = dice;
  if (dice[0] === dice[1]) {
    state.jailed[me] = 0;
    state.streak = 0;
    state.extra = false;
    pushLog(state, `${pname(state, me)} đổ đôi, ra đảo.`);
    doMove(state, me, dice[0] + dice[1]);
    resolveLand(state, me);
    return { ok: true, state };
  }
  state.jailed[me] -= 1;
  if ((state.jailed[me] || 0) > 0) {
    pushLog(state, `${pname(state, me)} chưa ra đảo, còn ${state.jailed[me]} lượt.`);
    finishTurn(state);
    return { ok: true, state };
  }
  pushLog(state, `${pname(state, me)} hết lượt đảo, nộp ${JAIL_FINE}.`);
  demand(state, me, JAIL_FINE, null, { kind: 'move', steps: dice[0] + dice[1] });
  return { ok: true, state };
}

export function applyCtp(prev: CtpState, action: CtpAction): CtpResult {
  if (prev.winnerId) return { ok: false, error: 'ended' };
  const state = structuredClone(prev);
  state.last = null;
  const me = state.turn;

  if (state.decision) {
    const decided = handleDecision(state, action);
    if (!decided) return { ok: false, error: 'illegal' };
    return decided;
  }

  if ((state.jailed[me] || 0) > 0) {
    if (action.type !== 'jail') return { ok: false, error: 'illegal' };
    const jailed = handleJail(state, action);
    return jailed ?? { ok: false, error: 'illegal' };
  }

  if (state.travel[me]) {
    if (action.type !== 'travel') return { ok: false, error: 'illegal' };
    const tile = BOARD[action.tileId];
    if (!tile || action.tileId === (state.pos[me] ?? 0)) return { ok: false, error: 'illegal' };
    state.travel[me] = false;
    const steps = (action.tileId - (state.pos[me] ?? 0) + BOARD_LEN) % BOARD_LEN;
    pushLog(state, `${pname(state, me)} đi bến xe tới ${tile.name}.`);
    doMove(state, me, steps);
    resolveLand(state, me);
    return { ok: true, state };
  }

  if (action.type !== 'roll') return { ok: false, error: 'illegal' };
  const rolled = handleRoll(state, action.dice);
  return rolled ?? { ok: false, error: 'illegal' };
}

function reserveFor(state: CtpState, id: string): number {
  return setCount(state, id) >= 1 ? 180 : 360;
}

function cheapestSacrifice(state: CtpState, id: string): number | null {
  const mine = ownedCities(state, id);
  const built = mine.filter((t) => (state.level[String(t.id)] || 0) > 0);
  const pool = built.length ? built : mine;
  if (!pool.length) return null;
  const ranked = [...pool].sort((a, b) => {
    const la = state.level[String(a.id)] || 0;
    const lb = state.level[String(b.id)] || 0;
    const ca = la > 0 ? (a.build[la - 1] ?? 0) : a.price;
    const cb = lb > 0 ? (b.build[lb - 1] ?? 0) : b.price;
    return ca - cb;
  });
  return ranked[0]!.id;
}

function pickTravelTarget(state: CtpState, id: string, resortsOnly: boolean): number {
  const here = state.pos[id] ?? 0;
  const cash = state.cash[id] || 0;
  const reserve = reserveFor(state, id);
  const props = BOARD.filter((t) => (resortsOnly ? t.kind === 'resort' : isProperty(t)) && t.id !== here);
  const unowned = props
    .filter((t) => !state.owned[String(t.id)] && t.price <= cash - Math.min(reserve, 200))
    .sort((a, b) => b.price - a.price);
  if (unowned[0]) return unowned[0].id;
  const cap = buildCap(state.laps[id] || 0);
  const mine = props
    .filter((t) => state.owned[String(t.id)] === id && (state.level[String(t.id)] || 0) < cap)
    .sort((a, b) => b.price - a.price);
  if (mine[0]) return mine[0].id;
  return props[0]?.id ?? (here + 1) % BOARD_LEN;
}

export function suggestBot(state: CtpState): CtpAction {
  const me = state.turn;
  const d = state.decision;
  if (d?.kind === 'short') {
    if ((state.cash[me] || 0) >= d.due) return { type: 'settle' };
    const sell = cheapestSacrifice(state, me);
    if (sell != null) return { type: 'sell', tileId: sell };
    return { type: 'bust' };
  }
  if (d?.kind === 'buy') {
    const tile = BOARD[d.tileId]!;
    const cap = buildCap(state.laps[me] || 0);
    const cash = state.cash[me] || 0;
    const completes =
      tile.group != null &&
      BOARD.filter((t) => t.group === tile.group && t.id !== tile.id).every((t) => state.owned[String(t.id)] === me);
    const floor = completes ? 80 : reserveFor(state, me);
    if (cash < tile.price || cash - tile.price < floor) return { type: 'skip' };
    let level = 0;
    let cost = tile.price;
    while (level < cap && cash - (cost + (tile.build[level] ?? 0)) >= floor) {
      cost += tile.build[level] ?? 0;
      level += 1;
    }
    return { type: 'buy', level };
  }
  if (d?.kind === 'upgrade') {
    const cap = buildCap(state.laps[me] || 0);
    const pool =
      d.tileId != null
        ? ownedCities(state, me).filter((t) => t.id === d.tileId)
        : ownedCities(state, me, 'city');
    const ranked = [...pool].filter((t) => (state.level[String(t.id)] || 0) < cap).sort((a, b) => b.price - a.price);
    const tile = ranked[0];
    if (!tile) return { type: 'skip' };
    const cur = state.level[String(tile.id)] || 0;
    const step = tile.build[cur] ?? 0;
    if ((state.cash[me] || 0) - step < reserveFor(state, me)) return { type: 'skip' };
    return { type: 'upgrade', tileId: tile.id, toLevel: cur + 1 };
  }
  if (d?.kind === 'buyout') {
    const tile = BOARD[d.tileId]!;
    const completes =
      tile.group != null &&
      BOARD.filter((t) => t.group === tile.group && t.id !== tile.id).every((t) => state.owned[String(t.id)] === me);
    const keep = completes ? 100 : 320;
    if (completes || d.price < tile.price * 1.3) {
      if ((state.cash[me] || 0) - d.price >= keep) return { type: 'buyout' };
    }
    return { type: 'skip' };
  }
  if (d?.kind === 'festival') {
    const fee = d.free ? 0 : FEST_FEE;
    const cities = ownedCities(state, me, 'city').sort((a, b) => (state.level[String(b.id)] || 0) - (state.level[String(a.id)] || 0));
    const tile = cities[0];
    if (!tile || (state.cash[me] || 0) - fee < 280) return { type: 'festival', tileId: null };
    return { type: 'festival', tileId: tile.id };
  }
  if (d?.kind === 'bus') {
    const useful = BOARD.some((t) => isProperty(t) && !state.owned[String(t.id)] && t.price + BUS_FEE < (state.cash[me] || 0) - 200);
    return { type: 'bus', take: useful };
  }
  if (d?.kind === 'game') {
    const cash = state.cash[me] || 0;
    const stake = cash >= GAME_MIN ? GAME_MIN : cash;
    return { type: 'game', color: cash % 200 === 0 ? 'do' : 'den', stake };
  }
  if (d?.kind === 'world') {
    return { type: 'travel', tileId: pickTravelTarget(state, me, true) };
  }
  if ((state.jailed[me] || 0) > 0) {
    if ((state.jailCards[me] || 0) > 0) return { type: 'jail', choice: 'card' };
    if ((state.cash[me] || 0) >= 500) return { type: 'jail', choice: 'pay' };
    return { type: 'jail', choice: 'roll' };
  }
  if (state.travel[me]) return { type: 'travel', tileId: pickTravelTarget(state, me, false) };
  return { type: 'roll' };
}

export const WIN_LABEL: Record<WinReason, string> = {
  bankrupt: 'Người cuối cùng chưa phá sản',
  resorts: 'Sở hữu đủ 5 điểm nghỉ',
  sets: 'Sở hữu 3 bộ màu',
  row: 'Sở hữu trọn thành phố một cạnh',
  rounds: 'Hết 30 vòng — nhiều của nhất',
};
