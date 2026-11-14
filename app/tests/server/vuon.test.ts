import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { closeDb } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { saigonDateString } from '../../src/shared/vuon.ts';
import { setupTestDb, makeMember } from './helpers.ts';

function op(name: string, args: Record<string, unknown>, opId = randomUUID()) {
  return { opId, name, args };
}

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

describe('vuon.care', () => {
  let db: ReturnType<typeof setupTestDb>;
  let minh: ReturnType<typeof makeMember>;
  let lan: ReturnType<typeof makeMember>;

  beforeEach(() => {
    db = setupTestDb();
    minh = makeMember(db, { username: 'minh', tier: 'chu_xi' });
    lan = makeMember(db, { username: 'lan', tier: 'dan_den' });
  });

  afterEach(() => closeDb());

  it('cho ăn một lần trong ngày, lần hai không tăng, opId lặp trả cùng kết quả', () => {
    const id = randomUUID();
    const first = dispatchCommand(db, minh.member, op('vuon.care', { speciesId: 'meo' }, id));
    assert.equal(first.ok, true);
    const result = (first as { result: { careDays: number; counted: boolean; stage: string } }).result;
    assert.equal(result.careDays, 1);
    assert.equal(result.counted, true);
    assert.equal(result.stage, 'non');

    const retry = dispatchCommand(db, minh.member, op('vuon.care', { speciesId: 'meo' }, id));
    assert.deepEqual((retry as { result: unknown }).result, result);

    const second = dispatchCommand(db, minh.member, op('vuon.care', { speciesId: 'meo' }));
    assert.equal(second.ok, true);
    const again = (second as { result: { careDays: number; counted: boolean } }).result;
    assert.equal(again.counted, false);
    assert.equal(again.careDays, 1);
  });

  it('không lùi cấp và đúng ngưỡng khi đã có ngày chăm', () => {
    const today = saigonDateString(new Date());
    const yesterday = shift(today, -1);
    db.prepare(
      `INSERT INTO garden_care(member_id, species_id, care_days, last_care_on) VALUES(?,?,?,?)`,
    ).run(minh.id, 'sen', 6, yesterday);
    const grown = dispatchCommand(db, minh.member, op('vuon.care', { speciesId: 'sen' }));
    const g = (grown as { result: { careDays: number; stage: string } }).result;
    assert.equal(g.careDays, 7);
    assert.equal(g.stage, 'truong_thanh');

    db.prepare(`UPDATE garden_care SET care_days = 20, last_care_on = ? WHERE species_id = 'sen'`).run(
      yesterday,
    );
    const myth = dispatchCommand(db, minh.member, op('vuon.care', { speciesId: 'sen' }));
    const m = (myth as { result: { careDays: number; stage: string } }).result;
    assert.equal(m.careDays, 21);
    assert.equal(m.stage, 'than_thoai');

    const stay = dispatchCommand(db, minh.member, op('vuon.care', { speciesId: 'sen' }));
    const s = (stay as { result: { careDays: number; counted: boolean; stage: string } }).result;
    assert.equal(s.counted, false);
    assert.equal(s.careDays, 21);
    assert.equal(s.stage, 'than_thoai');
  });

  it('không cho ăn thú của người khác, tưới cây của họ thì tính vào vườn họ', () => {
    const feed = dispatchCommand(
      db,
      lan.member,
      op('vuon.care', { speciesId: 'meo', ownerId: minh.id }),
    );
    assert.equal(feed.ok, false);
    assert.equal((feed as { error: string }).error, 'forbidden');

    const water = dispatchCommand(
      db,
      lan.member,
      op('vuon.care', { speciesId: 'sen', ownerId: minh.id }),
    );
    assert.equal(water.ok, true);
    const row = db
      .prepare(`SELECT care_days AS careDays, member_id AS memberId FROM garden_care WHERE species_id = 'sen'`)
      .get() as { careDays: number; memberId: string };
    assert.equal(row.memberId, minh.id);
    assert.equal(row.careDays, 1);
    const lanRow = db
      .prepare(`SELECT COUNT(*) AS c FROM garden_care WHERE member_id = ?`)
      .get(lan.id) as { c: number };
    assert.equal(lanRow.c, 0);
  });

  it('loài lạ bị từ chối', () => {
    const bad = dispatchCommand(db, minh.member, op('vuon.care', { speciesId: 'rong-lua' }));
    assert.equal(bad.ok, false);
    assert.equal((bad as { error: string }).error, 'not_found');
  });
});
