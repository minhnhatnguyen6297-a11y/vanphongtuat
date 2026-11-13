import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { setupTestDb, makeMember, makeShop } from './helpers.ts';

describe('shop.delete / wheel.delete', () => {
  let db: ReturnType<typeof setupTestDb>;
  let chu: ReturnType<typeof makeMember>;
  let dan: ReturnType<typeof makeMember>;

  beforeEach(() => {
    db = setupTestDb();
    chu = makeMember(db, { username: 'chu', pin: '111111', tier: 'chu_xi' });
    dan = makeMember(db, { username: 'dan', pin: '222222', tier: 'dan_den' });
    makeShop(db, 'shop1', 'Quán A', chu.id);
    makeShop(db, 'shop2', 'Quán B', chu.id);
  });

  afterEach(() => closeDb());

  it('shop.delete ok khi không tham chiếu; cascade khi trên bàn', () => {
    const free = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'shop.delete',
      args: { id: 'shop2' },
    });
    assert.equal(free.ok, true);

    dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1'] },
    });
    const ok = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'shop.delete',
      args: { id: 'shop1' },
    });
    assert.equal(ok.ok, true);
    const gone = db.prepare('SELECT 1 AS ok FROM shops WHERE id = ?').get('shop1');
    assert.equal(gone, undefined);
    const stillOnTable = db
      .prepare('SELECT 1 AS ok FROM table_shops WHERE shop_id = ?')
      .get('shop1');
    assert.equal(stillOnTable, undefined);
  });

  it('dan_den không shop.delete / wheel.delete', () => {
    const sd = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'shop.delete',
      args: { id: 'shop1' },
    });
    assert.equal(sd.ok, false);
    assert.equal((sd as { error: string }).error, 'forbidden');

    const w = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.create',
      args: { title: 'Free' },
    });
    const wid = (w as { result: { id: string } }).result.id;
    const wd = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.delete',
      args: { id: wid },
    });
    assert.equal(wd.ok, false);
    assert.equal((wd as { error: string }).error, 'forbidden');
  });

  it('wheel.delete free ok; vòng gắn bàn cũng xóa được', () => {
    dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1', 'shop2'] },
    });
    const tableWheel = db
      .prepare(`SELECT id FROM wheels WHERE kind = 'shop' LIMIT 1`)
      .get() as { id: string };
    const deleted = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.delete',
      args: { id: tableWheel.id },
    });
    assert.equal(deleted.ok, true);

    const free = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.create',
      args: { title: 'Xóa được' },
    });
    const wid = (free as { result: { id: string } }).result.id;
    const ok = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.delete',
      args: { id: wid },
    });
    assert.equal(ok.ok, true);
  });
});
