import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db.ts';
import { nowIso, newId } from './db.ts';
import { config } from './config.ts';
import type { AuthMember } from './perms.ts';

const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const KEYLEN = 32;
const SALT_LEN = 16;
const SCRYPT_OPTS = { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM };
const SESSION_BYTES = 32;
const COOKIE = 'hng_sid';
const MAX_USER_FAILS = 5;
/** Prod: 30/10 phút. DEV HTTP: nới để concurrent 15 + smoke không dính 429. */
const MAX_IP_TRIES = config.devHttp ? 200 : 30;
const IP_WINDOW_MS = 10 * 60 * 1000;
const LOCK_BASE_MS = 5 * 60 * 1000;
const LOCK_MAX_MS = 60 * 60 * 1000;

type IpBucket = { count: number; windowStart: number };
const ipBuckets = new Map<string, IpBucket>();

export function hashPin(pin: string, salt?: Buffer): { hash: Buffer; salt: Buffer } {
  const s = salt ?? randomBytes(SALT_LEN);
  const hash = scryptSync(pin, s, KEYLEN, SCRYPT_OPTS);
  return { hash, salt: s };
}

export function verifyPin(pin: string, hash: Buffer, salt: Buffer): boolean {
  const hashBuf = Buffer.isBuffer(hash) ? hash : Buffer.from(hash);
  const saltBuf = Buffer.isBuffer(salt) ? salt : Buffer.from(salt);
  const h = scryptSync(pin, saltBuf, KEYLEN, SCRYPT_OPTS);
  if (h.length !== hashBuf.length) return false;
  return timingSafeEqual(h, hashBuf);
}

export function randomPin(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, '0');
}

export function createSession(db: Db, memberId: string): string {
  const id = randomBytes(SESSION_BYTES).toString('hex');
  const now = nowIso();
  const expires = new Date(Date.now() + config.sessionDays * 86400_000).toISOString();
  db.prepare(
    `INSERT INTO auth_sessions(id, member_id, created_at, last_seen, expires_at, revoked)
     VALUES(?,?,?,?,?,0)`,
  ).run(id, memberId, now, now, expires);
  return id;
}

export function revokeSession(db: Db, sessionId: string) {
  db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE id = ?').run(sessionId);
}

export function touchSession(db: Db, sessionId: string) {
  const expires = new Date(Date.now() + config.sessionDays * 86400_000).toISOString();
  db.prepare(
    'UPDATE auth_sessions SET last_seen = ?, expires_at = ? WHERE id = ? AND revoked = 0',
  ).run(nowIso(), expires, sessionId);
}

export function memberFromSession(db: Db, sessionId: string | null): AuthMember | null {
  if (!sessionId) return null;
  const row = db
    .prepare(
      `SELECT m.id, m.username, m.display_name, m.is_operator, m.tier, m.avatar_id, m.disabled, s.expires_at, s.revoked
       FROM auth_sessions s JOIN members m ON m.id = s.member_id
       WHERE s.id = ?`,
    )
    .get(sessionId) as
    | {
        id: string;
        username: string;
        display_name: string;
        is_operator: number;
        tier: string;
        avatar_id: string | null;
        disabled: number;
        expires_at: string;
        revoked: number;
      }
    | undefined;
  if (!row || row.revoked) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.disabled) return null;
  touchSession(db, sessionId);
  const tier =
    row.tier === 'chu_xi' || row.tier === 'pho_xi' || row.tier === 'dan_den' || row.tier === 'no_le'
      ? row.tier
      : row.is_operator
        ? 'chu_xi'
        : 'dan_den';
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isOperator: tier === 'chu_xi' || !!row.is_operator,
    tier,
    avatarId: row.avatar_id ?? null,
    disabled: !!row.disabled,
  };
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

export function getSessionId(req: IncomingMessage): string | null {
  return parseCookies(req.headers.cookie)[COOKIE] || null;
}

