import { newId, nowIso, type Db } from '../db.ts';
import { CmdError } from '../errors.ts';
import { config } from '../config.ts';
import { spriteReady } from '../be-sprites.ts';
import type { CmdOk, Handler } from './types.ts';
import type { AuthMember } from '../perms.ts';
import {
  MAX_DECOR,
  MAX_FISH,
  MAX_PELLETS,
  MAX_PLANTS,
  UNLOCKS,
  clampGrowth,
  growthAdd,
  parseStrokeDoc,
  spritePublicPath,
  type Kind,
  type UnlockId,
} from '../../shared/be.ts';

const lastFeed = new Map<string, number>();

export function resetBeFeedLimit(): void {
  lastFeed.clear();
}

type TankRow = {
  sand: number;
  lighting: string;
  water_level: number;
  rocks: number;
  wood: number;
  dirt: number;
  updated_at: string;
  updated_by: string | null;
};

function tankOf(db: Db): TankRow {
  return db.prepare('SELECT sand, lighting, water_level, rocks, wood, dirt, updated_at, updated_by FROM be_tank WHERE id = 1').get() as TankRow;
}

function scalesOf(db: Db, userId: string): number {
  const row = db.prepare('SELECT scales FROM be_wallet WHERE user_id = ?').get(userId) as { scales: number } | undefined;
  return row?.scales ?? 0;
}

function addScales(db: Db, userId: string, n: number): number {
  db.prepare(
    `INSERT INTO be_wallet(user_id, scales) VALUES(?, ?)
     ON CONFLICT(user_id) DO UPDATE SET scales = scales + excluded.scales`,
  ).run(userId, n);
  return scalesOf(db, userId);
}

function unlocksOf(db: Db, userId: string): string[] {
  return (
    db.prepare('SELECT item FROM be_unlock WHERE user_id = ?').all(userId) as { item: string }[]
  ).map((r) => r.item);
}

export type PublicDrawing = {
  id: string;
  authorId: string;
  authorName: string;
  kind: Kind;
  name: string;
  swim: string;
  wave: boolean;
  hidden: boolean;
  sprite: string;
  growth: number;
  fed: number;
  createdAt: string;
  placement: { id: string; x: number; y: number; z: number } | null;
  reports: number;
};

function loadDrawings(db: Db, operator: boolean): PublicDrawing[] {
  const rows = db
    .prepare(
      `SELECT d.id, d.author_user_id AS authorId, m.display_name AS authorName, d.kind, d.name,
              d.swim_type AS swim, d.wave, d.hidden, d.sprite_hash AS spriteHash, d.growth, d.fed_count AS fed,
              d.created_at AS createdAt, p.id AS placementId, p.x AS px, p.y AS py, p.z AS pz,
              (SELECT COUNT(*) FROM be_report r WHERE r.drawing_id = d.id) AS reports
       FROM be_drawing d
       JOIN members m ON m.id = d.author_user_id
       LEFT JOIN be_placement p ON p.drawing_id = d.id
       ORDER BY d.created_at ASC`,
    )
    .all() as Array<Record<string, unknown>>;
  const out: PublicDrawing[] = [];
  for (const r of rows) {
    if (r.hidden && !operator) continue;
    const sprite = spritePublicPath(String(r.spriteHash));
    if (!sprite) continue;
    out.push({
      id: String(r.id),
      authorId: String(r.authorId),
      authorName: String(r.authorName),
      kind: r.kind as Kind,
      name: String(r.name),
      swim: String(r.swim),
      wave: !!r.wave,
      hidden: !!r.hidden,
      sprite,
      growth: Number(r.growth),
      fed: Number(r.fed),
      createdAt: String(r.createdAt),
      placement: r.placementId
        ? { id: String(r.placementId), x: Number(r.px), y: Number(r.py), z: Number(r.pz) }
        : null,
      reports: operator ? Number(r.reports) : 0,
    });
  }
  return out;
}

function pelletsOf(db: Db) {
  return (
    db
      .prepare(
        `SELECT id, x, born_at AS bornAt, eaten_at AS eatenAt FROM be_pellet
         WHERE eaten_at IS NULL ORDER BY born_at ASC`,
      )
      .all() as { id: string; x: number; bornAt: string; eatenAt: string | null }[]
  );
}

