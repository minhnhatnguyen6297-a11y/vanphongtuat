import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD,
  BOARD_LEN,
  GO_SALARY,
  JAIL_FINE,
  JAIL_INDEX,
  RESORT_IDS,
  ROWS,
  ROUND_LIMIT,
  START_CASH,
  applyCtp,
  buyoutPrice,
  createGame,
  netWorth,
  rentDue,
  suggestBot,
  type CtpState,
} from '../../src/shared/co-ty-phu.ts';

const A = { id: 'a', name: 'An', bot: false };
const B = { id: 'b', name: 'Bình', bot: true };

function game(seed = 1): CtpState {
  return createGame([A, B], seed);
}

describe('cờ tỷ phú — bàn và xúc xắc', () => {
  it('bàn 32 ô, đủ nhóm màu và 5 điểm nghỉ', () => {
    assert.equal(BOARD.length, BOARD_LEN);
    assert.equal(BOARD.filter((t) => t.kind === 'city').length, 18);
    assert.equal(RESORT_IDS.length, 5);
    assert.equal(BOARD.filter((t) => t.kind === 'chance').length, 3);
    assert.deepEqual(
      BOARD.map((t) => t.id),
      BOARD.map((_, i) => i),
    );
    const corners = [0, 8, 16, 24].map((i) => BOARD[i]!.kind);
    assert.deepEqual(corners, ['start', 'jail', 'festival', 'bus']);
  });

  it('từ chối xúc xắc lẻ, đi đúng số ô', () => {
    const bad = applyCtp(game(), { type: 'roll', dice: [0, 1] });
    assert.equal(bad.ok, false);
    const bad2 = applyCtp(game(), { type: 'roll', dice: [1, 7] });
    assert.equal(bad2.ok, false);
    const ok = applyCtp(game(), { type: 'roll', dice: [1, 3] });
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    assert.equal(ok.state.pos.a, 4);
    assert.deepEqual(ok.state.dice, [1, 3]);
    assert.equal(ok.state.decision?.kind, 'buy');
    assert.equal(ok.state.turn, 'a');
    const skipped = applyCtp(ok.state, { type: 'skip' });
    assert.equal(skipped.ok, true);
    if (!skipped.ok) return;
    assert.equal(skipped.state.turn, 'b');
  });

  it('đôi được đi tiếp; đôi lần ba vào Côn Đảo không đi', () => {
    let s = game();
    let r = applyCtp(s, { type: 'roll', dice: [1, 1] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.pos.a, 2);
    assert.equal(r.state.turn, 'a');
    assert.equal(r.state.decision?.kind, 'buy');
    r = applyCtp(r.state, { type: 'skip' });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.turn, 'a');
    assert.equal(r.state.decision, null);

    r = applyCtp(r.state, { type: 'roll', dice: [2, 2] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.pos.a, 6);
    r = applyCtp(r.state, { type: 'skip' });
    assert.equal(r.ok, true);
    if (!r.ok) return;

    r = applyCtp(r.state, { type: 'roll', dice: [3, 3] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.pos.a, JAIL_INDEX);
    assert.equal(r.state.jailed.a, 3);
    assert.equal(r.state.turn, 'b');
    assert.equal(r.state.last?.jailed, true);
  });

  it('qua Bắt đầu được lương và mở khóa khách sạn', () => {
    const s = game();
    s.pos.a = 30;
    const r = applyCtp(s, { type: 'roll', dice: [1, 2] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.pos.a, 1);
    assert.equal(r.state.laps.a, 1);
    assert.equal(r.state.cash.a, START_CASH + GO_SALARY);
  });
});

describe('cờ tỷ phú — mua, thuê, xây', () => {
  it('mua đất và xây tới trần vòng đầu', () => {
    let r = applyCtp(game(), { type: 'roll', dice: [1, 1] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const tooHigh = applyCtp(r.state, { type: 'buy', level: 3 });
    assert.equal(tooHigh.ok, false);
    r = applyCtp(r.state, { type: 'buy', level: 2 });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const tile = BOARD[2]!;
    assert.equal(r.state.owned['2'], 'a');
    assert.equal(r.state.level['2'], 2);
    assert.equal(r.state.cash.a, START_CASH - tile.price - tile.build[0]! - tile.build[1]!);
  });

  it('thuê nhân bộ màu, lễ hội, đất vàng', () => {
    const s = game();
    s.owned = { '1': 'a', '2': 'a' };
    s.level = { '1': 0, '2': 1 };
    s.festivalOn = 2;
    s.gold = [2];
    s.pos = { a: 0, b: 0 };
    s.turn = 'b';
    s.cash = { a: 500, b: 500 };
    const bare = rentDue(s, 2, 'b');
    const base = BOARD[2]!.rent[1]!;
    assert.equal(bare, base * 2 * 2 * 2);
    const paid = applyCtp(s, { type: 'roll', dice: [1, 1] });
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.state.cash.b, 500 - bare);
    assert.equal(paid.state.cash.a, 500 + bare);
    assert.equal(paid.state.decision?.kind, 'buyout');
  });

  it('không mua lại khu nghỉ hay thành phố đã có khu nghỉ', () => {
    const s = game();
    s.owned = { '4': 'a', '2': 'a' };
    s.level = { '2': 4, '4': 1 };
    s.laps = { a: 2, b: 2 };
    assert.equal(buyoutPrice(s, 2), null);
    assert.equal(buyoutPrice(s, 4), null);
    s.pos.b = 0;
    s.turn = 'b';
    s.cash = { a: 100, b: 5000 };
    const r = applyCtp(s, { type: 'roll', dice: [2, 2] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.pos.b, 4);
    assert.notEqual(r.state.decision?.kind, 'buyout');
  });

  it('đủ bộ một cạnh thì thắng', () => {
    const s = game();
    const row = ROWS[0]!;
    for (const id of row) {
      if (id === 7) continue;
      s.owned[String(id)] = 'a';
    }
    s.pos.a = 5;
    s.cash.a = 5000;
    const r = applyCtp(s, { type: 'roll', dice: [1, 1] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.pos.a, 7);
    const bought = applyCtp(r.state, { type: 'buy', level: 0 });
    assert.equal(bought.ok, true);
    if (!bought.ok) return;
    assert.equal(bought.state.winnerId, 'a');
    assert.equal(bought.state.winReason, 'row');
  });

  it('3 bộ màu thì thắng', () => {
    const s = game();
    for (const id of [1, 2, 5, 6, 7, 9]) s.owned[String(id)] = 'a';
    s.pos.a = 8;
    s.cash.a = 5000;
    const r = applyCtp(s, { type: 'roll', dice: [1, 1] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const bought = applyCtp(r.state, { type: 'buy', level: 0 });
    assert.equal(bought.ok, true);
    if (!bought.ok) return;
    assert.equal(bought.state.winnerId, 'a');
    assert.equal(bought.state.winReason, 'sets');
  });

  it('đủ 5 điểm nghỉ thì thắng', () => {
    const s = game();
    for (const id of RESORT_IDS) {
      if (id === 4) continue;
      s.owned[String(id)] = 'a';
    }
    s.pos.a = 0;
    s.cash.a = 5000;
    const r = applyCtp(s, { type: 'roll', dice: [1, 3] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.pos.a, 4);
    const bought = applyCtp(r.state, { type: 'buy', level: 0 });
    assert.equal(bought.ok, true);
    if (!bought.ok) return;
    assert.equal(bought.state.winnerId, 'a');
    assert.equal(bought.state.winReason, 'resorts');
  });
});

describe('cờ tỷ phú — phá sản, đảo, hết vòng', () => {
  it('không đủ thuê thì bán nhà rồi trả', () => {
    const s = game();
    s.owned = { '1': 'a', '2': 'b' };
    s.level = { '1': 2, '2': 2 };
    s.pos = { a: 0, b: 6 };
    s.turn = 'a';
    s.cash = { a: 10, b: 0 };
    s.gold = [];
    const due = rentDue(s, 2, 'a');
    assert.ok(due > 10);
    const landed = applyCtp(s, { type: 'roll', dice: [1, 1] });
    assert.equal(landed.ok, true);
    if (!landed.ok) return;
    assert.equal(landed.state.decision?.kind, 'short');
    let cur = landed.state;
    let guard = 0;
    while (cur.decision?.kind === 'short' && (cur.cash.a || 0) < due && guard < 6) {
      const sell = applyCtp(cur, { type: 'sell', tileId: 1 });
      assert.equal(sell.ok, true);
      if (!sell.ok) return;
      cur = sell.state;
      guard += 1;
    }
    assert.ok((cur.cash.a || 0) >= due);
    const settled = applyCtp(cur, { type: 'settle' });
    assert.equal(settled.ok, true);
    if (!settled.ok) return;
    assert.equal(settled.state.bankrupt.includes('a'), false);
    assert.equal(settled.state.cash.b, due);
  });

  it('hết tài sản thì phá sản, người kia thắng', () => {
    const s = game();
    s.owned = { '28': 'b' };
    s.level = { '28': 4 };
    s.laps = { a: 2, b: 2 };
    s.pos = { a: 26, b: 0 };
    s.turn = 'a';
    s.cash = { a: 5, b: 100 };
    s.gold = [];
    const landed = applyCtp(s, { type: 'roll', dice: [1, 1] });
    assert.equal(landed.ok, true);
    if (!landed.ok) return;
    assert.equal(landed.state.decision?.kind, 'short');
    const dead = applyCtp(landed.state, { type: 'bust' });
    assert.equal(dead.ok, true);
    if (!dead.ok) return;
    assert.ok(dead.state.bankrupt.includes('a'));
    assert.equal(dead.state.winnerId, 'b');
    assert.equal(dead.state.winReason, 'bankrupt');
    assert.equal(dead.state.cash.b, 105);
    assert.equal(applyCtp(dead.state, { type: 'roll' }).ok, false);
  });

  it('Côn Đảo: trượt đôi thì ở lại, đôi thì ra và đi', () => {
    const s = game();
    s.jailed = { a: 3, b: 0 };
    s.pos = { a: JAIL_INDEX, b: 0 };
    const stay = applyCtp(s, { type: 'jail', choice: 'roll', dice: [1, 2] });
    assert.equal(stay.ok, true);
    if (!stay.ok) return;
    assert.equal(stay.state.jailed.a, 2);
    assert.equal(stay.state.pos.a, JAIL_INDEX);
    assert.equal(stay.state.turn, 'b');

    const s2 = game();
    s2.jailed = { a: 2, b: 0 };
    s2.pos = { a: JAIL_INDEX, b: 0 };
    const out = applyCtp(s2, { type: 'jail', choice: 'roll', dice: [3, 3] });
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.state.jailed.a, 0);
    assert.equal(out.state.pos.a, (JAIL_INDEX + 6) % BOARD_LEN);
    assert.equal(out.state.turn, 'a');
  });

  it('hết 3 lượt đảo thì nộp phạt rồi đi', () => {
    const s = game();
    s.jailed = { a: 1, b: 0 };
    s.pos = { a: JAIL_INDEX, b: 0 };
    s.cash = { a: START_CASH, b: START_CASH };
    const r = applyCtp(s, { type: 'jail', choice: 'roll', dice: [1, 2] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.jailed.a, 0);
    assert.equal(r.state.pos.a, JAIL_INDEX + 3);
    assert.equal(r.state.cash.a, START_CASH - JAIL_FINE);
  });

  it('hết 30 vòng thì người nhiều của hơn thắng', () => {
    const s = game();
    s.round = ROUND_LIMIT - 1;
    s.turn = 'b';
    s.pos = { a: 0, b: 30 };
    s.cash = { a: 4000, b: 100 };
    s.owned = { '1': 'b' };
    s.level = { '1': 4 };
    s.laps = { a: 2, b: 2 };
    const r = applyCtp(s, { type: 'roll', dice: [1, 2] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.winnerId, 'a');
    assert.equal(r.state.winReason, 'rounds');
    assert.ok(netWorth(r.state, 'a') >= netWorth(r.state, 'b'));
  });
});

describe('cờ tỷ phú — ô đặc biệt và bot', () => {
  it('thuế bằng 10% giá trị đất đã xây', () => {
    const s = game();
    s.owned = { '1': 'a' };
    s.level = { '1': 1 };
    s.pos.a = 21;
    s.turn = 'a';
    const tile = BOARD[1]!;
    const expectTax = Math.floor((tile.price + tile.build[0]!) * 0.1);
    const before = s.cash.a;
    const r = applyCtp(s, { type: 'roll', dice: [1, 1] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.pos.a, 23);
    assert.equal(r.state.cash.a, before - expectTax);
  });

  it('bến xe: lượt sau chọn ô, có đi qua lương', () => {
    let s = game();
    s.pos = { a: 21, b: 1 };
    s.owned = { '4': 'b' };
    s.level = { '4': 2 };
    const arm = applyCtp(s, { type: 'roll', dice: [1, 2] });
    assert.equal(arm.ok, true);
    if (!arm.ok) return;
    assert.equal(arm.state.pos.a, 24);
    assert.equal(arm.state.decision?.kind, 'bus');
    const took = applyCtp(arm.state, { type: 'bus', take: true });
    assert.equal(took.ok, true);
    if (!took.ok) return;
    assert.equal(took.state.travel.a, true);
    assert.equal(took.state.turn, 'b');
    const b = applyCtp(took.state, { type: 'roll', dice: [1, 2] });
    assert.equal(b.ok, true);
    if (!b.ok) return;
    s = b.state;
    assert.equal(s.turn, 'a');
    const before = s.cash.a;
    const ride = applyCtp(s, { type: 'travel', tileId: 2 });
    assert.equal(ride.ok, true);
    if (!ride.ok) return;
    assert.equal(ride.state.pos.a, 2);
    assert.equal(ride.state.laps.a, 1);
    assert.equal(ride.state.cash.a, before + GO_SALARY);
    assert.equal(ride.state.travel.a, false);
  });

  it('thẻ cơ hội đưa vào đảo', () => {
    const s = game();
    s.deck = ['goJail'];
    s.deckI = 0;
    s.pos.a = 1;
    const r = applyCtp(s, { type: 'roll', dice: [1, 1] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.pos.a, JAIL_INDEX);
    assert.equal(r.state.jailed.a, 3);
    assert.equal(r.state.turn, 'b');
  });

  it('bot chơi được nhiều lượt mà không đánh sai', () => {
    let s = createGame(
      [
        { id: 'a', name: 'Bạn', bot: false },
        { id: 'b', name: 'Nhà cái', bot: true },
      ],
      7,
    );
    for (let i = 0; i < 80 && !s.winnerId; i++) {
      const action = suggestBot(s);
      const r = applyCtp(s, action);
      assert.equal(r.ok, true, `lượt ${i} ${s.turn} ${action.type}`);
      if (!r.ok) return;
      s = r.state;
      for (const p of s.players) {
        assert.ok((s.cash[p.id] ?? 0) >= 0);
        assert.ok((s.pos[p.id] ?? 0) >= 0 && (s.pos[p.id] ?? 0) < BOARD_LEN);
      }
    }
    assert.ok(s.log.length > 0);
  });
});
