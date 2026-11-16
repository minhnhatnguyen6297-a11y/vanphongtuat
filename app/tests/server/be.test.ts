import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { config } from '../../src/server/config.ts';
import { saveSprite } from '../../src/server/be-sprites.ts';
import { resetBeFeedLimit } from '../../src/server/commands/be.ts';
import { encodePng } from '../../src/shared/be-png.ts';
import { SPRITE_H, SPRITE_W, templateFishBasic } from '../../src/shared/be.ts';
import { makeMember, setupTestDb } from './helpers.ts';

function png(): Buffer {
  const rgba = Buffer.alloc(SPRITE_W * SPRITE_H * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 240;
    rgba[i + 1] = 160;
    rgba[i + 2] = 40;
    rgba[i + 3] = 255;
  }
  return encodePng(SPRITE_W, SPRITE_H, rgba);
}

describe('bể — lưu nét và sprite', () => {
  it('từ chối khi chưa có ảnh nướng, rồi thả cá, cho ăn, ẩn', () => {
    const db = setupTestDb();
    const dir = mkdtempSync(join(tmpdir(), 'be-sp-'));
    config.be.spriteDir = dir;
    resetBeFeedLimit();
    const { member } = makeMember(db, { username: 've', displayName: 'Người vẽ', tier: 'dan_den' });
    const boss = makeMember(db, { username: 'chu', displayName: 'Chủ', tier: 'chu_xi', isOperator: true });
    const doc = templateFishBasic();
    const missing = dispatchCommand(db, member, {
      opId: 'op-miss',
      name: 'be.save',
      args: { kind: 'ca', name: 'Bống', strokes: doc, swim: 'active', wave: true, spriteHash: 'ab'.repeat(32), place: true },
    });
    assert.equal(missing.ok, false);

    const saved = saveSprite(dir, png());
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const put = dispatchCommand(db, member, {
      opId: 'op-save',
      name: 'be.save',
      args: {
        kind: 'ca',
        name: 'Bống',
        strokes: doc,
        swim: 'active',
        wave: true,
        spriteHash: saved.hash,
        place: true,
        startGrowth: 0.7,
      },
    });
    assert.equal(put.ok, true);
    if (!put.ok) return;
    const opened = dispatchCommand(db, member, { opId: 'op-open', name: 'be.open', args: {} });
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const state = opened.result as { drawings: { name: string; sprite: string }[] };
    assert.equal(state.drawings.length, 1);
    assert.equal(state.drawings[0].name, 'Bống');
    assert.ok(state.drawings[0].sprite.includes(saved.hash));

    const fed = dispatchCommand(db, member, { opId: 'op-feed', name: 'be.feed', args: {} });
    assert.equal(fed.ok, true);
    const again = dispatchCommand(db, member, { opId: 'op-feed2', name: 'be.feed', args: {} });
    assert.equal(again.ok, false);

    const rows = db.prepare('SELECT id FROM be_drawing').all() as { id: string }[];
    const hide = dispatchCommand(db, boss.member, { opId: 'op-hide', name: 'be.hide', args: { id: rows[0].id } });
    assert.equal(hide.ok, true);
    const after = dispatchCommand(db, member, { opId: 'op-open2', name: 'be.open', args: {} });
    assert.equal(after.ok, true);
    if (!after.ok) return;
    assert.equal((after.result as { drawings: unknown[] }).drawings.length, 0);
    const still = db.prepare('SELECT COUNT(*) AS c FROM be_drawing').get() as { c: number };
    assert.equal(still.c, 1);
  });
});
