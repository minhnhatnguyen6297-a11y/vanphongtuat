import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { idlePhase, readIdleEnv, sanitizeIdle } from '../../src/shared/be/idle.ts';
import { nextQuality } from '../../src/shared/be/quality.ts';

const base = { visibleMs: 15 * 60_000, hiddenMs: 5 * 60_000, warnMs: 60_000 };

describe('idle bể', () => {
  it('tab đang mở, mới hoạt động thì còn ở', () => {
    const r = idlePhase({ now: 1_000, lastActiveAt: 1_000, hiddenAt: null, ...base });
    assert.equal(r.phase, 'active');
    assert.equal(r.remainingMs, base.visibleMs);
  });

  it('sắp hết giờ thì báo', () => {
    const now = base.visibleMs - 30_000;
    const r = idlePhase({ now, lastActiveAt: 0, hiddenAt: null, ...base });
    assert.equal(r.phase, 'warn');
    assert.equal(r.remainingMs, 30_000);
  });

  it('hết 15 phút tab mở thì đá', () => {
    const r = idlePhase({ now: base.visibleMs + 1, lastActiveAt: 0, hiddenAt: null, ...base });
    assert.equal(r.phase, 'kick');
    assert.equal(r.remainingMs, 0);
  });

  it('tab ẩn 5 phút thì đá dù vừa hoạt động trước đó', () => {
    const r = idlePhase({
      now: 5 * 60_000,
      lastActiveAt: 5 * 60_000,
      hiddenAt: 0,
      ...base,
    });
    assert.equal(r.phase, 'kick');
  });

  it('thu nhỏ tab không gia hạn quá mốc tab đang mở', () => {
    const r = idlePhase({
      now: base.visibleMs + 1,
      lastActiveAt: 0,
      hiddenAt: base.visibleMs - 30_000,
      ...base,
    });
    assert.equal(r.phase, 'kick');
  });

  it('cùng mốc hoạt động thì tin bên ngoài không gia hạn', () => {
    const a = idlePhase({ now: 10 * 60_000, lastActiveAt: 0, hiddenAt: null, ...base });
    const b = idlePhase({ now: 10 * 60_000, lastActiveAt: 0, hiddenAt: null, ...base });
    assert.deepEqual(a, b);
    assert.equal(a.phase, 'active');
  });

  it('mốc cấu hình ngắn vẫn đúng', () => {
    const cfg = sanitizeIdle({ visibleMs: 2_000, hiddenMs: 800, warnMs: 200 });
    assert.deepEqual(cfg, { visibleMs: 2_000, hiddenMs: 800, warnMs: 200 });
    const r = idlePhase({ now: 900, lastActiveAt: 1_000, hiddenAt: 200, ...cfg });
    assert.equal(r.phase, 'warn');
  });

  it('mặc định 15 phút / 5 phút / báo 1 phút', () => {
    const cfg = readIdleEnv({});
    assert.equal(cfg.visibleMs, 15 * 60_000);
    assert.equal(cfg.hiddenMs, 5 * 60_000);
    assert.equal(cfg.warnMs, 60_000);
  });
});

describe('mức đồ họa', () => {
  it('dưới 24 khung thì xuống, trên 28 thì lên, máy 4 GB không lên Cao', () => {
    assert.equal(nextQuality('vua', 20, 8, false), 'nhe');
    assert.equal(nextQuality('vua', 29, 8, false), 'cao');
    assert.equal(nextQuality('vua', 29, 4, false), 'vua');
    assert.equal(nextQuality('cao', 30, 16, true), 'tinh');
  });
});
