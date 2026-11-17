import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adoptSpinClock, easeOutCubic, spinProgress } from '../../src/shared/wheel-motion.ts';

describe('wheel motion', () => {
  it('progress stays inside 0..1', () => {
    assert.equal(spinProgress(-50, 1000), 0);
    assert.equal(spinProgress(500, 1000), 0.5);
    assert.equal(spinProgress(5000, 1000), 1);
    assert.equal(spinProgress(Number.NaN, 1000), 0);
  });

  it('ease-out slows down and stays finite', () => {
    const a = easeOutCubic(0.2);
    const b = easeOutCubic(0.4);
    const c = easeOutCubic(0.8);
    assert.ok(a < b && b < c);
    assert.ok(b - a > c - b);
    assert.equal(easeOutCubic(-2), 0);
    assert.equal(easeOutCubic(4), 1);
  });

  it('a future server clock starts a finite spin now', () => {
    const now = 10_000;
    const perf = 500;
    const plan = adoptSpinClock(now, now + 60_000, 4300, perf);
    assert.equal(plan.done, false);
    assert.equal(plan.localStart, perf);
    assert.equal(plan.dur, 4300);
  });

  it('a spin that already finished does not replay', () => {
    const now = 20_000;
    const plan = adoptSpinClock(now, now - 9_000, 4300, 100);
    assert.equal(plan.done, true);
    assert.equal(plan.localStart, 100 - 4300);
  });
});
