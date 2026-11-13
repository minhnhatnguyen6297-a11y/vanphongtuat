import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { closeDb } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { setupTestDb, makeMember } from './helpers.ts';
import {
  applyTiPhuMove,
  emptyTiPhu,
  TI_PHU_BOARD,
  type TiPhuState,
} from '../../src/shared/game-ti-phu.ts';

function op(name: string, args: Record<string, unknown>) {
  return { opId: randomUUID(), name, args };
}

describe('game ti_phu 5c', () => {
  let db: ReturnType<typeof setupTestDb>;
  let chu: ReturnType<typeof makeMember>;
  let dan: ReturnType<typeof makeMember>;

  beforeEach(() => {
    db = setupTestDb();
    chu = makeMember(db, { username: 'chu', pin: '111111', tier: 'chu_xi' });
    dan = makeMember(db, { username: 'dan', pin: '222222', tier: 'dan_den' });
  });

  afterEach(() => closeDb());

  it('engine: roll/mua; phá sản → end', () => {
    let state = emptyTiPhu([chu.id, dan.id]);
    // roll 1+0 invalid — need 1-6
    let bad = applyTiPhuMove(state, chu.id, { action: 'roll', dice: [0, 1] });
    assert.equal(bad.ok, false);

    // land on tile 1 (prop) with dice 1+0 → use 1,1 → steps 2 → tile 2 tax? from 0 + 1+1 = 2 tax
    // want prop: tile 1 with dice [1,0] invalid. Use [1,0] no. [1] — use [1,0] no.
    // from 0, dice [1,0] invalid. dice [1,1] → pos 2 tax.
    // dice to land tile 1: need steps 1 → can't with 2d6 min 2.
    // Start chu already at 1 synthetically
    state = {
      ...emptyTiPhu([chu.id, dan.id]),
      positions: { [chu.id]: 0, [dan.id]: 0 },
    };
    let r = applyTiPhuMove(state, chu.id, { action: 'roll', dice: [1, 2] });
    // 0+3 = tile 3 prop Phòng họp nhỏ
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.positions[chu.id], 3);
    assert.equal(r.state.pendingBuy, 3);

    r = applyTiPhuMove(r.state, chu.id, { action: 'buy' });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.owned['3'], chu.id);
    assert.equal(r.state.turnId, dan.id);

    // bankrupt path: dan has 0 cash, lands on chu property
    const broke: TiPhuState = {
      ...r.state,
      turnId: dan.id,
      rolled: false,
      pendingBuy: null,
      dice: null,
      cash: { [chu.id]: 1000, [dan.id]: 5 },
      positions: { [chu.id]: 3, [dan.id]: 0 },
      owned: { '3': chu.id },
    };
    // land on 3: need steps 3 → dice [1,2]
    const end = applyTiPhuMove(broke, dan.id, { action: 'roll', dice: [1, 2] });
    assert.equal(end.ok, true);
    if (!end.ok) return;
    assert.ok(end.state.bankrupt.includes(dan.id));
    assert.equal(end.state.winnerId, chu.id);
    assert.equal(end.ended, true);
    assert.ok(TI_PHU_BOARD.length >= 12);
  });

  it('commands: create/start/roll ti_phu', () => {
    const create = dispatchCommand(
      db,
      chu.member,
      op('game.create', { kind: 'ti_phu', title: 'VP' }),
    );
    assert.equal(create.ok, true);
    const roomId = (create as { result: { id: string } }).result.id;
    assert.equal(dispatchCommand(db, dan.member, op('game.join', { roomId, as: 'play' })).ok, true);
    assert.equal(dispatchCommand(db, chu.member, op('game.start', { roomId })).ok, true);

    const roll = dispatchCommand(
      db,
      chu.member,
      op('game.move', { roomId, action: 'roll' }),
    );
    assert.equal(roll.ok, true);
    const st = (roll as { result: { state: TiPhuState } }).result.state;
    assert.ok(typeof st.positions[chu.id] === 'number');
    // còn pending mua thì còn dice; không thì đã hết lượt
    if (st.pendingBuy != null) {
      assert.ok(st.dice && st.dice[0] >= 1 && st.dice[1] >= 1);
      const buy = dispatchCommand(db, chu.member, op('game.move', { roomId, action: 'buy' }));
      assert.equal(buy.ok, true);
    } else {
      assert.equal(st.turnId, dan.id);
    }
  });
});
