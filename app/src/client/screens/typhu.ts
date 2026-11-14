import { esc } from '../../shared/esc.js';
import {
  BOARD,
  BOARD_LEN,
  BUS_FEE,
  FEST_FEE,
  GAME_MIN,
  GROUP_COLOR,
  GROUP_LABEL,
  JAIL_FINE,
  ROUND_LIMIT,
  SEAT_COLOR,
  START_CASH,
  WIN_LABEL,
  applyCtp,
  buildCap,
  createGame,
  isProperty,
  levelName,
  netWorth,
  ownsGroup,
  setCount,
  suggestBot,
  type CtpAction,
  type CtpState,
  type LastMove,
  type Tile,
} from '../../shared/co-ty-phu.js';

const SAVE_KEY = 'hng.co-ty-phu.v1';

type Draft = { id: string; name: string; bot: boolean };

let root: HTMLElement | null = null;
let game: CtpState | null = null;
let draft: Draft[] = [
  { id: 'p1', name: 'Bạn', bot: false },
  { id: 'p2', name: 'Nhà cái', bot: true },
];
let inspect: number | null = null;
let busy = false;
let spinning = false;
let pawnAt: Record<string, number> | null = null;
let gen = 0;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function wait(ms: number): Promise<void> {
  const n = reduceMotion() ? 0 : ms;
  return new Promise((resolve) => setTimeout(resolve, n));
}

function coin(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

function seatIndex(state: CtpState, id: string): number {
  return state.players.findIndex((p) => p.id === id);
}

function seatColor(state: CtpState, id: string): string {
  return SEAT_COLOR[seatIndex(state, id) % SEAT_COLOR.length] ?? SEAT_COLOR[0];
}

function load(): CtpState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CtpState;
    if (!parsed || !Array.isArray(parsed.players) || parsed.players.length < 2) return null;
    if (!parsed.turn || parsed.pos?.[parsed.turn] == null) return null;
    if (parsed.players.some((p) => typeof p.id !== 'string' || typeof p.name !== 'string')) return null;
    return parsed;
  } catch {
    return null;
  }
}

function save(): void {
  try {
    if (!game) localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  } catch {
    /* private mode */
  }
}

function gridOf(i: number): { c: number; r: number } {
  if (i <= 8) return { c: i + 1, r: 9 };
  if (i <= 16) return { c: 9, r: 9 - (i - 8) };
  if (i <= 24) return { c: 9 - (i - 16), r: 1 };
  return { c: 1, r: 1 + (i - 24) };
}

function pawnSvg(seat: number): string {
  const fill = SEAT_COLOR[seat % 4]!;
  const body = [
    `<path d="M6 22h20l-2-6H12l-3 6z" fill="${fill}" stroke="#1a120c" stroke-width="1.6"/><path d="M9 16c1-6 4-9 7-9s6 3 7 9" fill="${fill}" stroke="#1a120c" stroke-width="1.6"/><path d="M8 16h16" stroke="#1a120c" stroke-width="1.4"/>`,
    `<path d="M16 6c4 3 6 6 6 10H10c0-4 2-7 6-10z" fill="${fill}" stroke="#1a120c" stroke-width="1.6"/><path d="M16 6v20M12 28h8" stroke="#1a120c" stroke-width="1.6" stroke-linecap="round"/>`,
    `<path d="M6 20 L16 6 L26 20 Z" fill="${fill}" stroke="#1a120c" stroke-width="1.6"/><path d="M16 20v10M11 30h10" stroke="#1a120c" stroke-width="1.6" stroke-linecap="round"/>`,
    `<circle cx="16" cy="14" r="8" fill="${fill}" stroke="#1a120c" stroke-width="1.6"/><path d="M8 12c-3 0-4-4-2-5M24 12c3 0 4-4 2-5M12 30h8" stroke="#1a120c" stroke-width="1.6" stroke-linecap="round" fill="none"/>`,
  ][seat % 4]!;
  return `<svg viewBox="0 0 32 34" aria-hidden="true"><ellipse cx="16" cy="31" rx="8" ry="2.4" fill="#000" opacity=".35"/>${body}</svg>`;
}

function pips(face: number): string {
  const on = new Set<number>();
  const map: Record<number, number[]> = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
  };
  for (const n of map[face] ?? []) on.add(n);
  return Array.from({ length: 9 }, (_, i) => `<i${on.has(i + 1) ? ' class="on"' : ''}></i>`).join('');
}

