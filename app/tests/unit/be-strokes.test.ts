import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalStrokes, simplifyStroke, validateStrokes } from '../../src/shared/be/strokes.ts';
import { STROKE_JSON_MAX } from '../../src/shared/be/types.ts';
import type { Stroke } from '../../src/shared/be/types.ts';

const pen: Stroke = {
  tool: 'pen',
  color: '#F28C28',
  size: 40,
  alpha: 1,
  points: [10, 20, 30, 40, 50, 60],
};

describe('nét vẽ', () => {
  it('nhận nét hợp lệ và chuẩn hóa màu', () => {
    const r = validateStrokes([pen]);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.strokes[0].color, '#f28c28');
    assert.equal(r.json, canonicalStrokes(r.strokes));
    const again = validateStrokes(JSON.parse(r.json));
    assert.equal(again.ok, true);
    if (again.ok) assert.equal(again.json, r.json);
  });

  it('từ chối màu sai, số điểm lẻ, và quá dài', () => {
    assert.equal(validateStrokes([{ ...pen, color: 'red' }]).ok, false);
    assert.equal(validateStrokes([{ ...pen, points: [1, 2, 3] }]).ok, false);
    assert.equal(validateStrokes([]).ok, false);
    const huge: Stroke = { ...pen, points: Array.from({ length: 400 }, (_, i) => (i % 2 === 0 ? i : 10)) };
    const many = Array.from({ length: 40 }, () => huge);
    const bad = validateStrokes(many);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.error, 'be_strokes');
    assert.ok(JSON.stringify(many).length > STROKE_JSON_MAX);
  });

  it('rút điểm thẳng', () => {
    const straight: Stroke = {
      tool: 'pen',
      color: '#112233',
      size: 12,
      alpha: 1,
      points: [0, 0, 10, 0, 20, 0, 30, 0, 40, 0, 100, 0],
    };
    const slim = simplifyStroke(straight, 2);
    assert.ok(slim.points.length < straight.points.length);
    assert.equal(slim.points[0], 0);
    assert.equal(slim.points[slim.points.length - 2], 100);
  });

  it('giữ cờ cứng và mặt nạ', () => {
    const r = validateStrokes([{ ...pen, hard: true, mask: true }]);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.strokes[0].hard, true);
    assert.equal(r.strokes[0].mask, true);
    assert.match(r.json, /"hard":true/);
  });
});
