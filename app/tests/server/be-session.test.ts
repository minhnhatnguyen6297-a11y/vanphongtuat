import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, type Db } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { BeRuntime, setBeRuntime } from '../../src/server/be/runtime.ts';
import { setupTestDb, makeMember } from './helpers.ts';

describe('phiên bể', () => {
  let db: Db;
  let dir: string;
  let be: BeRuntime;

  beforeEach(() => {
    db = setupTestDb();
    dir = mkdtempSync(join(tmpdir(), 'be-session-'));
    be = new BeRuntime(db, {
      cacheDir: dir,
      idle: { visibleMs: 5_000, hiddenMs: 2_000, warnMs: 400 },
    });
    setBeRuntime(be);
  });

  afterEach(() => {
    be.stop();
    setBeRuntime(null);
    closeDb();
    rmSync(dir, { recursive: true, force: true });
  });

  it('đá phiên nhưng cá vẫn ở trong bể', () => {
    const { member } = makeMember(db, { username: 'lan', displayName: 'Lan' });
    const ack = dispatchCommand(db, member, {
      opId: 've-1',
      name: 'be.saveDrawing',
      args: {
        kind: 'ca',
        name: 'Bống',
        swim: 'thuong',
        wave: true,
        strokes: [
          { tool: 'pen', color: '#f28c28', size: 60, alpha: 1, points: [120, 500, 860, 500] },
        ],
      },
    });
    assert.equal(ack.ok, true);
    if (!ack.ok) return;
    const id = (ack.result as { id: string }).id;
    const released = dispatchCommand(db, member, {
      opId: 'tha-1',
      name: 'be.release',
      args: { id },
    });
    assert.equal(released.ok, true);

    be.touch(member.id, { active: true, hidden: false, create: true }, 0);
    const kicked = be.sweep(6_000);
    assert.deepEqual(kicked, [member.id]);
    const drawing = db.prepare('SELECT name FROM be_drawing WHERE id = ?').get(id) as { name: string };
    const placed = db.prepare('SELECT drawing_id FROM be_placement WHERE drawing_id = ?').get(id);
    const session = db.prepare('SELECT COUNT(*) AS c FROM be_session').get() as { c: number };
    assert.equal(drawing.name, 'Bống');
    assert.ok(placed);
    assert.equal(session.c, 0);
  });

  it('tab ẩn hết giờ ngắn hơn tab đang mở', () => {
    const { member } = makeMember(db, { username: 'minh', displayName: 'Minh', isOperator: true });
    be.touch(member.id, { active: true, hidden: false, create: true }, 1_000);
    assert.deepEqual(be.sweep(2_500), []);
    be.markHiddenIfPresent(member.id, 1_200);
    assert.deepEqual(be.sweep(3_300), [member.id]);
    const fish = db.prepare('SELECT COUNT(*) AS c FROM be_drawing').get() as { c: number };
    assert.equal(fish.c, 0);
  });
});
