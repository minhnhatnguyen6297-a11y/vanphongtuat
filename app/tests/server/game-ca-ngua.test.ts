import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { closeDb } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { setupTestDb, makeMember } from './helpers.ts';
import {
  applyCaNguaMove,
  emptyCaNgua,
  legalPieceIndexes,
  type CaNguaState,
} from '../../src/shared/game-ca-ngua.ts';

function op(name: string, args: Record<string, unknown>) {
  return { opId: randomUUID(), name, args };
}

describe('game ca_ngua 5b', () => {
  let db: ReturnType<typeof setupTestDb>;
  let chu: ReturnType<typeof makeMember>;
  let dan: ReturnType<typeof makeMember>;

  beforeEach(() => {
    db = setupTestDb();
    chu = makeMember(db, { username: 'chu', pin: '111111', tier: 'chu_xi' });
    dan = makeMember(db, { username: 'dan', pin: '222222', tier: 'dan_den' });
  });

  afterEach(() => closeDb());

  it('engine: ra chuồng cần 6; nước hợp lệ; thắng khi 4 quân về', () => {
    const state = emptyCaNgua([chu.id, dan.id]);
    // dice 5 — không ra chuồng (synthetic)
    const with5: CaNguaState = { ...state, dice: 5, rolled: true };
    assert.equal(legalPieceIndexes(with5, chu.id).length, 0);

    let r = applyCaNguaMove(state, chu.id, { action: 'roll', dice: 6 });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const legal6 = legalPieceIndexes(r.state, chu.id);
    assert.ok(legal6.length >= 1);

    r = applyCaNguaMove(r.state, chu.id, { action: 'move', pieceId: legal6[0]! });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.pieces[chu.id]![legal6[0]!], 0);

    // Force win: set 3 finished + one on home stretch needing exact
    const winState: CaNguaState = {
      ...r.state,
      turnId: chu.id,
      dice: 1,
      rolled: true,
      pieces: {
        [chu.id]: [56, 56, 56, 55],
        [dan.id]: [-1, -1, -1, -1],
      },
      finishedCount: { [chu.id]: 3, [dan.id]: 0 },
    };
    const win = applyCaNguaMove(winState, chu.id, { action: 'move', pieceId: 3 });
    assert.equal(win.ok, true);
    if (!win.ok) return;
    assert.equal(win.state.winnerId, chu.id);
    assert.equal(win.ended, true);
  });

  it('commands: create/start/roll/move ca_ngua', () => {
    const create = dispatchCommand(
      db,
      chu.member,
      op('game.create', { kind: 'ca_ngua', title: 'Ngựa' }),
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
    const st = (roll as { result: { state: CaNguaState } }).result.state;
    // xúc xắc server: giữ dice nếu còn nước (thường là 6); không thì hết lượt
    if (st.turnId === chu.id) {
      assert.ok(st.rolled && st.dice != null && st.dice >= 1 && st.dice <= 6);
    } else {
      assert.equal(st.turnId, dan.id);
      assert.equal(st.rolled, false);
    }

    // người không tới lượt không roll được
    const notTurn = st.turnId === chu.id ? dan.member : chu.member;
    const bad = dispatchCommand(db, notTurn, op('game.move', { roomId, action: 'roll' }));
    assert.equal(bad.ok, false);
  });
});
