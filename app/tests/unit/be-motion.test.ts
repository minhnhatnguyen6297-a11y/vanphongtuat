import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { boxBlurRGBA } from '../../src/client/be/blur.ts';
import {
  HEAD_TILT_MAX,
  depthLook,
  headTilt,
  stepSwimmer,
  tailWag,
  turnDurationMs,
  turnSquash,
  turnWidthScale,
  type Swimmer,
} from '../../src/client/be/motion.ts';
import { FISH_PATTERNS } from '../../src/client/be/patterns.ts';

const bounds = { minX: 0, maxX: 200, minY: 0, maxY: 100 };

function swimmer(facing: 1 | -1, tx: number): Swimmer {
  return {
    id: 'a',
    x: 100,
    y: 50,
    tx,
    ty: 50,
    depth: 1,
    facing,
    phase: 0,
    turn: null,
  };
}

describe('bể cá motion', () => {
  it('quay đầu kéo 400–600ms', () => {
    assert.equal(turnDurationMs(0), 400);
    assert.equal(turnDurationMs(1), 600);
    assert.equal(turnDurationMs(0.5), 500);
  });

  it('co bề ngang còn khoảng 0.05 ở giữa lượt quay', () => {
    assert.equal(turnSquash(0), 0);
    assert.equal(turnSquash(0.5), 1);
    assert.equal(turnWidthScale(0), 1);
    assert.ok(Math.abs(turnWidthScale(1) - 0.05) < 1e-12);
  });

  it('nghiêng đầu kẹp trong ±30°', () => {
    assert.equal(headTilt(Math.PI / 2), HEAD_TILT_MAX);
    assert.equal(headTilt(-Math.PI / 2), -HEAD_TILT_MAX);
    assert.equal(headTilt(0.2), 0.2);
  });

  it('lật mặt ở điểm co nhất, xong lượt trong 0.4s khi rand = 0', () => {
    const s = swimmer(1, 10);
    let flipAt = -1;
    let doneAt = -1;
    let t = 0;
    const dt = 0.05;
    for (let i = 0; i < 20 && doneAt < 0; i++) {
      stepSwimmer(s, dt, () => 0, bounds, 40);
      t += dt;
      if (flipAt < 0 && s.facing === -1) flipAt = t;
      if (s.turn === null && s.facing === -1) doneAt = t;
    }
    assert.ok(flipAt >= 0.2 && flipAt <= 0.25, `flip ${flipAt}`);
    assert.ok(doneAt >= 0.4 && doneAt <= 0.45, `done ${doneAt}`);
  });

  it('rand = 1 thì lượt quay dài 0.6s', () => {
    const s = swimmer(1, 10);
    let doneAt = -1;
    let t = 0;
    const dt = 0.05;
    for (let i = 0; i < 20 && doneAt < 0; i++) {
      stepSwimmer(s, dt, () => 1, bounds, 40);
      t += dt;
      if (s.turn === null && s.facing === -1) doneAt = t;
    }
    assert.ok(doneAt >= 0.6 && doneAt <= 0.65, `done ${doneAt}`);
  });

  it('đuôi lắc nhẹ và cá xa nhỏ hơn, mờ hơn, ngả xanh hơn', () => {
    for (let i = 0; i < 20; i++) {
      assert.ok(Math.abs(tailWag(i * 0.13, 0.4)) <= 0.1 + 1e-9);
    }
    const far = depthLook(0);
    const near = depthLook(1);
    assert.ok(far.scale < near.scale);
    assert.ok(far.blurPx > near.blurPx);
    assert.ok(far.tint > near.tint);
    assert.equal(near.blurPx, 0);
    assert.equal(near.tint, 0);
  });
});

describe('mẫu và cọ mờ', () => {
  it('có 6 mẫu outline', () => {
    assert.equal(FISH_PATTERNS.length, 6);
    for (const p of FISH_PATTERNS) {
      assert.match(p.svg, /<svg/);
      assert.match(p.svg, /stroke="#13110F"/);
      assert.ok(p.label.length > 0);
    }
  });

  it('làm mờ lan ra điểm cạnh', () => {
    const w = 5;
    const h = 5;
    const src = new Uint8ClampedArray(w * h * 4);
    const center = (2 * w + 2) * 4;
    src[center] = 255;
    src[center + 1] = 255;
    src[center + 2] = 255;
    src[center + 3] = 255;
    const out = boxBlurRGBA(src, w, h, 1);
    const neighbor = (2 * w + 1) * 4;
    assert.ok((out[neighbor + 3] ?? 0) > 0);
    assert.ok((out[center] ?? 255) < 255);
  });
});
