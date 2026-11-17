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

function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

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

  it('thu hẹp ngang: đích ngoài vùng thì bơi tiếp, không kẹt mép', () => {
    const narrow = { minX: 30, maxX: 90, minY: 10, maxY: 110 };
    const s = swimmer(1, 180);
    s.x = 200;
    s.y = 60;
    s.ty = 60;
    const rand = sequence([0.25, 0.5, 0.8, 0.35, 0.15, 0.7]);
    const xs: number[] = [];
    for (let i = 0; i < 80; i++) {
      stepSwimmer(s, 0.05, rand, narrow, 90);
      assert.ok(s.tx >= narrow.minX && s.tx <= narrow.maxX, `tx ${s.tx}`);
      assert.ok(s.ty >= narrow.minY && s.ty <= narrow.maxY, `ty ${s.ty}`);
      assert.ok(s.x >= narrow.minX && s.x <= narrow.maxX, `x ${s.x}`);
      assert.ok(s.y >= narrow.minY && s.y <= narrow.maxY, `y ${s.y}`);
      xs.push(s.x);
    }
    const leftTheEdge = xs.some((x) => x < narrow.maxX - 15);
    assert.ok(leftTheEdge, `vẫn dính mép phải ${xs.slice(-5).join(',')}`);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 20, 'không đổi chỗ');
  });

  it('thu hẹp dọc: đích dưới cát thì rời mép dưới', () => {
    const short = { minX: 0, maxX: 200, minY: 40, maxY: 70 };
    const s = swimmer(1, 100);
    s.x = 100;
    s.y = 120;
    s.ty = 150;
    const rand = sequence([0.4, 0.2, 0.7, 0.85, 0.3, 0.55]);
    const ys: number[] = [];
    for (let i = 0; i < 80; i++) {
      stepSwimmer(s, 0.05, rand, short, 90);
      assert.ok(s.ty >= short.minY && s.ty <= short.maxY, `ty ${s.ty}`);
      assert.ok(s.y >= short.minY && s.y <= short.maxY, `y ${s.y}`);
      ys.push(s.y);
    }
    assert.ok(ys.some((y) => y < short.maxY - 12), `vẫn dính mép dưới ${ys.slice(-5).join(',')}`);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 12, 'không đổi chỗ');
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
