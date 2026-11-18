import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { snapWheels } from '../../src/server/snapshots.ts';
import { setupTestDb, makeMember, makeShop } from './helpers.ts';

function names(n: number, prefix = 'Ô') {
  return Array.from({ length: n }, (_, i) => ({ name: `${prefix} ${i + 1}`, weight: 20 }));
}

describe('wheel.item.addMany và quyền lệnh vòng', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => closeDb());

  function wheelId(memberId: string) {
    const created = dispatchCommand(db, member(memberId), {
      opId: crypto.randomUUID(),
      name: 'wheel.create',
      args: { title: 'Danh sách' },
    });
    assert.equal(created.ok, true);
    return (created as { result: { id: string } }).result.id;
  }

  function member(id: string) {
    const row = db.prepare('SELECT id, username, display_name, is_operator, tier FROM members WHERE id = ?').get(id) as {
      id: string;
      username: string;
      display_name: string;
      is_operator: number;
      tier: 'chu_xi' | 'pho_xi' | 'dan_den' | 'no_le';
    };
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      isOperator: row.is_operator === 1,
      tier: row.tier,
      avatarId: null,
      disabled: false,
    };
  }

  it('lô ghi một lần, vượt trần thì không thêm ô nào', () => {
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });
    const wid = wheelId(dan.id);
    const first = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.item.addMany',
      args: { wheelId: wid, items: names(58) },
      baseVersion: 1,
    });
    assert.equal(first.ok, true);
    assert.equal((first as { result: { count: number } }).result.count, 58);

    const overflow = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.item.addMany',
      args: { wheelId: wid, items: names(3, 'Thừa') },
      baseVersion: (first as { result: { version: number } }).result.version,
    });
    assert.equal(overflow.ok, false);
    assert.equal((overflow as { error: string }).error, 'too_many_items');
    const mid = db.prepare('SELECT COUNT(*) AS c FROM wheel_items WHERE wheel_id = ?').get(wid) as { c: number };
    assert.equal(mid.c, 58);

    const fit = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.item.addMany',
      args: { wheelId: wid, items: names(2, 'Vừa') },
      baseVersion: (first as { result: { version: number } }).result.version,
    });
    assert.equal(fit.ok, true);
    const full = db.prepare('SELECT COUNT(*) AS c FROM wheel_items WHERE wheel_id = ?').get(wid) as { c: number };
    assert.equal(full.c, 60);

    const oneMore = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.item.add',
      args: { wheelId: wid, name: 'Ô 61' },
      baseVersion: (fit as { result: { version: number } }).result.version,
    });
    assert.equal(oneMore.ok, false);
    assert.equal((oneMore as { error: string }).error, 'too_many_items');
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS c FROM wheel_items WHERE wheel_id = ?').get(wid) as { c: number }).c,
      60,
    );
  });

  it('61 tên trong một lệnh bị từ chối trước khi ghi', () => {
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });
    const wid = wheelId(dan.id);
    const bad = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.item.addMany',
      args: { wheelId: wid, items: names(61) },
    });
    assert.equal(bad.ok, false);
    assert.equal((bad as { error: string }).error, 'invalid_args');
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS c FROM wheel_items WHERE wheel_id = ?').get(wid) as { c: number }).c,
      0,
    );
  });

  it('lệch baseVersion không ghi lô', () => {
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });
    const wid = wheelId(dan.id);
    const bad = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.item.addMany',
      args: { wheelId: wid, items: names(2) },
      baseVersion: 9,
    });
    assert.equal(bad.ok, false);
    assert.equal((bad as { error: string }).error, 'conflict');
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS c FROM wheel_items WHERE wheel_id = ?').get(wid) as { c: number }).c,
      0,
    );
  });

  it('no_le không thêm lô, không chia đều, không theo vote, không chốt, không ghi người lấy', () => {
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });
    const nole = makeMember(db, { username: 'nole', tier: 'no_le' });
    makeShop(db, 'shop1', 'Quán A', dan.id);
    makeShop(db, 'shop2', 'Quán B', dan.id);
    const wid = wheelId(dan.id);
    dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.item.add',
      args: { wheelId: wid, name: 'A' },
      baseVersion: 1,
    });

    const batch = dispatchCommand(db, nole.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.item.addMany',
      args: { wheelId: wid, items: names(2) },
    });
    assert.equal(batch.ok, false);
    assert.equal((batch as { error: string }).error, 'forbidden');

    const equal = dispatchCommand(db, nole.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.equalize',
      args: { wheelId: wid },
    });
    assert.equal(equal.ok, false);
    assert.equal((equal as { error: string }).error, 'forbidden');

    dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1', 'shop2'] },
    });
    const shopWheel = db.prepare(`SELECT id FROM wheels WHERE kind = 'shop' LIMIT 1`).get() as { id: string };
    const byVote = dispatchCommand(db, nole.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.byVote',
      args: { wheelId: shopWheel.id },
    });
    assert.equal(byVote.ok, false);
    assert.equal((byVote as { error: string }).error, 'forbidden');

    const winner = dispatchCommand(db, nole.member, {
      opId: crypto.randomUUID(),
      name: 'table.setWinner',
      args: { shopId: 'shop1' },
    });
    assert.equal(winner.ok, false);
    assert.equal((winner as { error: string }).error, 'forbidden');

    const pickup = dispatchCommand(db, nole.member, {
      opId: crypto.randomUUID(),
      name: 'table.setPickup',
      args: { memberId: dan.id, spinId: crypto.randomUUID() },
    });
    assert.equal(pickup.ok, false);
    assert.equal((pickup as { error: string }).error, 'forbidden');

    assert.equal(
      (db.prepare('SELECT COUNT(*) AS c FROM wheel_items WHERE wheel_id = ?').get(wid) as { c: number }).c,
      1,
    );
  });

  it('dan_den vẫn chia đều và theo vote; snapshot trả người quay và tên trúng', () => {
    const dan = makeMember(db, { username: 'dan', displayName: 'Đan', tier: 'dan_den' });
    makeShop(db, 'shop1', 'Quán A', dan.id);
    makeShop(db, 'shop2', 'Quán B', dan.id);
    const menu = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'shop.setMenu',
      args: {
        shopId: 'shop1',
        items: [
          { name: 'Cà phê', price: 20000 },
          { name: 'Bạc xỉu', price: 25000 },
        ],
      },
    });
    assert.equal(menu.ok, true);

    const wid = wheelId(dan.id);
    const added = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.item.addMany',
      args: {
        wheelId: wid,
        items: [
          { name: 'Cà phê', weight: 20 },
          { name: 'Bạc xỉu', weight: 20 },
        ],
      },
      baseVersion: 1,
    });
    assert.equal(added.ok, true);

    const equal = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.equalize',
      args: { wheelId: wid },
      baseVersion: (added as { result: { version: number } }).result.version,
    });
    assert.equal(equal.ok, true);
    const weights = db.prepare('SELECT weight FROM wheel_items WHERE wheel_id = ?').all(wid) as { weight: number }[];
    assert.deepEqual(weights.map((w) => w.weight), [20, 20]);

    dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1', 'shop2'] },
    });
    const shopWheel = db.prepare(`SELECT id, version FROM wheels WHERE kind = 'shop' LIMIT 1`).get() as {
      id: string;
      version: number;
    };
    const byVote = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.byVote',
      args: { wheelId: shopWheel.id },
      baseVersion: shopWheel.version,
    });
    assert.equal(byVote.ok, true);

    const spin = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.spin',
      args: { wheelId: wid },
    });
    assert.equal(spin.ok, true);
    const result = (spin as { result: { resultName: string } }).result;
    const snap = snapWheels(db);
    const row = (snap.data as Array<{ id: string; recentSpins: Array<{ byMember: string; resultName: string }> }>).find(
      (w) => w.id === wid,
    );
    assert.ok(row);
    assert.equal(row!.recentSpins[0]!.byMember, dan.id);
    assert.equal(row!.recentSpins[0]!.resultName, result.resultName);
  });
});
