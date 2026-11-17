import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb } from '../../src/server/db.ts';
import { login, registerMember } from '../../src/server/auth.ts';
import { setupTestDb, makeMember } from './helpers.ts';

describe('self register', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    db = setupTestDb();
    makeMember(db, { username: 'minh', pin: '654321', tier: 'chu_xi' });
  });

  afterEach(() => closeDb());

  it('assigns the lowest tier and ignores any wish to be admin', () => {
    const res = registerMember(db, 'Lan_Moi', 'Lan mới', '135790', '10.1.0.8');
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.member.tier, 'no_le');
    assert.equal(res.member.isOperator, false);
    const row = db.prepare(`SELECT tier, is_operator FROM members WHERE username = 'lan_moi'`).get() as {
      tier: string;
      is_operator: number;
    };
    assert.equal(row.tier, 'no_le');
    assert.equal(row.is_operator, 0);
    const again = login(db, 'lan_moi', '135790', '10.1.0.9');
    assert.equal(again.ok, true);
  });

  it('rejects a duplicate username', () => {
    const res = registerMember(db, 'minh', 'Người khác', '135790', '10.1.0.10');
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error, 'username_taken');
  });

  it('rejects a short pin', () => {
    const res = registerMember(db, 'lan2', 'Lan', '1234', '10.1.0.11');
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error, 'bad_pin');
  });
});
