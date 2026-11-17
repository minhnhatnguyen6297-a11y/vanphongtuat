import { CmdError } from '../errors.ts';
import { nowIso, newId, type Db } from '../db.ts';
import { assertPng } from '../png-check.ts';
import type { CmdOk, Handler } from './types.ts';
import type { CommandArgs } from '../../shared/commands.ts';

const MAX_PNG = 160_000;
const MAX_PER_OWNER = 12;
const MAX_TANK = 80;
const MIN_GAP_MS = 1500;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

const lastRelease = new Map<string, number>();
const recentHits = new Map<string, number[]>();

export function _resetFishLimits() {
  lastRelease.clear();
  recentHits.clear();
}

function decodePng(input: string): Buffer {
  const trimmed = input.trim();
  const m = /^data:image\/png;base64,([a-z0-9+/=\r\n]+)$/i.exec(trimmed);
  const b64 = (m ? m[1] : trimmed).replace(/\s/g, '');
  if (!/^[a-z0-9+/=]+$/i.test(b64)) throw new CmdError('bad_png');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 24 || buf.length > MAX_PNG) throw new CmdError('bad_png');
  try {
    assertPng(buf);
  } catch {
    throw new CmdError('bad_png');
  }
  return buf;
}

function existingLocal(db: Db, ownerId: string, localId: string): string | undefined {
  const row = db.prepare(`SELECT id FROM tank_fish WHERE owner_id = ? AND local_id = ?`).get(ownerId, localId) as
    | { id: string }
    | undefined;
  return row?.id;
}

function allowRelease(memberId: string, now: number) {
  const prev = lastRelease.get(memberId) ?? 0;
  if (now - prev < MIN_GAP_MS) throw new CmdError('slow_down');
  const hits = (recentHits.get(memberId) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) throw new CmdError('slow_down');
  hits.push(now);
  recentHits.set(memberId, hits);
  lastRelease.set(memberId, now);
}

export const fishRelease: Handler = (ctx, args: CommandArgs<'fish.release'>): CmdOk => {
  const { db, member } = ctx;
  const png = decodePng(args.png);
  const localId = args.localId;
  if (localId) {
    const prior = existingLocal(db, member.id, localId);
    if (prior) return { result: { id: prior }, scopes: ['tank'] };
  }
  allowRelease(member.id, Date.now());
  const mine = db.prepare(`SELECT COUNT(*) AS c FROM tank_fish WHERE owner_id = ?`).get(member.id) as {
    c: number;
  };
  if (mine.c >= MAX_PER_OWNER) throw new CmdError('tank_full');
  const all = db.prepare(`SELECT COUNT(*) AS c FROM tank_fish`).get() as { c: number };
  if (all.c >= MAX_TANK) throw new CmdError('tank_full');
  const id = newId();
  try {
    db.prepare(`INSERT INTO tank_fish(id, owner_id, png, local_id, created_at) VALUES(?,?,?,?,?)`).run(
      id,
      member.id,
      png,
      localId ?? null,
      nowIso(),
    );
  } catch (err) {
    const code = (err as { code?: string }).code || '';
    if (localId && code.startsWith('SQLITE_CONSTRAINT')) {
      const prior = existingLocal(db, member.id, localId);
      if (prior) return { result: { id: prior }, scopes: ['tank'] };
    }
    throw err;
  }
  return { result: { id }, scopes: ['tank'] };
};

export const fishRemove: Handler = (ctx, args: CommandArgs<'fish.remove'>): CmdOk => {
  const { db, member } = ctx;
  const row = db.prepare(`SELECT owner_id FROM tank_fish WHERE id = ?`).get(args.id) as
    | { owner_id: string }
    | undefined;
  if (!row) throw new CmdError('not_found');
  const admin = member.tier === 'chu_xi' || member.isOperator;
  if (row.owner_id !== member.id && !admin) throw new CmdError('forbidden');
  db.prepare(`DELETE FROM tank_fish WHERE id = ?`).run(args.id);
  return { result: { id: args.id }, scopes: ['tank'] };
};

export function loadTankFish(db: Db): Array<{ id: string; ownerId: string; png: string; createdAt: string }> {
  const rows = db
    .prepare(
      `SELECT id, owner_id AS ownerId, png, created_at AS createdAt
       FROM tank_fish ORDER BY created_at, id`,
    )
    .all() as Array<{ id: string; ownerId: string; png: Buffer; createdAt: string }>;
  return rows.map((r) => ({
    id: r.id,
    ownerId: r.ownerId,
    png: `data:image/png;base64,${Buffer.from(r.png).toString('base64')}`,
    createdAt: r.createdAt,
  }));
}