export function setSessionCookie(res: ServerResponse, sessionId: string) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(sessionId)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${config.sessionDays * 86400}`,
  ];
  if (!config.devHttp) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: ServerResponse) {
  const parts = [`${COOKIE}=`, 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=0'];
  if (!config.devHttp) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function checkOriginAndCsrf(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (origin !== config.origin) return false;
  if (req.headers['x-hng'] !== '1') return false;
  return true;
}

export function clientIp(req: IncomingMessage): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function getLock(db: Db, username: string) {
  return db.prepare('SELECT fails, lock_level, locked_until FROM login_lockouts WHERE username = ?').get(
    username,
  ) as { fails: number; lock_level: number; locked_until: number | null } | undefined;
}

export function checkUserLock(db: Db, username: string): { locked: boolean; retryAfterMin: number } {
  const row = getLock(db, username);
  if (!row?.locked_until) return { locked: false, retryAfterMin: 0 };
  const left = row.locked_until - Date.now();
  if (left <= 0) return { locked: false, retryAfterMin: 0 };
  return { locked: true, retryAfterMin: Math.max(1, Math.ceil(left / 60_000)) };
}

export function checkIpRate(ip: string): boolean {
  const now = Date.now();
  let b = ipBuckets.get(ip);
  if (!b || now - b.windowStart > IP_WINDOW_MS) {
    b = { count: 0, windowStart: now };
    ipBuckets.set(ip, b);
  }
  b.count += 1;
  return b.count <= MAX_IP_TRIES;
}

export function recordLoginFail(db: Db, username: string) {
  const row = getLock(db, username);
  const fails = (row?.fails ?? 0) + 1;
  let lockLevel = row?.lock_level ?? 0;
  let lockedUntil: number | null = row?.locked_until ?? null;
  if (fails >= MAX_USER_FAILS) {
    lockLevel = Math.min(lockLevel + 1, 12);
    const ms = Math.min(LOCK_BASE_MS * 2 ** (lockLevel - 1), LOCK_MAX_MS);
    lockedUntil = Date.now() + ms;
    db.prepare(
      `INSERT INTO login_lockouts(username, fails, lock_level, locked_until)
       VALUES(?,?,?,?)
       ON CONFLICT(username) DO UPDATE SET fails=0, lock_level=excluded.lock_level, locked_until=excluded.locked_until`,
    ).run(username, 0, lockLevel, lockedUntil);
    return { locked: true, retryAfterMin: Math.max(1, Math.ceil(ms / 60_000)) };
  }
  db.prepare(
    `INSERT INTO login_lockouts(username, fails, lock_level, locked_until)
     VALUES(?,?,?,?)
     ON CONFLICT(username) DO UPDATE SET fails=excluded.fails`,
  ).run(username, fails, lockLevel, lockedUntil);
  return { locked: false, retryAfterMin: 0 };
}

export function clearLoginFails(db: Db, username: string) {
  db.prepare('DELETE FROM login_lockouts WHERE username = ?').run(username);
}

export function login(
  db: Db,
  username: string,
  pin: string,
  ip: string,
):
  | { ok: true; sessionId: string; member: AuthMember }
  | { ok: false; error: string; retryAfterMin?: number } {
  if (!checkIpRate(ip)) return { ok: false, error: 'rate_limited', retryAfterMin: 10 };

  const lock = checkUserLock(db, username);
  if (lock.locked) return { ok: false, error: 'locked', retryAfterMin: lock.retryAfterMin };

  const row = db
    .prepare(
      `SELECT id, username, display_name, pin_hash, pin_salt, is_operator, tier, avatar_id, disabled
       FROM members WHERE username = ? COLLATE NOCASE`,
    )
    .get(username) as
    | {
        id: string;
        username: string;
        display_name: string;
        pin_hash: Buffer;
        pin_salt: Buffer;
        is_operator: number;
        tier: string;
        avatar_id: string | null;
        disabled: number;
      }
    | undefined;

  if (!row || row.disabled) {
    recordLoginFail(db, username.toLowerCase());
    return { ok: false, error: 'bad_credentials' };
  }

  const ok = verifyPin(pin, row.pin_hash, row.pin_salt);
  if (!ok) {
    const fail = recordLoginFail(db, row.username.toLowerCase());
    if (fail.locked) return { ok: false, error: 'locked', retryAfterMin: fail.retryAfterMin };
    return { ok: false, error: 'bad_credentials' };
  }

  clearLoginFails(db, row.username.toLowerCase());
  const sessionId = createSession(db, row.id);
  const tier =
    row.tier === 'chu_xi' || row.tier === 'pho_xi' || row.tier === 'dan_den' || row.tier === 'no_le'
      ? row.tier
      : row.is_operator
        ? 'chu_xi'
        : 'dan_den';
  return {
    ok: true,
    sessionId,
    member: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      isOperator: tier === 'chu_xi' || !!row.is_operator,
      tier,
      avatarId: row.avatar_id ?? null,
      disabled: false,
    },
  };
}

export function publicMember(db: Db, id: string) {
  const row = db
    .prepare(
      `SELECT id, username, display_name AS displayName, is_operator AS isOperator, tier,
              avatar_id AS avatarId,
              bank_bin AS bankBin, bank_account AS bankAccount,
              bank_name_display AS bankNameDisplay, disabled
       FROM members WHERE id = ?`,
    )
    .get(id) as
    | {
        id: string;
        username: string;
        displayName: string;
        isOperator: number;
        tier: string;
        avatarId: string | null;
        bankBin: string | null;
        bankAccount: string | null;
        bankNameDisplay: string | null;
        disabled: number;
      }
    | undefined;
  if (!row) return undefined;
  return {
    ...row,
    isOperator: !!row.isOperator || row.tier === 'chu_xi',
    disabled: !!row.disabled,
  };
}

/** test helper */
export function _resetIpBuckets() {
  ipBuckets.clear();
}

export { COOKIE, newId };
