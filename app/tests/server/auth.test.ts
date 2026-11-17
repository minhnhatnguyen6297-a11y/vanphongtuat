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

  it('cùng PIN trên hai khóa hoa/thường, hash không đổi', () => {
    const before = pinHash(db);
    const a = login(db, '  Minh ', '654321', '10.0.0.11');
    const b = login(db, 'MINH', '654321', '10.0.0.12');
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.notEqual(a.sessionId, b.sessionId);
    assert.equal(a.member.id, b.member.id);
    assert.equal(pinHash(db), before);
  });

  it('khóa tài khoản dùng cùng khóa với lúc tìm', () => {
    makeMember(db, { username: 'Lan', pin: '135790' });
    const before = pinHash(db, 'Lan');
    for (let i = 0; i < 4; i++) {
      const r = login(db, i % 2 ? 'LAN' : 'lan', '000000', '10.0.0.21');
      assert.equal(r.ok, false);
      assert.equal((r as { error: string }).error, 'bad_credentials');
    }
    const locked = login(db, 'LaN', '000000', '10.0.0.21');
    assert.equal((locked as { error: string }).error, 'locked');
    const still = login(db, 'lan', '135790', '10.0.0.22');
    assert.equal((still as { error: string }).error, 'locked');
    assert.equal(pinHash(db, 'Lan'), before);
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
      headers: { origin: 'https://evil.example', 'x-hng': '1', host: 'localhost:8443' },
    } as unknown as IncomingMessage;
    assert.equal(checkOriginAndCsrf(badOrigin), false);

    const sameHost = {
      headers: { origin: 'http://192.168.1.20:8443', host: '192.168.1.20:8443', 'x-hng': '1' },
    } as unknown as IncomingMessage;
    assert.equal(checkOriginAndCsrf(sameHost), true);
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

  it('hai phiên HTTP cùng máy chủ nhận cùng tài khoản, PIN không bị ghi lại', async () => {
    setDevHttpTrue();
    const before = pinHash(db);
    const ai = createAiQueue(null);
    const handler = createHttpHandler({ db, ai });
    const server = createServer(handler);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${port}`;

    const one = await postLogin(origin, 'Minh', '654321');
    const two = await postLogin(origin, 'MINH', '654321');
    assert.equal(one.status, 200);
    assert.equal(two.status, 200);
    assert.notEqual(one.cookie, two.cookie);

    const meOne = await fetch(`${origin}/api/me`, { headers: { cookie: one.cookie } });
    const meTwo = await fetch(`${origin}/api/me`, { headers: { cookie: two.cookie } });
    assert.equal(meOne.status, 200);
    assert.equal(meTwo.status, 200);
    const bodyOne = (await meOne.json()) as { member: { id: string; username: string } };
    const bodyTwo = (await meTwo.json()) as { member: { id: string; username: string } };
    assert.equal(bodyOne.member.id, bodyTwo.member.id);
    assert.equal(bodyOne.member.username, 'minh');
    assert.equal(bodyTwo.member.username, 'minh');
    assert.equal(pinHash(db), before);

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

function pinHash(db: ReturnType<typeof setupTestDb>, username = 'minh'): string {
  const row = db
    .prepare('SELECT pin_hash FROM members WHERE username = ? COLLATE NOCASE')
    .get(username) as { pin_hash: Buffer };
  return Buffer.from(row.pin_hash).toString('hex');
}

async function postLogin(origin: string, username: string, pin: string) {
  const res = await fetch(`${origin}/api/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'x-hng': '1',
    },
    body: JSON.stringify({ username, pin }),
  });
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  return { status: res.status, cookie };
}
