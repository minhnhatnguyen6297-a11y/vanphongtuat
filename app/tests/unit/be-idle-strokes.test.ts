import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countsAsPresence,
  idlePhase,
  IDLE_DEFAULTS,
  parseStrokeDoc,
  simplifyPoints,
  strokeBytes,
  MAX_STROKE_BYTES,
  templateFishBasic,
} from '../../src/shared/be.ts';

describe('idle bể', () => {
  const cfg = { visibleMs: 15_000, hiddenMs: 5_000, warnMs: 1_000 };

  it('mới hoạt động thì còn ở', () => {
    assert.equal(
      idlePhase({ now: 10_000, lastActive: 9_000, visible: true, hiddenAt: null, cfg }),
      'ok',
    );
  });

  it('sắp hết giờ tab mở thì báo', () => {
    assert.equal(
      idlePhase({ now: 14_200, lastActive: 0, visible: true, hiddenAt: null, cfg }),
      'warn',
    );
  });

  it('hết 15 phút tab mở thì đá', () => {
    assert.equal(
      idlePhase({ now: 15_000, lastActive: 0, visible: true, hiddenAt: null, cfg }),
      'kick',
    );
  });

  it('tab ẩn hết 5 phút thì đá, dù tab mở còn hạn', () => {
    assert.equal(
      idlePhase({ now: 5_000, lastActive: 0, visible: false, hiddenAt: 0, cfg }),
      'kick',
    );
  });

  it('tab ẩn chưa tới 5 phút thì chưa đá', () => {
    assert.equal(
      idlePhase({ now: 3_000, lastActive: 0, visible: false, hiddenAt: 0, cfg }),
      'ok',
    );
  });

  it('tin người khác và cá tự bơi không tính là có mặt', () => {
    assert.equal(countsAsPresence('remote-chat'), false);
    assert.equal(countsAsPresence('fish-tick'), false);
    assert.equal(countsAsPresence('water'), false);
    assert.equal(countsAsPresence('pointer'), true);
    assert.equal(countsAsPresence('chat-send'), true);
    assert.equal(countsAsPresence('still-here'), true);
    assert.equal(countsAsPresence('key'), true);
  });

  it('mặc định khớp spec 15 phút / 5 phút / báo 1 phút', () => {
    assert.equal(IDLE_DEFAULTS.visibleMs, 15 * 60 * 1000);
    assert.equal(IDLE_DEFAULTS.hiddenMs, 5 * 60 * 1000);
    assert.equal(IDLE_DEFAULTS.warnMs, 60 * 1000);
  });
});

describe('nét vẽ', () => {
  it('nhận nét bút hợp lệ và rút điểm', () => {
    const points = Array.from({ length: 40 }, (_, i) => ({ x: i / 40, y: 0.5 + (i % 2) * 0.001 }));
    const parsed = parseStrokeDoc({
      strokes: [{ tool: 'pen', color: '#FF00AA', size: 8, alpha: 1, points }],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.ok(parsed.doc.strokes[0].points.length < 40);
    assert.equal(parsed.doc.strokes[0].color, '#ff00aa');
    assert.ok(strokeBytes(parsed.doc) < MAX_STROKE_BYTES);
  });

  it('từ chối màu sai, điểm NaN, và quá nhiều nét', () => {
    assert.equal(parseStrokeDoc({ strokes: [{ tool: 'pen', color: 'red', size: 4, alpha: 1, points: [{ x: 0.2, y: 0.2 }] }] }).ok, false);
    assert.equal(
      parseStrokeDoc({ strokes: [{ tool: 'pen', color: '#112233', size: 4, alpha: 1, points: [{ x: Number.NaN, y: 0.2 }] }] }).ok,
      false,
    );
    const many = Array.from({ length: 70 }, () => ({
      tool: 'pen',
      color: '#112233',
      size: 4,
      alpha: 1,
      points: [{ x: 0.2, y: 0.2 }],
    }));
    assert.equal(parseStrokeDoc({ strokes: many }).ok, false);
  });

  it('khuôn cá cơ bản nằm trong trần byte', () => {
    const doc = templateFishBasic();
    const parsed = parseStrokeDoc(doc);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.ok(strokeBytes(parsed.doc) <= MAX_STROKE_BYTES);
  });

  it('simplify giữ hai đầu', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.01 },
      { x: 1, y: 0 },
    ];
    const out = simplifyPoints(pts, 0.05, 10);
    assert.equal(out[0].x, 0);
    assert.equal(out[out.length - 1].x, 1);
  });
});
