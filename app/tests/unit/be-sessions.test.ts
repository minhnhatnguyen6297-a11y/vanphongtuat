import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { WebSocket } from 'ws';
import { beJoin, bePulse, beSweep, resetBeSessions } from '../../src/server/be-sessions.ts';

describe('phiên bể', () => {
  it('đá đúng hạn và không cần đụng bảng cá', () => {
    resetBeSessions();
    const ws = {} as WebSocket;
    beJoin(ws, 'mem', 0);
    bePulse(ws, false, false, 0);
    const cfg = { visibleMs: 15_000, hiddenMs: 5_000, warnMs: 1_000 };
    assert.equal(beSweep(4_000, cfg).length, 0);
    const kicked = beSweep(5_000, cfg);
    assert.equal(kicked.length, 1);
    assert.equal(beSweep(9_000, cfg).length, 0);
  });
});
