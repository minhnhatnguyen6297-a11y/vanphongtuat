import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { closeDb } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { EMPTY_GRACE_MS, IDLE_EXPIRE_MS, setRoomPresence, sweepRooms } from '../../src/server/rooms.ts';
import { setupTestDb, makeMember } from './helpers.ts';

function op(name: string, args: Record<string, unknown>) {
  return { opId: randomUUID(), name, args };
}

describe('game rooms expire', () => {
  let db: ReturnType<typeof setupTestDb>;
  let chu: ReturnType<typeof makeMember>;
  let dan: ReturnType<typeof makeMember>;

  beforeEach(() => {
    db = setupTestDb();
    chu = makeMember(db, { username: 'chu', pin: '111111', tier: 'chu_xi' });
    dan = makeMember(db, { username: 'dan', pin: '222222', tier: 'dan_den' });
    setRoomPresence(() => new Set());
  });

  afterEach(() => {
    setRoomPresence(() => new Set());
    closeDb();
  });

  it('an open room with someone present is kept, and an empty one waits 60s', () => {
    const created = dispatchCommand(db, chu.member, op('game.create', { kind: 'caro', title: 'C' }));
    assert.equal(created.ok, true);
    const id = (created as { result: { id: string } }).result.id;
    const now = Date.now();
    assert.deepEqual(sweepRooms(db, now, new Set([chu.id])), []);
    const row = db.prepare(`SELECT empty_since FROM game_rooms WHERE id = ?`).get(id) as {
      empty_since: string | null;
    };
    assert.equal(row.empty_since, null);

    assert.deepEqual(sweepRooms(db, now, new Set()), []);
    const marked = db.prepare(`SELECT empty_since FROM game_rooms WHERE id = ?`).get(id) as {
      empty_since: string;
    };
    assert.ok(marked.empty_since);
    assert.deepEqual(sweepRooms(db, now + EMPTY_GRACE_MS + 1000, new Set()), [id]);
    assert.equal(db.prepare(`SELECT id FROM game_rooms WHERE id = ?`).get(id), undefined);
  });

  it('a playing room survives disconnect and expires after 30 minutes without a move', () => {
    const created = dispatchCommand(db, chu.member, op('game.create', { kind: 'caro', title: 'P' }));
    const id = (created as { result: { id: string } }).result.id;
    assert.equal(dispatchCommand(db, dan.member, op('game.join', { roomId: id, as: 'play' })).ok, true);
    assert.equal(dispatchCommand(db, chu.member, op('game.start', { roomId: id })).ok, true);
    const now = Date.now();
    assert.deepEqual(sweepRooms(db, now + EMPTY_GRACE_MS + 5000, new Set()), []);

    const old = new Date(now - IDLE_EXPIRE_MS - 1000).toISOString();
    db.prepare(`UPDATE game_rooms SET last_play_at = ? WHERE id = ?`).run(old, id);
    assert.deepEqual(sweepRooms(db, now, new Set([chu.id, dan.id])), [id]);
  });

  it('an expired room cannot be joined', () => {
    const created = dispatchCommand(db, chu.member, op('game.create', { kind: 'caro', title: 'E' }));
    const id = (created as { result: { id: string } }).result.id;
    const old = new Date(Date.now() - IDLE_EXPIRE_MS - 1000).toISOString();
    db.prepare(`UPDATE game_rooms SET last_play_at = ? WHERE id = ?`).run(old, id);
    const join = dispatchCommand(db, dan.member, op('game.join', { roomId: id, as: 'play' }));
    assert.equal(join.ok, false);
    assert.equal((join as { error: string }).error, 'expired');
  });
});
