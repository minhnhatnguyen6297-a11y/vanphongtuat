import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { setupTestDb, makeMember, makeShop } from './helpers.ts';
import { config } from '../../src/server/config.ts';

describe('ops idempotency & conflict', () => {
  let db: ReturnType<typeof setupTestDb>;
  let host: ReturnType<typeof makeMember>;
  let other: ReturnType<typeof makeMember>;

  beforeEach(() => {
    db = setupTestDb();
    host = makeMember(db, { username: 'host', pin: '111111', isOperator: true });
    other = makeMember(db, { username: 'other', pin: '222222' });
    makeShop(db, 'shop1', 'Quán A', host.id);
    makeShop(db, 'shop2', 'Quán B', host.id);
  });

  afterEach(() => closeDb());

  it('cùng opId hai lần → một ghi và ack giống nhau', () => {
    const opId = crypto.randomUUID();
    const a1 = dispatchCommand(db, host.member, {
      opId,
      name: 'table.create',
      args: { shopIds: ['shop1', 'shop2'] },
    });
    assert.equal(a1.ok, true);
    const count1 = (db.prepare('SELECT COUNT(*) AS c FROM tables').get() as { c: number }).c;
    assert.equal(count1, 1);

    const a2 = dispatchCommand(db, host.member, {
      opId,
      name: 'table.create',
      args: { shopIds: ['shop1', 'shop2'] },
    });
    assert.deepEqual(a2, a1);
    const count2 = (db.prepare('SELECT COUNT(*) AS c FROM tables').get() as { c: number }).c;
    assert.equal(count2, 1);

    const ops = (db.prepare('SELECT COUNT(*) AS c FROM ops WHERE op_id = ?').get(opId) as {
      c: number;
    }).c;
    assert.equal(ops, 1);
  });

  it('order.update lệch baseVersion → conflict', () => {
    dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1'] },
    });
    const add = dispatchCommand(db, other.member, {
      opId: crypto.randomUUID(),
      name: 'order.add',
      args: { text: 'Cơm sườn', price: 45000 },
    });
    assert.equal(add.ok, true);
    const orderId = (add as { result: { id: string } }).result.id;

    // host sửa trước
    const u1 = dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'order.update',
      args: { id: orderId, text: 'Cơm sườn (ít cay)', price: 45000 },
      baseVersion: 1,
    });
    assert.equal(u1.ok, true);

    // other còn baseVersion cũ
    const u2 = dispatchCommand(db, other.member, {
      opId: crypto.randomUUID(),
      name: 'order.update',
      args: { id: orderId, text: 'Cơm sườn khác', price: 50000 },
      baseVersion: 1,
    });
    assert.equal(u2.ok, false);
    assert.equal((u2 as { error: string }).error, 'conflict');
    assert.ok('current' in u2);
  });

  it('wheel.spin khi đang quay → spinning', () => {
    // shorten duration for clarity — still uses config
    const prev = config.spinDurationMs;
    (config as { spinDurationMs: number }).spinDurationMs = 5000;

    dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.create',
      args: { title: 'Free' },
    });
    const wheels = db.prepare(`SELECT id FROM wheels WHERE kind='free'`).all() as { id: string }[];
    const wid = wheels[0].id;
    dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.item.add',
      args: { wheelId: wid, name: 'A' },
    });
    dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.item.add',
      args: { wheelId: wid, name: 'B' },
    });

    const s1 = dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.spin',
      args: { wheelId: wid },
    });
    assert.equal(s1.ok, true);

    const s2 = dispatchCommand(db, other.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.spin',
      args: { wheelId: wid },
    });
    assert.equal(s2.ok, false);
    assert.equal((s2 as { error: string }).error, 'spinning');

    (config as { spinDurationMs: number }).spinDurationMs = prev;
  });

  it('table.setWinner với spinId sai → bad_spin', () => {
    dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1', 'shop2'] },
    });

    const bad = dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'table.setWinner',
      args: { shopId: 'shop1', spinId: crypto.randomUUID() },
    });
    assert.equal(bad.ok, false);
    assert.equal((bad as { error: string }).error, 'bad_spin');

    // không kèm spinId vẫn chốt được
    const ok = dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'table.setWinner',
      args: { shopId: 'shop1' },
    });
    assert.equal(ok.ok, true);
  });

  it('setWinner với spin đúng kết quả → ok', async () => {
    const prev = config.spinDurationMs;
    (config as { spinDurationMs: number }).spinDurationMs = 1;

    dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1', 'shop2'] },
    });
    const tableId = (
      db.prepare('SELECT id FROM tables ORDER BY id DESC LIMIT 1').get() as { id: number }
    ).id;
    const wheel = db
      .prepare(`SELECT id FROM wheels WHERE table_id = ? AND kind = 'shop'`)
      .get(tableId) as { id: string };

    const spin = dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.spin',
      args: { wheelId: wheel.id },
    });
    assert.equal(spin.ok, true);
    const result = (spin as { result: { spinId: string; resultIndex: number; items: any[] } })
      .result;
    const shopId = result.items[result.resultIndex].refShopId as string;

    await new Promise((r) => setTimeout(r, 10));

    const win = dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'table.setWinner',
      args: { shopId, spinId: result.spinId },
    });
    assert.equal(win.ok, true);

    const wrongShop = shopId === 'shop1' ? 'shop2' : 'shop1';
    const bad = dispatchCommand(db, host.member, {
      opId: crypto.randomUUID(),
      name: 'table.setWinner',
      args: { shopId: wrongShop, spinId: result.spinId },
    });
    assert.equal(bad.ok, false);
    assert.equal((bad as { error: string }).error, 'bad_spin');

    (config as { spinDurationMs: number }).spinDurationMs = prev;
  });
});