function dieHtml(face: number): string {
  const f = face >= 1 && face <= 6 ? face : 1;
  const show: Record<number, string> = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateY(-90deg)',
    3: 'rotateX(-90deg)',
    4: 'rotateX(90deg)',
    5: 'rotateY(90deg)',
    6: 'rotateY(180deg)',
  };
  return `<div class="ctp-die${spinning ? ' is-spin' : ''}" style="--face:${show[f]}">
    <div class="ctp-cube">
      <span class="ctp-face ctp-f1">${pips(1)}</span>
      <span class="ctp-face ctp-f2">${pips(2)}</span>
      <span class="ctp-face ctp-f3">${pips(3)}</span>
      <span class="ctp-face ctp-f4">${pips(4)}</span>
      <span class="ctp-face ctp-f5">${pips(5)}</span>
      <span class="ctp-face ctp-f6">${pips(6)}</span>
    </div>
  </div>`;
}

function houses(level: number): string {
  if (level <= 0) return '';
  if (level === 1) return `<svg class="ctp-bldg" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6 L6 2 L11 6 V11 H1Z" fill="#fff" stroke="#1a120c" stroke-width="1"/></svg>`;
  if (level === 2) {
    return `<svg class="ctp-bldg" viewBox="0 0 16 12" aria-hidden="true"><path d="M1 6 L5 3 L9 6 V11 H1Z" fill="#fff" stroke="#1a120c" stroke-width="1"/><path d="M7 6 L11 3 L15 6 V11 H7Z" fill="#e9f7ff" stroke="#1a120c" stroke-width="1"/></svg>`;
  }
  if (level === 3) {
    return `<svg class="ctp-bldg" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="3" width="8" height="8" fill="#e23a32" stroke="#1a120c" stroke-width="1"/><path d="M1 4 H11" stroke="#1a120c" stroke-width="1"/><rect x="4" y="6" width="2" height="2" fill="#fff"/></svg>`;
  }
  return `<svg class="ctp-bldg" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 L8 4 H4Z M6 4 L9 7 H3Z M6 7 L10 11 H2Z" fill="#f6d34d" stroke="#1a120c" stroke-width="0.8"/></svg>`;
}

