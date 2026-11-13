import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb, nowIso, newId } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { hasPerm, applyMatrixRows, setMemberTier } from '../../src/server/perms.ts';
import { setupTestDb, makeMember, makeShop } from './helpers.ts';
import { DEFAULT_MATRIX, PERM_KEYS, type PermKey, type Tier } from '../../src/shared/perms-catalog.ts';

describe('perms matrix + hasPerm', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => closeDb());

  it('chu_xi có perm.manage; dan_den không table.setBill; no_le không wheel.spin', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });
    const nole = makeMember(db, { username: 'nole', tier: 'no_le' });

    assert.equal(hasPerm(db, chu.id, 'perm.manage'), true);
    assert.equal(hasPerm(db, dan.id, 'table.setBill'), false);
    assert.equal(hasPerm(db, nole.id, 'wheel.spin'), false);
    assert.equal(hasPerm(db, dan.id, 'vote'), true);
    assert.equal(hasPerm(db, nole.id, 'order'), true);
  });

  it('grant tạm hết hạn → hasPerm false; còn hạn → true', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });
    assert.equal(hasPerm(db, dan.id, 'table.setBill'), false);

    const past = new Date(Date.now() - 60_000).toISOString();
    db.prepare(
      `INSERT INTO perm_grants(id, member_id, perm_key, granted_by, expires_at, created_at)
       VALUES(?,?,?,?,?,?)`,
    ).run(newId(), dan.id, 'table.setBill', chu.id, past, nowIso());
    assert.equal(hasPerm(db, dan.id, 'table.setBill'), false);

    const future = new Date(Date.now() + 60_000).toISOString();
    db.prepare(
      `INSERT INTO perm_grants(id, member_id, perm_key, granted_by, expires_at, created_at)
       VALUES(?,?,?,?,?,?)`,
    ).run(newId(), dan.id, 'wheel.spin', chu.id, future, nowIso());
    // dan_den already has wheel.spin by default; use setWinner
    db.prepare(`DELETE FROM perm_grants`).run();
    db.prepare(
      `INSERT INTO perm_grants(id, member_id, perm_key, granted_by, expires_at, created_at)
       VALUES(?,?,?,?,?,?)`,
    ).run(newId(), dan.id, 'table.setWinner', chu.id, future, nowIso());
    assert.equal(hasPerm(db, dan.id, 'table.setWinner'), true);
  });

  it('anti-escalation: không grant/request/approve/setMatrix NO_GRANT perms', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });

    for (const key of ['perm.manage', 'perm.approve', 'member.admin'] as PermKey[]) {
      const req = dispatchCommand(db, dan.member, {
        opId: crypto.randomUUID(),
        name: 'perm.request',
        args: { permKey: key },
      });
      assert.equal(req.ok, false);
      assert.equal((req as { error: string }).error, 'forbidden');

      const matrix = dispatchCommand(db, chu.member, {
        opId: crypto.randomUUID(),
        name: 'perm.setMatrix',
        args: { entries: [{ tier: 'dan_den', permKey: key, allowed: true }] },
      });
      assert.equal(matrix.ok, false);
      assert.equal((matrix as { error: string }).error, 'forbidden');
    }

    // inject pending then approve still forbidden path via isNoGrantPerm
    const id = newId();
    db.prepare(
      `INSERT INTO perm_requests(id, member_id, perm_key, status, created_at)
       VALUES(?,?,?, 'pending', ?)`,
    ).run(id, dan.id, 'perm.manage', nowIso());
    const ap = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'perm.approve',
      args: { requestId: id },
    });
    assert.equal(ap.ok, false);
    assert.equal((ap as { error: string }).error, 'forbidden');
  });

  it('dan_den không table.setBill qua assertCommandAllowed', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });
    makeShop(db, 'shop1', 'A', chu.id);
    dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1'] },
    });
    const bill = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'table.setBill',
      args: { total: 100000, mode: 'equal' },
    });
    assert.equal(bill.ok, false);
    assert.equal((bill as { error: string }).error, 'forbidden');
  });

  it('no_le không wheel.spin', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    const nole = makeMember(db, { username: 'nole', tier: 'no_le' });
    makeShop(db, 'shop1', 'A', chu.id);
    dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1'] },
    });
    const wid = (
      db.prepare(`SELECT id FROM wheels WHERE kind='shop' LIMIT 1`).get() as { id: string }
    ).id;
    const spin = dispatchCommand(db, nole.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.spin',
      args: { wheelId: wid },
    });
    assert.equal(spin.ok, false);
    assert.equal((spin as { error: string }).error, 'forbidden');
  });
});