export function bePublicState(db: Db, member: AuthMember) {
  const tank = tankOf(db);
  const operator = member.isOperator || member.tier === 'chu_xi';
  return {
    serverNow: Date.now(),
    idle: {
      visibleMs: config.be.idleVisibleMs,
      hiddenMs: config.be.idleHiddenMs,
      warnMs: config.be.idleWarnMs,
    },
    tank: {
      sand: tank.sand,
      lighting: tank.lighting,
      waterLevel: tank.water_level,
      rocks: tank.rocks,
      wood: !!tank.wood,
      dirt: tank.dirt,
    },
    wallet: scalesOf(db, member.id),
    unlocks: unlocksOf(db, member.id),
    drawings: loadDrawings(db, operator),
    pellets: pelletsOf(db).map((p) => ({ id: p.id, x: p.x, bornAt: p.bornAt })),
    meId: member.id,
  };
}

function beEvent(name: string, data: unknown): CmdOk['events'] {
  return [{ t: 'be', name, data }];
}

function countPlaced(db: Db, kind: Kind): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM be_drawing d
       JOIN be_placement p ON p.drawing_id = d.id
       WHERE d.kind = ? AND d.hidden = 0`,
    )
    .get(kind) as { c: number };
  return row.c;
}

export const beOpen: Handler = (ctx): CmdOk => {
  return { result: bePublicState(ctx.db, ctx.member), scopes: [] };
};

export const beSave: Handler = (ctx, args): CmdOk => {
  const parsed = parseStrokeDoc(args.strokes);
  if (!parsed.ok) throw new CmdError('invalid_args', { reason: parsed.error });
  const hash = String(args.spriteHash || '');
  if (!spriteReady(config.be.spriteDir, hash)) throw new CmdError('invalid_args', { reason: 'sprite' });
  const kind = args.kind as Kind;
  const now = nowIso();
  const db = ctx.db;
  const name = String(args.name).slice(0, 24);
  const swim = String(args.swim || 'active');
  const wave = args.wave === false ? 0 : 1;
  const growth = clampGrowth(Number(args.startGrowth ?? 0.62));
  let id = args.id ? String(args.id) : '';

  if (id) {
    const row = db.prepare('SELECT author_user_id AS authorId, kind FROM be_drawing WHERE id = ?').get(id) as
      | { authorId: string; kind: Kind }
      | undefined;
    if (!row) throw new CmdError('not_found');
    if (row.authorId !== ctx.member.id && !(ctx.member.isOperator || ctx.member.tier === 'chu_xi')) {
      throw new CmdError('forbidden');
    }
    db.prepare(
      `UPDATE be_drawing SET name=?, strokes=?, swim_type=?, wave=?, sprite_hash=?, updated_at=? WHERE id=?`,
    ).run(name, JSON.stringify(parsed.doc), swim, wave, hash, now, id);
  } else {
    if (args.place !== false) {
      const cap = kind === 'ca' ? MAX_FISH : kind === 'cay' ? MAX_PLANTS : kind === 'do' ? MAX_DECOR : 0;
      if (cap && countPlaced(db, kind) >= cap) throw new CmdError('be_full');
    }
    id = newId();
    db.prepare(
      `INSERT INTO be_drawing(id, author_user_id, kind, name, strokes, swim_type, wave, hidden, sprite_hash, fed_count, growth, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,0,?,0,?,?,?)`,
    ).run(id, ctx.member.id, kind, name, JSON.stringify(parsed.doc), swim, wave, hash, growth, now, now);
    if (args.place !== false && kind !== 'thuc_an') {
      const y = kind === 'ca' ? 0.5 : kind === 'cay' ? 0.78 : 0.72;
      const x = 0.3 + Math.random() * 0.4;
      db.prepare('INSERT INTO be_placement(id, drawing_id, x, y, z) VALUES(?,?,?,?,?)').run(
        newId(),
        id,
        x,
        y,
        kind === 'ca' ? 2 : 1,
      );
    }
  }

  const one = loadDrawings(db, true).find((d) => d.id === id);
  return { result: { id, drawing: one }, scopes: [], events: beEvent('drawing', one) };
};

export const beFeed: Handler = (ctx): CmdOk => {
  const nowMs = Date.now();
  const prev = lastFeed.get(ctx.member.id) || 0;
  if (nowMs - prev < 2500) throw new CmdError('rate_limited');
  const db = ctx.db;
  const open = db.prepare('SELECT COUNT(*) AS c FROM be_pellet WHERE eaten_at IS NULL').get() as { c: number };
  if (open.c >= MAX_PELLETS) throw new CmdError('too_much');
  lastFeed.set(ctx.member.id, nowMs);
  db.prepare('UPDATE be_tank SET dirt = MIN(8, dirt + 1) WHERE id = 1').run();
  const born = nowIso();
  const made: { id: string; x: number; bornAt: string }[] = [];
  const n = 3;
  for (let i = 0; i < n; i++) {
    const id = newId();
    const x = 0.2 + Math.random() * 0.6;
    db.prepare('INSERT INTO be_pellet(id, x, born_at) VALUES(?,?,?)').run(id, x, born);
    made.push({ id, x, bornAt: born });
  }
  return { result: { pellets: made }, scopes: [], events: beEvent('feed', { pellets: made, dirt: tankOf(db).dirt }) };
};

export const beEat: Handler = (ctx, args): CmdOk => {
  const db = ctx.db;
  const pellet = db.prepare('SELECT id, eaten_at FROM be_pellet WHERE id = ?').get(String(args.pelletId)) as
    | { id: string; eaten_at: string | null }
    | undefined;
  if (!pellet || pellet.eaten_at) throw new CmdError('not_found');
  const fish = db
    .prepare(`SELECT id, kind, hidden, growth FROM be_drawing WHERE id = ?`)
    .get(String(args.drawingId)) as { id: string; kind: string; hidden: number; growth: number } | undefined;
  if (!fish || fish.kind !== 'ca' || fish.hidden) throw new CmdError('not_found');
  const now = nowIso();
  const growth = growthAdd(fish.growth);
  db.prepare('UPDATE be_pellet SET eaten_at = ?, eaten_by = ? WHERE id = ? AND eaten_at IS NULL').run(now, fish.id, pellet.id);
  db.prepare('UPDATE be_drawing SET growth = ?, fed_count = fed_count + 1, updated_at = ? WHERE id = ?').run(growth, now, fish.id);
  const dirt = tankOf(db).dirt;
  let wallet = scalesOf(db, ctx.member.id);
  if (dirt < 6) wallet = addScales(db, ctx.member.id, 1);
  return {
    result: { growth, wallet },
    scopes: [],
    events: beEvent('eat', { pelletId: pellet.id, drawingId: fish.id, growth, walletFor: ctx.member.id, wallet }),
  };
};

export const beClean: Handler = (ctx): CmdOk => {
  const db = ctx.db;
  db.prepare('DELETE FROM be_pellet WHERE eaten_at IS NULL').run();
  db.prepare('UPDATE be_tank SET dirt = MAX(0, dirt - 3), updated_at = ?, updated_by = ? WHERE id = 1').run(nowIso(), ctx.member.id);
  const wallet = addScales(db, ctx.member.id, 1);
  const dirt = tankOf(db).dirt;
  return { result: { dirt, wallet }, scopes: [], events: beEvent('clean', { dirt, walletFor: ctx.member.id, wallet }) };
};

export const beTank: Handler = (ctx, args): CmdOk => {
  const db = ctx.db;
  db.prepare(
    `UPDATE be_tank SET sand=?, lighting=?, water_level=?, rocks=?, wood=?, updated_at=?, updated_by=? WHERE id=1`,
  ).run(
    args.sand,
    args.lighting,
    args.waterLevel,
    args.rocks,
    args.wood ? 1 : 0,
    nowIso(),
    ctx.member.id,
  );
  const tank = tankOf(db);
  const data = {
    sand: tank.sand,
    lighting: tank.lighting,
    waterLevel: tank.water_level,
    rocks: tank.rocks,
    wood: !!tank.wood,
    dirt: tank.dirt,
  };
  return { result: data, scopes: [], events: beEvent('tank', data) };
};

export const beMove: Handler = (ctx, args): CmdOk => {
  const db = ctx.db;
  const row = db.prepare('SELECT id FROM be_placement WHERE id = ?').get(String(args.placementId)) as { id: string } | undefined;
  if (!row) throw new CmdError('not_found');
  db.prepare('UPDATE be_placement SET x = ?, y = ? WHERE id = ?').run(args.x, args.y, row.id);
  const data = { placementId: row.id, x: args.x, y: args.y };
  return { result: data, scopes: [], events: beEvent('move', data) };
};

export const beRename: Handler = (ctx, args): CmdOk => {
  const db = ctx.db;
  const row = db.prepare('SELECT author_user_id AS authorId FROM be_drawing WHERE id = ?').get(String(args.id)) as
    | { authorId: string }
    | undefined;
  if (!row) throw new CmdError('not_found');
  if (row.authorId !== ctx.member.id) throw new CmdError('forbidden');
  db.prepare('UPDATE be_drawing SET name = ?, updated_at = ? WHERE id = ?').run(String(args.name).slice(0, 24), nowIso(), args.id);
  return { result: { id: args.id, name: args.name }, scopes: [], events: beEvent('rename', { id: args.id, name: args.name }) };
};

export const beHide: Handler = (ctx, args): CmdOk => {
  if (!(ctx.member.isOperator || ctx.member.tier === 'chu_xi')) throw new CmdError('forbidden');
  const db = ctx.db;
  const row = db.prepare('SELECT id FROM be_drawing WHERE id = ?').get(String(args.id)) as { id: string } | undefined;
  if (!row) throw new CmdError('not_found');
  db.prepare('UPDATE be_drawing SET hidden = 1, updated_at = ? WHERE id = ?').run(nowIso(), row.id);
  return { result: { id: row.id }, scopes: [], events: beEvent('hide', { id: row.id }) };
};

export const beReport: Handler = (ctx, args): CmdOk => {
  const db = ctx.db;
  const row = db.prepare('SELECT id FROM be_drawing WHERE id = ?').get(String(args.id)) as { id: string } | undefined;
  if (!row) throw new CmdError('not_found');
  db.prepare('INSERT INTO be_report(id, drawing_id, member_id, created_at) VALUES(?,?,?,?)').run(newId(), row.id, ctx.member.id, nowIso());
  return { result: { id: row.id }, scopes: [], events: beEvent('report', { id: row.id }) };
};

export const beStrokes: Handler = (ctx, args): CmdOk => {
  const row = ctx.db
    .prepare('SELECT author_user_id AS authorId, strokes, kind, name, swim_type AS swim, wave FROM be_drawing WHERE id = ?')
    .get(String(args.id)) as
    | { authorId: string; strokes: string; kind: string; name: string; swim: string; wave: number }
    | undefined;
  if (!row) throw new CmdError('not_found');
  if (row.authorId !== ctx.member.id && !(ctx.member.isOperator || ctx.member.tier === 'chu_xi')) {
    throw new CmdError('forbidden');
  }
  return {
    result: {
      id: args.id,
      kind: row.kind,
      name: row.name,
      swim: row.swim,
      wave: !!row.wave,
      strokes: JSON.parse(row.strokes),
    },
    scopes: [],
  };
};

export const beUnlock: Handler = (ctx, args): CmdOk => {
  const item = String(args.item) as UnlockId;
  const spec = UNLOCKS[item];
  if (!spec) throw new CmdError('invalid_args');
  const db = ctx.db;
  const have = db.prepare('SELECT 1 FROM be_unlock WHERE user_id = ? AND item = ?').get(ctx.member.id, item);
  if (have) return { result: { item, wallet: scalesOf(db, ctx.member.id), unlocks: unlocksOf(db, ctx.member.id) }, scopes: [] };
  const wallet = scalesOf(db, ctx.member.id);
  if (wallet < spec.cost) throw new CmdError('be_poor');
  db.prepare('UPDATE be_wallet SET scales = scales - ? WHERE user_id = ?').run(spec.cost, ctx.member.id);
  db.prepare('INSERT INTO be_unlock(user_id, item) VALUES(?,?)').run(ctx.member.id, item);
  return {
    result: { item, wallet: scalesOf(db, ctx.member.id), unlocks: unlocksOf(db, ctx.member.id) },
    scopes: [],
  };
};
