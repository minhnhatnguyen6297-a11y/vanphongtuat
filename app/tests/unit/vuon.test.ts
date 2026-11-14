import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VUON_ART_IDS,
  VUON_GROWTH,
  VUON_SPECIES,
  applyDailyCare,
  isNight,
  seasonFromDate,
  speciesOf,
  stageFromCareDays,
} from '../../src/shared/vuon.ts';

describe('vườn — cấp', () => {
  it('ngưỡng nằm một chỗ', () => {
    assert.equal(VUON_GROWTH.truongThanhDays, 7);
    assert.equal(VUON_GROWTH.thanThoaiDays, 21);
  });

  it('0 và 6 là Non, 7 và 20 là Trưởng thành, 21 trở lên là Thần thoại', () => {
    assert.equal(stageFromCareDays(0), 'non');
    assert.equal(stageFromCareDays(6), 'non');
    assert.equal(stageFromCareDays(7), 'truong_thanh');
    assert.equal(stageFromCareDays(20), 'truong_thanh');
    assert.equal(stageFromCareDays(21), 'than_thoai');
    assert.equal(stageFromCareDays(100), 'than_thoai');
  });
});

describe('vườn — một lần một ngày, không lùi', () => {
  it('ngày đầu được tính, cùng ngày thì không tăng', () => {
    const first = applyDailyCare({ careDays: 0, lastCareOn: null }, '2026-05-02');
    assert.equal(first.counted, true);
    assert.equal(first.careDays, 1);
    assert.equal(first.stage, 'non');
    const again = applyDailyCare(first, '2026-05-02');
    assert.equal(again.counted, false);
    assert.equal(again.careDays, 1);
  });

  it('ngày hôm sau tăng đúng một, không bao giờ giảm', () => {
    for (const days of [0, 1, 6, 7, 20, 21, 100]) {
      const same = applyDailyCare({ careDays: days, lastCareOn: '2026-05-01' }, '2026-05-01');
      assert.equal(same.careDays, days);
      assert.equal(same.counted, false);
      const next = applyDailyCare({ careDays: days, lastCareOn: '2026-05-01' }, '2026-05-02');
      assert.equal(next.careDays, days + 1);
      assert.ok(next.careDays > days);
    }
  });

  it('số âm bị kéo về 0 rồi mới tính, không đi xuống', () => {
    const same = applyDailyCare({ careDays: -3, lastCareOn: '2026-05-01' }, '2026-05-01');
    assert.equal(same.careDays, 0);
    const next = applyDailyCare({ careDays: -3, lastCareOn: '2026-04-01' }, '2026-05-01');
    assert.equal(next.careDays, 1);
  });

  it('không sửa object đầu vào', () => {
    const prev = { careDays: 4, lastCareOn: '2026-01-01' };
    applyDailyCare(prev, '2026-01-02');
    assert.deepEqual(prev, { careDays: 4, lastCareOn: '2026-01-01' });
  });
});

describe('vườn — mùa và đêm theo Asia/Saigon', () => {
  it('xuân 2–4, hạ 5–7, thu 8–10, đông 11–1', () => {
    assert.equal(seasonFromDate(new Date('2026-04-15T04:00:00Z')), 'xuan');
    assert.equal(seasonFromDate(new Date('2026-02-01T00:00:00Z')), 'xuan');
    assert.equal(seasonFromDate(new Date('2026-06-01T04:00:00Z')), 'ha');
    assert.equal(seasonFromDate(new Date('2026-09-15T04:00:00Z')), 'thu');
    assert.equal(seasonFromDate(new Date('2026-12-20T04:00:00Z')), 'dong');
    assert.equal(seasonFromDate(new Date('2026-01-10T04:00:00Z')), 'dong');
  });

  it('ranh giới ngày theo giờ Sài Gòn, không theo UTC', () => {
    assert.equal(seasonFromDate(new Date('2026-04-30T16:30:00Z')), 'xuan');
    assert.equal(seasonFromDate(new Date('2026-04-30T17:30:00Z')), 'ha');
  });

  it('đêm trước 6 giờ và từ 18 giờ', () => {
    assert.equal(isNight(new Date('2026-06-15T10:30:00Z')), false);
    assert.equal(isNight(new Date('2026-06-15T11:30:00Z')), true);
    assert.equal(isNight(new Date('2026-06-15T22:30:00Z')), true);
    assert.equal(isNight(new Date('2026-06-15T23:30:00Z')), false);
  });
});

describe('vườn — catalog', () => {
  it('12 thú và 12 cây, tám loài có tranh đúng danh sách chủ chốt', () => {
    assert.equal(speciesOf('pet').length, 12);
    assert.equal(speciesOf('plant').length, 12);
    assert.deepEqual(
      VUON_SPECIES.filter((s) => s.art).map((s) => s.id),
      [...VUON_ART_IDS],
    );
  });

  it('bốn thú có tranh bốn tính cách khác nhau, sung là cây thế giới duy nhất', () => {
    const pets = speciesOf('pet').filter((s) => s.art).map((s) => s.temper);
    assert.deepEqual(new Set(pets).size, 4);
    assert.equal(pets.includes('the_gioi'), false);
    const world = VUON_SPECIES.filter((s) => s.temper === 'the_gioi').map((s) => s.id);
    assert.deepEqual(world, ['sung']);
  });
});
