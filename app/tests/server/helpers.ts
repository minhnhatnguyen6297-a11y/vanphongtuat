import { randomUUID } from 'node:crypto';
import { openMemoryDb, closeDb, type Db, nowIso } from '../../src/server/db.ts';
import { hashPin, createSession } from '../../src/server/auth.ts';
import { config } from '../../src/server/config.ts';
import type { AuthMember } from '../../src/server/perms.ts';

export function setupTestDb(): Db {
  closeDb();
  return openMemoryDb();
}

export function makeMember(
  db: Db,
  opts: {
    username: string;
    displayName?: string;
    pin?: string;
    isOperator?: boolean;
    tier?: 'chu_xi' | 'pho_xi' | 'dan_den' | 'no_le';
  },
): { member: AuthMember; pin: string; id: string } {
  const pin = opts.pin ?? '123456';
  const { hash, salt } = hashPin(pin);
  const id = randomUUID();
  const tier =
    opts.tier ?? (opts.isOperator ? 'chu_xi' : 'dan_den');
  const isOperator = tier === 'chu_xi' || !!opts.isOperator;
  db.prepare(
    `INSERT INTO members(id, username, display_name, pin_hash, pin_salt, is_operator, tier, disabled, created_at)
     VALUES(?,?,?,?,?,?,?,0,?)`,
  ).run(
    id,
    opts.username,
    opts.displayName ?? opts.username,
    hash,
    salt,
    isOperator ? 1 : 0,
    tier,
    nowIso(),
  );
  return {
    id,
    pin,
    member: {
      id,
      username: opts.username,
      displayName: opts.displayName ?? opts.username,
      isOperator,
      tier,
      avatarId: null,
      disabled: false,
    },
  };
}

export function makeShop(db: Db, id: string, name: string, createdBy: string) {
  const now = nowIso();
  db.prepare(
    `INSERT INTO shops(id, name, phone, type, maps_url, created_by, created_at, updated_at, version)
     VALUES(?,?,NULL,'',NULL,?,?,?,1)`,
  ).run(id, name, createdBy, now, now);
}

export function sessionFor(db: Db, memberId: string) {
  return createSession(db, memberId);
}

export function withOrigin(headers: Record<string, string> = {}) {
  return {
    origin: config.origin,
    'x-hng': '1',
    ...headers,
  };
}

/** Temporarily override config.origin for CSRF tests */
export function setDevHttp(v: boolean) {
  (config as { devHttp: boolean }).devHttp = v;
}
