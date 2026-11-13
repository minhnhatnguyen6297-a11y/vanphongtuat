import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { closeDb } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { setupTestDb, makeMember } from './helpers.ts';

function op(name: string, args: Record<string, unknown>) {
  return { opId: randomUUID(), name, args };
}

describe('game caro 5a', () => {
  let db: ReturnType<typeof setupTestDb>;
  let chu: ReturnType<typeof makeMember>;
  let dan: ReturnType<typeof makeMember>;
  let nole: ReturnType<typeof makeMember>;
  let dan2: ReturnType<typeof makeMember>;

  beforeEach(() => {
    db = setupTestDb();
    chu = makeMember(db, { username: 'chu', pin: '111111', tier: 'chu_xi' });
    dan = makeMember(db, { username: 'dan', pin: '222222', tier: 'dan_den' });
    dan2 = makeMember(db, { username: 'dan2', pin: '333333', tier: 'dan_den' });
    nole = makeMember(db, { username: 'nole', pin: '444444', tier: 'no_le' });
  });

  afterEach(() => closeDb());

  it('no_le spectate OK; ¬play; host create cần game.host', () => {
    const createDan = dispatchCommand(db, dan.member, op('game.create', { kind: 'caro', title: 'C1' }));
    assert.equal(createDan.ok, false);
    assert.equal((createDan as { error: string }).error, 'forbidden');

    const create = dispatchCommand(db, chu.member, op('game.create', { kind: 'caro', title: 'C1' }));
    assert.equal(create.ok, true);
    const roomId = (create as { result: { id: string } }).result.id;

    const playNole = dispatchCommand(
      db,
      nole.member,
      op('game.join', { roomId, as: 'play' }),
    );
    assert.equal(playNole.ok, false);
    assert.equal((playNole as { error: string }).error, 'forbidden');

    const specNole = dispatchCommand(
      db,
      nole.member,
      op('game.join', { roomId, as: 'spectate' }),
    );
    assert.equal(specNole.ok, true);

    const seat = db
      .prepare(`SELECT seat FROM game_members WHERE room_id = ? AND member_id = ?`)
      .get(roomId, nole.id) as { seat: string };
    assert.equal(seat.seat, 'spectator');
  });

  it('caro: host đi nước; thắng 5; nước bất hợp lệ bị từ chối', () => {
    const create = dispatchCommand(db, chu.member, op('game.create', { kind: 'caro', title: 'Win' }));
    const roomId = (create as { result: { id: string } }).result.id;

    assert.equal(
      dispatchCommand(db, dan.member, op('game.join', { roomId, as: 'play' })).ok,
      true,
    );
    assert.equal(
      dispatchCommand(db, dan2.member, op('game.join', { roomId, as: 'play' })).ok,
      false,
    ); // caro max 2 players (host + 1)

    const start = dispatchCommand(db, chu.member, op('game.start', { roomId }));
    assert.equal(start.ok, true);

    // spectator cannot move
    dispatchCommand(db, nole.member, op('game.join', { roomId, as: 'spectate' }));
    const specMove = dispatchCommand(
      db,
      nole.member,
      op('game.move', { roomId, row: 7, col: 7 }),
    );
    assert.equal(specMove.ok, false);

    // host (chu) goes first
    const m0 = dispatchCommand(db, chu.member, op('game.move', { roomId, row: 7, col: 7 }));
    assert.equal(m0.ok, true);
    const afterFirst = (m0 as { result: { state: { lastMove: { row: number; col: number } | null } } })
      .result.state;
    assert.deepEqual(afterFirst.lastMove, { row: 7, col: 7 });

    // occupied / out of turn
    const occ = dispatchCommand(db, dan.member, op('game.move', { roomId, row: 7, col: 7 }));
    assert.equal(occ.ok, false);
    assert.equal((occ as { error: string }).error, 'illegal_move');

    const wrongTurn = dispatchCommand(db, chu.member, op('game.move', { roomId, row: 0, col: 0 }));
    assert.equal(wrongTurn.ok, false);

    // Build horizontal win for chu on row 7: chu at 7,7 already; alternate
    // chu: 7,7  7,8  7,9  7,10  7,11
    // dan blocks elsewhere
    const plays: Array<[string, number, number]> = [
      [dan.id, 0, 0],
      [chu.id, 7, 8],
      [dan.id, 0, 1],
      [chu.id, 7, 9],
      [dan.id, 0, 2],
      [chu.id, 7, 10],
      [dan.id, 0, 3],
      [chu.id, 7, 11],
    ];
    for (const [mid, r, c] of plays) {
      const member = mid === chu.id ? chu.member : dan.member;
      const ack = dispatchCommand(db, member, op('game.move', { roomId, row: r, col: c }));
      assert.equal(ack.ok, true, `move ${r},${c}`);
    }

    const room = db.prepare(`SELECT status, state_json FROM game_rooms WHERE id = ?`).get(roomId) as {
      status: string;
      state_json: string;
    };
    assert.equal(room.status, 'ended');
    const state = JSON.parse(room.state_json) as { winnerId: string | null };
    assert.equal(state.winnerId, chu.id);

    const afterEnd = dispatchCommand(db, dan.member, op('game.move', { roomId, row: 1, col: 1 }));
    assert.equal(afterEnd.ok, false);
  });

  it('leave khi đang chơi giữ ghế; join lại không thành spectator', () => {
    const create = dispatchCommand(db, chu.member, op('game.create', { kind: 'caro', title: 'Rejoin' }));
    const roomId = (create as { result: { id: string } }).result.id;
    assert.equal(dispatchCommand(db, dan.member, op('game.join', { roomId, as: 'play' })).ok, true);
    assert.equal(dispatchCommand(db, chu.member, op('game.start', { roomId })).ok, true);

    const leave = dispatchCommand(db, dan.member, op('game.leave', { roomId }));
    assert.equal(leave.ok, true);
    assert.equal((leave as { result: { seatKept?: boolean } }).result.seatKept, true);

    const seat = db
      .prepare(`SELECT seat FROM game_members WHERE room_id = ? AND member_id = ?`)
      .get(roomId, dan.id) as { seat: string };
    assert.equal(seat.seat, 'player');

    const rejoin = dispatchCommand(db, dan.member, op('game.join', { roomId, as: 'play' }));
    assert.equal(rejoin.ok, true);
    assert.equal((rejoin as { result: { seat: string } }).result.seat, 'player');
  });
});
