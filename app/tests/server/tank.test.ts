import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { closeDb } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { loadTankFish, _resetFishLimits } from '../../src/server/commands/fish.ts';
import { setupTestDb, makeMember } from './helpers.ts';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function op(name: string, args: Record<string, unknown>) {
  return { opId: randomUUID(), name, args };
}

describe('shared tank', () => {
  let db: ReturnType<typeof setupTestDb>;
  let chu: ReturnType<typeof makeMember>;
  let dan: ReturnType<typeof makeMember>;

  beforeEach(() => {
    db = setupTestDb();
    _resetFishLimits();
    chu = makeMember(db, { username: 'chu', pin: '111111', tier: 'chu_xi' });
    dan = makeMember(db, { username: 'dan', pin: '222222', tier: 'dan_den' });
  });

  afterEach(() => closeDb());

  it('stores a real png and lets only the owner or admin remove it', () => {
    const released = dispatchCommand(db, dan.member, op('fish.release', { png: PNG }));
    assert.equal(released.ok, true);
    const id = (released as { result: { id: string } }).result.id;
    const fish = loadTankFish(db);
    assert.equal(fish.length, 1);
    assert.equal(fish[0]?.ownerId, dan.id);
    assert.ok(fish[0]?.png.startsWith('data:image/png;base64,'));

    const slow = dispatchCommand(db, dan.member, op('fish.release', { png: PNG }));
    assert.equal(slow.ok, false);
    assert.equal((slow as { error: string }).error, 'slow_down');

    const stranger = makeMember(db, { username: 'khach', pin: '333333', tier: 'no_le' });
    const denied = dispatchCommand(db, stranger.member, op('fish.remove', { id }));
    assert.equal(denied.ok, false);
    assert.equal((denied as { error: string }).error, 'forbidden');

    const removed = dispatchCommand(db, chu.member, op('fish.remove', { id }));
    assert.equal(removed.ok, true);
    assert.equal(loadTankFish(db).length, 0);
  });

  it('rejects a file that is not a png', () => {
    const bad = dispatchCommand(db, dan.member, op('fish.release', { png: 'a'.repeat(40) }));
    assert.equal(bad.ok, false);
    assert.equal((bad as { error: string }).error, 'bad_png');
  });

  it('keeps one fish when the same local id is retried, even with a new op', () => {
    const first = dispatchCommand(db, dan.member, op('fish.release', { png: PNG, localId: 'localA' }));
    const second = dispatchCommand(db, dan.member, op('fish.release', { png: PNG, localId: 'localA' }));
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal((first as { result: { id: string } }).result.id, (second as { result: { id: string } }).result.id);
    assert.equal(loadTankFish(db).length, 1);

    const other = dispatchCommand(db, chu.member, op('fish.release', { png: PNG, localId: 'localA' }));
    assert.equal(other.ok, true);
    assert.notEqual((other as { result: { id: string } }).result.id, (first as { result: { id: string } }).result.id);
    assert.equal(loadTankFish(db).length, 2);
  });

  it('still stores a second fish when the drawing is new and has no local id', () => {
    _resetFishLimits();
    const a = dispatchCommand(db, dan.member, op('fish.release', { png: PNG }));
    _resetFishLimits();
    const b = dispatchCommand(db, dan.member, op('fish.release', { png: PNG }));
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.notEqual((a as { result: { id: string } }).result.id, (b as { result: { id: string } }).result.id);
    assert.equal(loadTankFish(db).length, 2);
  });
});
