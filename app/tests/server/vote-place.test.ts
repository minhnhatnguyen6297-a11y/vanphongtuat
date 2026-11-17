import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { setupTestDb, makeMember, makeShop } from './helpers.ts';

describe('vote.place gộp thêm quán và phiếu', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => closeDb());

  function counts(tableId: number, shopId: string) {
    const shops = db
      .prepare('SELECT COUNT(*) AS c FROM table_shops WHERE table_id = ? AND shop_id = ?')
      .get(tableId, shopId) as { c: number };
    const votes = db
      .prepare('SELECT COUNT(*) AS c FROM votes WHERE table_id = ? AND shop_id = ?')
      .get(tableId, shopId) as { c: number };
    return { shops: shops.c, votes: votes.c };
  }

  it('dân đen thêm quán và ghi phiếu trong một lệnh', () => {
    const dan = makeMember(db, { username: 'dan', displayName: 'Dân', tier: 'dan_den' });
    makeShop(db, 'shop1', 'Cafe Mood', dan.id);
    makeShop(db, 'shop2', 'Phở Bò', dan.id);
    const created = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1'] },
    });
    assert.equal(created.ok, true);
    const tableId = (created as { result: { tableId: number } }).result.tableId;

    const placed = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'vote.place',
      args: { shopId: 'shop2' },
    });
    assert.equal(placed.ok, true);
    assert.equal((placed as { result: { added: boolean } }).result.added, true);
    assert.deepEqual(counts(tableId, 'shop2'), { shops: 1, votes: 1 });

    const wheel = db
      .prepare(`SELECT id FROM wheels WHERE table_id = ? AND kind = 'shop'`)
      .get(tableId) as { id: string };
    const names = db
      .prepare('SELECT name FROM wheel_items WHERE wheel_id = ?')
      .all(wheel.id) as { name: string }[];
    assert.ok(names.some((row) => row.name === 'Phở Bò'));

    const again = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'vote.place',
      args: { shopId: 'shop2' },
    });
    assert.equal(again.ok, true);
    assert.equal((again as { result: { added: boolean } }).result.added, false);
    assert.deepEqual(counts(tableId, 'shop2'), { shops: 1, votes: 1 });
  });

  it('nô lệ không có table.addShop thì không còn phiếu mồ côi', () => {
    const dan = makeMember(db, { username: 'dan', displayName: 'Dân', tier: 'dan_den' });
    const nole = makeMember(db, { username: 'nole', displayName: 'Nô', tier: 'no_le' });
    makeShop(db, 'shop1', 'Cafe Mood', dan.id);
    makeShop(db, 'shop2', 'Phở Bò', dan.id);
    const created = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1'] },
    });
    const tableId = (created as { result: { tableId: number } }).result.tableId;

    const denied = dispatchCommand(db, nole.member, {
      opId: crypto.randomUUID(),
      name: 'vote.place',
      args: { shopId: 'shop2' },
    });
    assert.equal(denied.ok, false);
    assert.equal((denied as { error: string }).error, 'forbidden');
    assert.deepEqual(counts(tableId, 'shop2'), { shops: 0, votes: 0 });
    const anyVote = db
      .prepare('SELECT COUNT(*) AS c FROM votes WHERE table_id = ? AND member_id = ?')
      .get(tableId, nole.id) as { c: number };
    assert.equal(anyVote.c, 0);
  });

  it('nô lệ vẫn chọn được quán đã có trên bàn', () => {
    const dan = makeMember(db, { username: 'dan', displayName: 'Dân', tier: 'dan_den' });
    const nole = makeMember(db, { username: 'nole', displayName: 'Nô', tier: 'no_le' });
    makeShop(db, 'shop1', 'Cafe Mood', dan.id);
    const created = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1'] },
    });
    const tableId = (created as { result: { tableId: number } }).result.tableId;

    const placed = dispatchCommand(db, nole.member, {
      opId: crypto.randomUUID(),
      name: 'vote.place',
      args: { shopId: 'shop1' },
    });
    assert.equal(placed.ok, true);
    assert.equal((placed as { result: { added: boolean } }).result.added, false);
    assert.deepEqual(counts(tableId, 'shop1'), { shops: 1, votes: 1 });
  });
});