describe('perm commands + invariants', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => closeDb());

  it('setMatrix từ chối nếu trống setWinner hoặc setBill', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    const entries = (['chu_xi', 'pho_xi', 'dan_den', 'no_le'] as Tier[]).flatMap((tier) =>
      (['table.setWinner', 'table.setBill'] as PermKey[]).map((permKey) => ({
        tier,
        permKey,
        allowed: false,
      })),
    );
    const ack = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'perm.setMatrix',
      args: { entries },
    });
    assert.equal(ack.ok, false);
    assert.equal((ack as { error: string }).error, 'matrix_invariant');
  });

  it('pho_xi không promote chu_xi; không demote Chủ', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    const pho = makeMember(db, { username: 'pho', tier: 'pho_xi' });
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });

    const promote = dispatchCommand(db, pho.member, {
      opId: crypto.randomUUID(),
      name: 'perm.setTier',
      args: { memberId: dan.id, tier: 'chu_xi' },
    });
    assert.equal(promote.ok, false);
    assert.equal((promote as { error: string }).error, 'forbidden');

    // pho has perm.manage? No — so setTier itself is forbidden
    assert.equal(hasPerm(db, pho.id, 'perm.manage'), false);

    // Even direct setMemberTier with pho actor
    assert.throws(
      () => setMemberTier(db, pho.member, dan.id, 'chu_xi'),
      (e: any) => e.code === 'forbidden',
    );
    assert.throws(
      () => setMemberTier(db, pho.member, chu.id, 'dan_den'),
      (e: any) => e.code === 'forbidden',
    );
  });

  it('không demote Chủ xị cuối', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    const demote = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'perm.setTier',
      args: { memberId: chu.id, tier: 'dan_den' },
    });
    assert.equal(demote.ok, false);
    assert.equal((demote as { error: string }).error, 'last_chu_xi');
  });

  it('pho_xi không disable chu_xi dù có member.admin', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    const pho = makeMember(db, { username: 'pho', tier: 'pho_xi' });
    assert.equal(hasPerm(db, pho.id, 'member.admin'), true);
    const dis = dispatchCommand(db, pho.member, {
      opId: crypto.randomUUID(),
      name: 'admin.disable',
      args: { memberId: chu.id, disabled: true },
    });
    assert.equal(dis.ok, false);
    assert.equal((dis as { error: string }).error, 'forbidden');
  });

  it('perm.request + approve tạo grant 24h; setTier ok với ≥2 chu_xi', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    const chu2 = makeMember(db, { username: 'chu2', tier: 'chu_xi' });
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });
    const pho = makeMember(db, { username: 'pho', tier: 'pho_xi' });

    const req = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'perm.request',
      args: { permKey: 'table.setBill' },
    });
    assert.equal(req.ok, true);
    const requestId = (req as { result: { id: string } }).result.id;

    const ap = dispatchCommand(db, pho.member, {
      opId: crypto.randomUUID(),
      name: 'perm.approve',
      args: { requestId },
    });
    assert.equal(ap.ok, true);
    assert.equal(hasPerm(db, dan.id, 'table.setBill'), true);

    const demote = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'perm.setTier',
      args: { memberId: chu2.id, tier: 'dan_den' },
    });
    assert.equal(demote.ok, true);
  });

  it('admin.setOperator đồng bộ tier chu_xi / dan_den', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    makeMember(db, { username: 'chu2', tier: 'chu_xi' });
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });

    const up = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'admin.setOperator',
      args: { memberId: dan.id, isOperator: true },
    });
    assert.equal(up.ok, true);
    const t1 = db.prepare(`SELECT tier, is_operator FROM members WHERE id = ?`).get(dan.id) as {
      tier: string;
      is_operator: number;
    };
    assert.equal(t1.tier, 'chu_xi');
    assert.equal(t1.is_operator, 1);

    const down = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'admin.setOperator',
      args: { memberId: dan.id, isOperator: false },
    });
    assert.equal(down.ok, true);
    const t2 = db.prepare(`SELECT tier, is_operator FROM members WHERE id = ?`).get(dan.id) as {
      tier: string;
      is_operator: number;
    };
    assert.equal(t2.tier, 'dan_den');
    assert.equal(t2.is_operator, 0);
  });

  it('table.setResidualHost cần table.setBill; host_id đổi', () => {
    const chu = makeMember(db, { username: 'chu', tier: 'chu_xi' });
    const dan = makeMember(db, { username: 'dan', tier: 'dan_den' });
    makeShop(db, 'shop1', 'A', chu.id);
    dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1'] },
    });
    const forbidden = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'table.setResidualHost',
      args: { memberId: dan.id },
    });
    assert.equal(forbidden.ok, false);

    const ok = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'table.setResidualHost',
      args: { memberId: dan.id },
    });
    assert.equal(ok.ok, true);
    const host = db.prepare(`SELECT host_id FROM tables ORDER BY id DESC LIMIT 1`).get() as {
      host_id: string;
    };
    assert.equal(host.host_id, dan.id);
  });

  it('default matrix khớp catalog', () => {
    for (const tier of ['chu_xi', 'pho_xi', 'dan_den', 'no_le'] as Tier[]) {
      for (const key of PERM_KEYS) {
        const row = db
          .prepare(`SELECT allowed FROM role_permissions WHERE tier = ? AND perm_key = ?`)
          .get(tier, key) as { allowed: number };
        assert.equal(!!row.allowed, DEFAULT_MATRIX[tier].has(key), `${tier}.${key}`);
      }
    }
  });

  it('applyMatrixRows giữ NO_GRANT theo default', () => {
    makeMember(db, { username: 'chu', tier: 'chu_xi' });
    applyMatrixRows(db, [
      { tier: 'dan_den', permKey: 'table.setWinner', allowed: true },
      { tier: 'dan_den', permKey: 'wheel.spin', allowed: false },
    ]);
    const manage = db
      .prepare(`SELECT allowed FROM role_permissions WHERE tier='chu_xi' AND perm_key='perm.manage'`)
      .get() as { allowed: number };
    assert.equal(manage.allowed, 1);
    const phoManage = db
      .prepare(`SELECT allowed FROM role_permissions WHERE tier='pho_xi' AND perm_key='perm.manage'`)
      .get() as { allowed: number };
    assert.equal(phoManage.allowed, 0);
  });
});