function cornerArt(kind: Tile['kind']): string {
  if (kind === 'start') {
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="28" r="12" fill="#fff4c2"/><path d="M8 46h48v6H8z" fill="#1a120c"/><path d="M14 46 V30 h8 v16 M42 46 V30 h8 v16 M22 46 V24 h20 v22" fill="none" stroke="#1a120c" stroke-width="3"/><path d="M22 24 h20 l-10-8z" fill="#e23a32" stroke="#1a120c" stroke-width="2"/></svg>`;
  }
  if (kind === 'jail') {
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 40c8-10 16-8 26-8s16 0 26 8v10H6z" fill="#7fd0c4"/><circle cx="46" cy="16" r="6" fill="#1a120c"/><path d="M18 28v20M26 24v24M34 24v24M42 28v20" stroke="#f4efe4" stroke-width="3"/><path d="M14 28h32" stroke="#f4efe4" stroke-width="3"/></svg>`;
  }
  if (kind === 'festival') {
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 44h48v6H8z" fill="#1a120c"/><path d="M16 44 V26 h32 v18" fill="#f6d34d" stroke="#1a120c" stroke-width="2"/><circle cx="20" cy="16" r="5" fill="#e23a32"/><circle cx="32" cy="12" r="5" fill="#f6d34d"/><circle cx="44" cy="16" r="5" fill="#2bb8d6"/><path d="M20 21v5M32 17v5M44 21v5" stroke="#1a120c" stroke-width="1.6"/></svg>`;
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="22" width="48" height="22" rx="6" fill="#f4efe4" stroke="#1a120c" stroke-width="2.4"/><rect x="14" y="28" width="12" height="8" fill="#7ec8f8" stroke="#1a120c"/><rect x="30" y="28" width="12" height="8" fill="#7ec8f8" stroke="#1a120c"/><circle cx="20" cy="48" r="5" fill="#1a120c"/><circle cx="46" cy="48" r="5" fill="#1a120c"/></svg>`;
}

function cellHtml(state: CtpState, tile: Tile): string {
  const g = gridOf(tile.id);
  const owner = state.owned[String(tile.id)];
  const level = state.level[String(tile.id)] || 0;
  const band = tile.group ? GROUP_COLOR[tile.group] : tile.kind === 'resort' ? '#0e8f86' : '#c9a15b';
  const gold = state.gold.includes(tile.id) ? '<i class="ctp-gold" aria-hidden="true"></i>' : '';
  const fest = state.festivalOn === tile.id ? '<i class="ctp-fest" aria-hidden="true"></i>' : '';
  const own = owner ? `<i class="ctp-own" style="background:${seatColor(state, owner)}"></i>` : '';
  const here = state.players.filter((p) => (pawnAt?.[p.id] ?? state.pos[p.id]) === tile.id).length;
  const label = `${tile.name}${owner ? `, của ${state.players.find((p) => p.id === owner)?.name ?? ''}` : ''}${here ? `, ${here} quân` : ''}`;
  if (tile.kind === 'start' || tile.kind === 'jail' || tile.kind === 'festival' || tile.kind === 'bus') {
    return `<button type="button" class="ctp-cell ctp-corner ctp-k-${tile.kind}${inspect === tile.id ? ' is-on' : ''}" data-act="look" data-i="${tile.id}" style="grid-column:${g.c};grid-row:${g.r}" aria-label="${esc(label)}">${cornerArt(tile.kind)}<b>${esc(tile.name)}</b>${own}</button>`;
  }
  const sub = isProperty(tile) ? `<span class="ctp-pr">${coin(tile.price)}</span>` : `<span class="ctp-pr">${esc(tile.name)}</span>`;
  const nm = isProperty(tile) ? `<span class="ctp-nm">${esc(tile.name)}</span>` : '';
  return `<button type="button" class="ctp-cell ctp-s${tile.side} ctp-k-${tile.kind}${inspect === tile.id ? ' is-on' : ''}" data-act="look" data-i="${tile.id}" style="--band:${band};grid-column:${g.c};grid-row:${g.r}" aria-label="${esc(label)}"><span class="ctp-band">${houses(level)}${gold}${fest}</span>${nm}${sub}${own}</button>`;
}

function plaza(state: CtpState): string {
  const dice = state.dice ?? [1, 1];
  const win = state.winnerId
    ? `<div class="ctp-win"><b>${esc(state.players.find((p) => p.id === state.winnerId)?.name ?? '')} thắng</b><span>${esc(WIN_LABEL[state.winReason ?? 'bankrupt'])}</span></div>`
    : '';
  const line = state.log[state.log.length - 1] ?? '';
  return `<div class="ctp-plaza" style="grid-column:2 / 9;grid-row:2 / 9">
    <p class="ctp-brand">Cờ tỷ phú</p>
    <div class="ctp-dice" aria-hidden="true">${dieHtml(dice[0])}${dieHtml(dice[1])}</div>
    <p class="ctp-round">Vòng ${Math.min(state.round + 1, ROUND_LIMIT)}/${ROUND_LIMIT}</p>
    <p class="ctp-last">${esc(line)}</p>
    ${win}
  </div>`;
}

function pawns(state: CtpState): string {
  return state.players
    .map((p, i) => {
      const broke = state.bankrupt.includes(p.id);
      return `<span class="ctp-pawn${p.id === state.turn && !state.winnerId ? ' is-turn' : ''}${broke ? ' is-out' : ''}" data-pawn="${esc(p.id)}" data-seat="${i}">${pawnSvg(i)}</span>`;
    })
    .join('');
}

function lookCard(state: CtpState): string {
  if (inspect == null) return '';
  const tile = BOARD[inspect];
  if (!tile) return '';
  const ownerId = state.owned[String(tile.id)];
  const owner = ownerId ? state.players.find((p) => p.id === ownerId) : null;
  const level = state.level[String(tile.id)] || 0;
  const bits: string[] = [];
  if (tile.group) bits.push(GROUP_LABEL[tile.group]);
  if (state.gold.includes(tile.id)) bits.push('Đất vàng ×2');
  if (state.festivalOn === tile.id) bits.push('Đang lễ hội ×2');
  if (owner && tile.group && ownsGroup(state, owner.id, tile.group)) bits.push('Đủ bộ ×2');
  const rents = isProperty(tile)
    ? `<ol class="ctp-rents">${tile.rent
        .map((n, i) => `<li class="${i === level ? 'is-now' : ''}">${esc(levelName(i))} <b>${coin(n)}</b></li>`)
        .join('')}</ol>`
    : '';
  return `<section class="ctp-inspect">
    <h3>${esc(tile.name)}</h3>
    <p>${esc(bits.join(' · ') || tileLabel(tile))}${owner ? ` · của ${esc(owner.name)}` : ''}${isProperty(tile) ? ` · ${esc(levelName(level))}` : ''}</p>
    ${isProperty(tile) ? `<p>Giá ${coin(tile.price)}. Xây ${tile.build.map((n) => coin(n)).join(' / ')}.</p>${rents}` : `<p>${esc(tileBlurb(tile))}</p>`}
  </section>`;
}

function tileLabel(tile: Tile): string {
  if (tile.kind === 'chance') return 'Cơ hội';
  if (tile.kind === 'tax') return 'Thuế';
  if (tile.kind === 'game') return 'Đỏ đen';
  if (tile.kind === 'resort') return 'Điểm nghỉ';
  return tile.name;
}

function tileBlurb(tile: Tile): string {
  switch (tile.kind) {
    case 'start':
      return `Đi qua được ${coin(GO_SAFE())}. Dừng trúng từ vòng thứ hai thì được xây thêm một thành phố.`;
    case 'jail':
      return `Bị giam tối đa 3 lượt. Ra bằng đổ đôi, nộp ${coin(JAIL_FINE)}, hoặc thẻ ra đảo. Đôi lần ba cũng vào đây.`;
    case 'festival':
      return `Trả ${coin(FEST_FEE)} để một thành phố của bạn thu phí gấp đôi.`;
    case 'bus':
      return `Trả ${coin(BUS_FEE)}. Lượt sau được chọn một ô bất kỳ và đi tới đó.`;
    case 'tax':
      return 'Nộp 10% giá trị đất và nhà đang sở hữu.';
    case 'game':
      return `Cược ít nhất ${coin(GAME_MIN)}. Đoán đúng đỏ/đen thì được gấp đôi tiền cược.`;
    case 'chance':
      return 'Rút một thẻ: tiền, đảo, lễ hội, phá nhà, hoặc bay du lịch.';
    default:
      return '';
  }
}

function GO_SAFE(): number {
  return 300;
}

function playersHtml(state: CtpState): string {
  return `<div class="ctp-whos">${state.players
    .map((p, i) => {
      const on = p.id === state.turn && !state.winnerId;
      const tags = [
        p.bot ? 'máy' : '',
        state.bankrupt.includes(p.id) ? 'phá sản' : '',
        (state.jailed[p.id] || 0) > 0 ? 'đảo' : '',
        state.travel[p.id] ? 'có vé' : '',
      ].filter(Boolean);
      return `<div class="ctp-who${on ? ' is-on' : ''}${state.bankrupt.includes(p.id) ? ' is-out' : ''}">
        <i style="background:${SEAT_COLOR[i % 4]}">${pawnSvg(i)}</i>
        <span>
          <b>${esc(p.name)}</b>
          <em>${coin(state.cash[p.id] || 0)} · ${coin(netWorth(state, p.id))} của</em>
          <small>${setCount(state, p.id)} bộ${tags.length ? ` · ${esc(tags.join(', '))}` : ''}</small>
        </span>
      </div>`;
    })
    .join('')}</div>`;
}

function dock(state: CtpState): string {
  if (state.winnerId) {
    return `<div class="ctp-dock"><button type="button" class="ctp-roll" data-act="again">VÁN MỚI</button></div>`;
  }
  const me = state.players.find((p) => p.id === state.turn)!;
  const mine = state.cash[me.id] || 0;
  const head = `<div class="ctp-turnline"><i style="background:${seatColor(state, me.id)}"></i><b>${esc(me.name)}</b><strong>${coin(mine)}</strong></div>`;
  if (me.bot) {
    return `<div class="ctp-dock">${head}<p class="ctp-wait">Đang đi…</p></div>`;
  }
  const d = state.decision;
  if (d?.kind === 'buy') {
    const tile = BOARD[d.tileId]!;
    const cap = buildCap(state.laps[me.id] || 0);
    const buttons: string[] = [];
    let cost = tile.price;
    for (let level = 0; level <= cap; level++) {
      if (level > 0) cost += tile.build[level - 1] ?? 0;
      if (mine >= cost) {
        buttons.push(
          `<button type="button" data-act="buy" data-level="${level}">${level === 0 ? 'Mua đất' : `Xây ${levelName(level)}`} · ${coin(cost)}</button>`,
        );
      }
    }
    return `<div class="ctp-dock">${head}<p>Dừng ở ${esc(tile.name)}. ${mine < tile.price ? 'Không đủ tiền mua.' : 'Mua và xây luôn?'}</p><div class="ctp-choices">${buttons.join('')}<button type="button" data-act="skip">Bỏ qua</button></div></div>`;
  }
  if (d?.kind === 'upgrade') {
    const cap = buildCap(state.laps[me.id] || 0);
    const pool = BOARD.filter((t) => {
      if (state.owned[String(t.id)] !== me.id) return false;
      if (d.tileId != null) return t.id === d.tileId;
      return t.kind === 'city';
    }).filter((t) => (state.level[String(t.id)] || 0) < cap);
    const buttons = pool
      .map((t) => {
        const cur = state.level[String(t.id)] || 0;
        let cost = 0;
        const bits: string[] = [];
        for (let to = cur + 1; to <= cap; to++) {
          cost += t.build[to - 1] ?? 0;
          if (mine < cost) break;
          bits.push(
            `<button type="button" data-act="up" data-i="${t.id}" data-to="${to}">${esc(t.name)} lên ${esc(levelName(to))} · ${coin(cost)}</button>`,
          );
        }
        return bits.join('');
      })
      .join('');
    return `<div class="ctp-dock">${head}<p>${d.tileId == null ? 'Dừng trúng Bắt đầu — xây thêm một thành phố.' : `Xây thêm ở ${esc(BOARD[d.tileId]!.name)}?`}</p><div class="ctp-choices">${buttons}<button type="button" data-act="skip">Để sau</button></div></div>`;
  }
  if (d?.kind === 'buyout') {
    const tile = BOARD[d.tileId]!;
    return `<div class="ctp-dock">${head}<p>Mua lại ${esc(tile.name)} giá ${coin(d.price)}?</p><div class="ctp-choices"><button type="button" class="is-hot" data-act="buyout">Mua lại · ${coin(d.price)}</button><button type="button" data-act="skip">Thôi</button></div></div>`;
  }
  if (d?.kind === 'festival') {
    const fee = d.free ? 0 : FEST_FEE;
    const buttons = BOARD.filter((t) => t.kind === 'city' && state.owned[String(t.id)] === me.id)
      .map((t) => `<button type="button" data-act="fest" data-i="${t.id}" ${mine >= fee ? '' : 'disabled'}>${esc(t.name)}</button>`)
      .join('');
    return `<div class="ctp-dock">${head}<p>Mở lễ hội${fee ? ` (tốn ${coin(fee)})` : ''}. Phí ghé ô đó ×2.</p><div class="ctp-choices">${buttons}<button type="button" data-act="fest-skip">Bỏ qua</button></div></div>`;
  }
  if (d?.kind === 'bus') {
    return `<div class="ctp-dock">${head}<p>Mua vé ${coin(BUS_FEE)} để lượt sau chọn ô bất kỳ?</p><div class="ctp-choices"><button type="button" class="is-hot" data-act="bus" data-take="1">Mua vé</button><button type="button" data-act="bus" data-take="0">Ở lại</button></div></div>`;
  }
  if (d?.kind === 'game') {
    const stakes = [Math.min(GAME_MIN, mine), Math.min(GAME_MIN * 2, mine)].filter((n, i, a) => n > 0 && a.indexOf(n) === i);
    const buttons = stakes
      .flatMap((stake) => [
        `<button type="button" class="is-red" data-act="bet" data-color="do" data-stake="${stake}">Đỏ · ${coin(stake)}</button>`,
        `<button type="button" class="is-dark" data-act="bet" data-color="den" data-stake="${stake}">Đen · ${coin(stake)}</button>`,
      ])
      .join('');
    return `<div class="ctp-dock">${head}<p>Đỏ hay đen? Đoán đúng được gấp đôi.</p><div class="ctp-choices">${buttons}</div></div>`;
  }
  if (d?.kind === 'world') {
    const buttons = BOARD.filter((t) => t.kind === 'resort')
      .map((t) => `<button type="button" data-act="fly" data-i="${t.id}">${esc(t.name)}</button>`)
      .join('');
    return `<div class="ctp-dock">${head}<p>Du lịch thế giới — bay tới một điểm nghỉ.</p><div class="ctp-choices">${buttons}<button type="button" data-act="skip">Ở lại</button></div></div>`;
  }
  if (d?.kind === 'short') {
    const mineTiles = BOARD.filter((t) => state.owned[String(t.id)] === me.id && isProperty(t));
    const buttons = mineTiles
      .map((t) => {
        const lv = state.level[String(t.id)] || 0;
        const gain = lv > 0 ? Math.floor((t.build[lv - 1] ?? 0) / 2) : Math.floor(t.price / 2);
        return `<button type="button" data-act="sell" data-i="${t.id}">${lv > 0 ? 'Hạ' : 'Bán'} ${esc(t.name)} +${coin(gain)}</button>`;
      })
      .join('');
    const ready = mine >= d.due;
    return `<div class="ctp-dock">${head}<p>Cần ${coin(d.due)}. Đang có ${coin(mine)}.</p><div class="ctp-choices">${buttons}<button type="button" class="is-hot" data-act="settle" ${ready ? '' : 'disabled'}>Trả ${coin(d.due)}</button><button type="button" data-act="bust">Phá sản</button></div></div>`;
  }
  if ((state.jailed[me.id] || 0) > 0) {
    const left = state.jailed[me.id] || 0;
    const card = (state.jailCards[me.id] || 0) > 0;
    return `<div class="ctp-dock">${head}<p>Côn Đảo, còn ${left} lượt thử.</p><div class="ctp-choices"><button type="button" class="ctp-roll" data-act="jail" data-choice="roll">ĐỔ TÌM ĐÔI</button><button type="button" data-act="jail" data-choice="pay" ${mine >= JAIL_FINE ? '' : 'disabled'}>Nộp ${coin(JAIL_FINE)}</button>${card ? '<button type="button" data-act="jail" data-choice="card">Dùng thẻ</button>' : ''}</div></div>`;
  }
  if (state.travel[me.id]) {
    const buttons = BOARD.filter((t) => t.id !== (state.pos[me.id] ?? 0))
      .map((t) => `<button type="button" data-act="go" data-i="${t.id}">${esc(t.name)}</button>`)
      .join('');
    return `<div class="ctp-dock">${head}<p>Vé bến xe — chọn nơi đến.</p><div class="ctp-choices ctp-go">${buttons}</div></div>`;
  }
  const again = (state.streak || 0) > 0;
  return `<div class="ctp-dock">${head}<button type="button" class="ctp-roll" data-act="roll"${busy ? ' disabled' : ''}>${again ? 'ĐỔ TIẾP' : 'ĐỔ'}</button></div>`;
}

function boardHtml(state: CtpState): string {
  return `<div class="ctp-table"><div class="ctp-board">${BOARD.map((t) => cellHtml(state, t)).join('')}${plaza(state)}${pawns(state)}</div></div>`;
}

function setupHtml(): string {
  const saved = load();
  const rows = draft
    .map((p, i) => {
      return `<div class="ctp-draft">
        <i style="background:${SEAT_COLOR[i % 4]}">${pawnSvg(i)}</i>
        <input data-name="${i}" maxlength="16" value="${esc(p.name)}" aria-label="Tên người ${i + 1}">
        <button type="button" data-act="bot" data-i="${i}" aria-pressed="${p.bot ? 'true' : 'false'}">${p.bot ? 'Máy' : 'Người'}</button>
        ${draft.length > 2 ? `<button type="button" data-act="drop" data-i="${i}" aria-label="Bớt người">×</button>` : ''}
      </div>`;
    })
    .join('');
  return `<div class="ctp-setup">
    <div class="ctp-hero">
      <p class="ctp-brand">Cờ tỷ phú</p>
      <p>Đổ xúc xắc, mua đất, xây đến khu nghỉ. 2–4 người trên một máy, hoặc đấu với máy.</p>
    </div>
    ${saved ? `<div class="ctp-resume"><p>Còn một ván đang chơi.</p><button type="button" class="is-hot" data-act="resume">Chơi tiếp</button><button type="button" data-act="discard">Xóa ván</button></div>` : ''}
    <div class="ctp-drafts">${rows}</div>
    <div class="ctp-choices">
      ${draft.length < 4 ? '<button type="button" data-act="add">Thêm người</button>' : ''}
      <button type="button" data-act="shuffle">Bốc thăm</button>
      <button type="button" class="ctp-roll" data-act="start">CHƠI</button>
    </div>
    <p class="ctp-fine">Mỗi người ${coin(START_CASH)}. Vốn qua Bắt đầu ${coin(300)}. Thắng khi đối thủ phá sản, gom 3 bộ màu, trọn một cạnh, hoặc đủ 5 điểm nghỉ.</p>
  </div>`;
}

function view(): string {
  if (!game) return setupHtml();
  const state = game;
  return `<div class="ctp-play">
    <div class="ctp-board-wrap">${boardHtml(state)}</div>
    <div class="ctp-side">
      <div class="ctp-tools"><a href="#/home">Về sảnh</a><button type="button" data-act="again">Ván mới</button></div>
      ${playersHtml(state)}
      ${dock(state)}
      ${lookCard(state)}
      <ol class="ctp-log">${state.log
        .slice(-8)
        .map((line) => `<li>${esc(line)}</li>`)
        .join('')}</ol>
      <details class="ctp-rules">
        <summary>Luật tắt</summary>
        <p>Đổ hai xúc xắc, đi chiều kim đồng hồ. Đôi thì đi tiếp. Đôi ba lần liên tiếp thì vào Côn Đảo.</p>
        <p>Dừng ở thành phố hoặc điểm nghỉ chưa ai mua thì được mua, và xây luôn tới chung cư trong vòng đầu. Qua Bắt đầu mới xây được khách sạn và khu nghỉ.</p>
        <p>Đủ một bộ màu thì phí ghé nhân đôi. Đất vàng và lễ hội cũng nhân đôi, cộng dồn. Thành phố chưa lên khu nghỉ thì người khác có thể mua lại với giá gấp đôi.</p>
        <p>Thắng: người cuối cùng, 3 bộ màu, trọn thành phố một cạnh, đủ 5 điểm nghỉ, hoặc hết ${ROUND_LIMIT} vòng thì ai nhiều của hơn.</p>
      </details>
    </div>
  </div>`;
}

function parkPawn(id: string, tile: number, hop: boolean): void {
  if (!root) return;
  const el = root.querySelector(`[data-pawn="${CSS.escape(id)}"]`);
  const cell = root.querySelector(`.ctp-cell[data-i="${tile}"]`);
  if (!(el instanceof HTMLElement) || !cell) return;
  cell.appendChild(el);
  if (!hop) return;
  el.classList.remove('hop');
  void el.offsetWidth;
  el.classList.add('hop');
}

function placePawns(): void {
  if (!root || !game) return;
  for (const p of game.players) {
    const at = pawnAt?.[p.id] ?? game.pos[p.id] ?? 0;
    parkPawn(p.id, at, false);
  }
}

function movePawn(id: string, tile: number): void {
  if (!pawnAt) pawnAt = {};
  pawnAt[id] = tile;
  parkPawn(id, tile, true);
}

function pathOf(from: number, last: LastMove | null): number[] {
  if (!last) return [];
  if (last.fly || last.jailed) return last.path;
  if (last.from === from) return last.path;
  const head: number[] = [];
  let p = from;
  while (p !== last.from && head.length < BOARD_LEN) {
    p = (p + 1) % BOARD_LEN;
    head.push(p);
  }
  return head.concat(last.path);
}

function paint(): void {
  if (!root) return;
  root.innerHTML = view();
  placePawns();
}

async function runAction(action: CtpAction, my: number): Promise<void> {
  if (!game || game.winnerId || my !== gen) return;
  const mover = game.turn;
  const from = game.pos[mover] ?? 0;
  const animated = action.type === 'roll' || (action.type === 'jail' && action.choice === 'roll');
  if (animated) {
    spinning = true;
    paint();
    await wait(680);
    spinning = false;
    if (!game || my !== gen) return;
  }
  const res = applyCtp(game, action);
  if (my !== gen) return;
  if (!res.ok) {
    paint();
    return;
  }
  const last = res.state.last;
  game = res.state;
  save();
  const steps = pathOf(from, last);
  const hop = !!(last && steps.length);
  if (hop) pawnAt = { ...game.pos, [mover]: from };
  paint();
  if (hop && pawnAt) {
    await wait(20);
    if (my !== gen) return;
    const fly = !!last?.fly;
    for (const step of steps) {
      if (my !== gen) return;
      movePawn(mover, step);
      await wait(fly ? 260 : 115);
    }
    if (my !== gen) return;
    pawnAt = null;
    paint();
  }
}

async function pump(my: number): Promise<void> {
  if (busy || my !== gen) return;
  busy = true;
  try {
    while (game && !game.winnerId && my === gen) {
      const seat = game.players.find((p) => p.id === game!.turn);
      if (!seat?.bot) break;
      await wait(360);
      if (!game || my !== gen) break;
      try {
        await runAction(suggestBot(game), my);
      } catch {
        spinning = false;
        pawnAt = null;
        paint();
      }
    }
  } finally {
    if (my === gen) busy = false;
  }
}

function startGame(): void {
  const seats = draft.map((d, i) => ({
    id: d.id,
    name: d.name.trim() || `Người ${i + 1}`,
    bot: d.bot,
  }));
  if (seats.length < 2) return;
  if (!seats.some((s) => !s.bot)) seats[0]!.bot = false;
  game = createGame(seats, (Date.now() ^ (Math.floor(Math.random() * 1e9))) | 0);
  inspect = null;
  save();
  paint();
  void pump(gen);
}

function onClick(ev: Event): void {
  const t = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-act]');
  if (!t || !root || busy) return;
  const act = t.dataset.act;
  if (act === 'look') {
    const i = Number(t.dataset.i);
    inspect = inspect === i ? null : i;
    paint();
    return;
  }
  if (busy && act !== 'look') return;
  if (act === 'add' && draft.length < 4) {
    const n = draft.length + 1;
    draft = [...draft, { id: `p${Date.now()}`, name: n === 3 ? 'Khách' : 'Khách nữa', bot: true }];
    paint();
    return;
  }
  if (act === 'drop') {
    const i = Number(t.dataset.i);
    if (draft.length <= 2) return;
    draft = draft.filter((_, idx) => idx !== i);
    paint();
    return;
  }
  if (act === 'bot') {
    const i = Number(t.dataset.i);
    const row = draft[i];
    if (!row) return;
    draft = draft.map((d, idx) => (idx === i ? { ...d, bot: !d.bot } : d));
    paint();
    return;
  }
  if (act === 'shuffle') {
    const next = [...draft];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
    }
    draft = next;
    paint();
    return;
  }
  if (act === 'start') {
    startGame();
    return;
  }
  if (act === 'resume') {
    game = load();
    paint();
    void pump(gen);
    return;
  }
  if (act === 'discard') {
    localStorage.removeItem(SAVE_KEY);
    paint();
    return;
  }
  if (act === 'again') {
    if (game && !game.winnerId && !window.confirm('Xóa ván đang chơi?')) return;
    game = null;
    pawnAt = null;
    inspect = null;
    save();
    paint();
    return;
  }
  if (!game) return;
  let action: CtpAction | null = null;
  if (act === 'roll') action = { type: 'roll' };
  else if (act === 'skip') action = { type: 'skip' };
  else if (act === 'buy') action = { type: 'buy', level: Number(t.dataset.level) };
  else if (act === 'up') action = { type: 'upgrade', tileId: Number(t.dataset.i), toLevel: Number(t.dataset.to) };
  else if (act === 'buyout') action = { type: 'buyout' };
  else if (act === 'fest') action = { type: 'festival', tileId: Number(t.dataset.i) };
  else if (act === 'fest-skip') action = { type: 'festival', tileId: null };
  else if (act === 'bus') action = { type: 'bus', take: t.dataset.take === '1' };
  else if (act === 'bet') action = { type: 'game', color: t.dataset.color === 'den' ? 'den' : 'do', stake: Number(t.dataset.stake) };
  else if (act === 'fly' || act === 'go') action = { type: 'travel', tileId: Number(t.dataset.i) };
  else if (act === 'jail') {
    const choice = t.dataset.choice;
    if (choice === 'pay' || choice === 'card' || choice === 'roll') action = { type: 'jail', choice };
  } else if (act === 'sell') action = { type: 'sell', tileId: Number(t.dataset.i) };
  else if (act === 'settle') action = { type: 'settle' };
  else if (act === 'bust') action = { type: 'bust' };
  if (!action) return;
  const my = gen;
  busy = true;
  void runAction(action, my)
    .catch(() => {
      spinning = false;
      pawnAt = null;
      paint();
    })
    .finally(() => {
      if (my !== gen) return;
      busy = false;
      void pump(my);
    });
}

function onInput(ev: Event): void {
  const el = ev.target as HTMLInputElement | null;
  if (!el || el.dataset.name == null) return;
  const i = Number(el.dataset.name);
  const row = draft[i];
  if (!row) return;
  draft = draft.map((d, idx) => (idx === i ? { ...d, name: el.value } : d));
}

export function titleTyphu(): { chip: string; fun: string } {
  return { chip: 'BÀN CỜ', fun: 'CỜ TỶ PHÚ' };
}

export function renderTyphu(): string {
  return `<main class="hn-main ctp-root" data-typhu-root></main>`;
}

export function bindTyphu(scope: HTMLElement): void {
  const el = scope.querySelector('[data-typhu-root]');
  if (!(el instanceof HTMLElement)) return;
  gen += 1;
  const my = gen;
  busy = false;
  spinning = false;
  pawnAt = null;
  root = el;
  if (!game) game = load();
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  paint();
  void pump(my);
  window.addEventListener('resize', () => {
    if (my !== gen || busy) return;
    placePawns();
  });
}
