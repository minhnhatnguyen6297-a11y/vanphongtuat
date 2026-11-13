import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { closeDb } from '../../src/server/db.ts';
import {
  login,
  checkOriginAndCsrf,
  _resetIpBuckets,
  memberFromSession,
} from '../../src/server/auth.ts';
import { createHttpHandler } from '../../src/server/http.ts';
import { createAiQueue } from '../../src/server/ai/queue.ts';
import { StubProvider } from '../../src/server/ai/provider.ts';
import { config } from '../../src/server/config.ts';
import { setupTestDb, makeMember } from './helpers.ts';
import type { IncomingMessage } from 'node:http';

describe('auth PIN lockout & CSRF', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    db = setupTestDb();
    _resetIpBuckets();
    makeMember(db, { username: 'minh', pin: '654321', isOperator: true });
  });

  afterEach(() => closeDb());

  it('sai PIN 5 lần → khóa', () => {
    for (let i = 0; i < 4; i++) {
      const r = login(db, 'minh', '000000', '127.0.0.1');
      assert.equal(r.ok, false);
      assert.equal((r as { error: string }).error, 'bad_credentials');
    }
    const locked = login(db, 'minh', '000000', '127.0.0.1');
    assert.equal(locked.ok, false);
    assert.equal((locked as { error: string }).error, 'locked');
    assert.ok(((locked as { retryAfterMin?: number }).retryAfterMin ?? 0) >= 1);

    const still = login(db, 'minh', '654321', '127.0.0.1');
    assert.equal(still.ok, false);
    assert.equal((still as { error: string }).error, 'locked');
  });

  it('đăng nhập đúng → session', () => {
    const r = login(db, 'minh', '654321', '10.0.0.2');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const m = memberFromSession(db, r.sessionId);
    assert.ok(m);
    assert.equal(m!.username, 'minh');
  });

  it('Origin/CSRF: thiếu X-HNG hoặc Origin sai → false', () => {
    const good = {
      headers: { origin: config.origin, 'x-hng': '1' },
    } as unknown as IncomingMessage;
    assert.equal(checkOriginAndCsrf(good), true);

    const noHeader = {
      headers: { origin: config.origin },
    } as unknown as IncomingMessage;
    assert.equal(checkOriginAndCsrf(noHeader), false);

    const badOrigin = {
      headers: { origin: 'https://evil.example', 'x-hng': '1' },
    } as unknown as IncomingMessage;
    assert.equal(checkOriginAndCsrf(badOrigin), false);
  });

  it('POST /api/login thiếu CSRF → 403', async () => {
    const ai = createAiQueue(new StubProvider());
    const handler = createHttpHandler({ db, ai });
    const server = createServer(handler);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;

    const res = await fetch(`http://127.0.0.1:${port}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: config.origin },
      body: JSON.stringify({ username: 'minh', pin: '654321' }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, 'csrf');

    server.close();
  });

  it('POST /api/login đủ Origin+X-HNG → 200 + cookie', async () => {
    setDevHttpTrue();
    const ai = createAiQueue(null);
    const handler = createHttpHandler({ db, ai });
    const server = createServer(handler);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;

    const res = await fetch(`http://127.0.0.1:${port}/api/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: config.origin,
        'x-hng': '1',
      },
      body: JSON.stringify({ username: 'minh', pin: '654321' }),
    });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie') || '';
    assert.match(setCookie, /hng_sid=/);
    const body = await res.json();
    assert.equal(body.member.username, 'minh');

    server.close();
  });

  it('/api/ai thiếu key → 503 ai_disabled', async () => {
    setDevHttpTrue();
    const ai = createAiQueue(null);
    const handler = createHttpHandler({ db, ai });
    const server = createServer(handler);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;

    const loginRes = await fetch(`http://127.0.0.1:${port}/api/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: config.origin,
        'x-hng': '1',
      },
      body: JSON.stringify({ username: 'minh', pin: '654321' }),
    });
    const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];

    // minimal jpeg header
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const res = await fetch(`http://127.0.0.1:${port}/api/ai/bill`, {
      method: 'POST',
      headers: {
        origin: config.origin,
        'x-hng': '1',
        'content-type': 'image/jpeg',
        cookie,
      },
      body: jpeg,
    });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, 'ai_disabled');

    server.close();
  });
});

function setDevHttpTrue() {
  (config as { devHttp: boolean }).devHttp = true;
}
