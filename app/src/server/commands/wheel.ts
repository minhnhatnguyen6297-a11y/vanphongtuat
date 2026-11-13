import { randomInt, randomUUID } from 'node:crypto';
import { CmdError } from '../errors.ts';
import { bumpWheelVersion } from '../snapshots.ts';
import { config } from '../config.ts';
import { syncShopWheelItems } from './table.ts';
import type { CmdOk, Handler } from './types.ts';
import type { CommandArgs } from '../../shared/commands.ts';

const MAX_ITEMS = 30;

function getWheel(db: Parameters<Handler>[0]['db'], id: string) {
  return db.prepare(`SELECT id, title, kind, table_id, version FROM wheels WHERE id = ?`).get(id) as
    | { id: string; title: string; kind: string; table_id: number | null; version: number }
    | undefined;
}

function checkWheelVersion(
  wheel: { id: string; version: number },
  baseVersion?: number,
) {
  if (baseVersion != null && baseVersion !== wheel.version) {
    throw new CmdError('conflict', { current: wheel });
  }
}

function itemCount(db: Parameters<Handler>[0]['db'], wheelId: string) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM wheel_items WHERE wheel_id = ?').get(wheelId) as {
    c: number;
  };
  return row.c;
}

export const wheelCreate: Handler = (ctx, args: CommandArgs<'wheel.create'>): CmdOk => {
  const { db, member } = ctx;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO wheels(id, title, kind, table_id, created_by, version) VALUES(?,?, 'free', NULL, ?, 1)`,
  ).run(id, args.title, member.id);
  return { result: { id }, scopes: ['wheels'] };
};

export const wheelRename: Handler = (
  ctx,
  args: CommandArgs<'wheel.rename'>,
  baseVersion?: number,
): CmdOk => {
  const { db } = ctx;
  const wheel = getWheel(db, args.id);
  if (!wheel) throw new CmdError('not_found');
  checkWheelVersion(wheel, baseVersion);
  db.prepare('UPDATE wheels SET title = ? WHERE id = ?').run(args.title, args.id);
  const version = bumpWheelVersion(db, args.id);
  return { result: { id: args.id, version }, scopes: ['wheels'] };
};

export const wheelItemAdd: Handler = (
  ctx,
  args: CommandArgs<'wheel.item.add'>,
  baseVersion?: number,
): CmdOk => {
  const { db } = ctx;
  const wheel = getWheel(db, args.wheelId);
  if (!wheel) throw new CmdError('not_found');
  checkWheelVersion(wheel, baseVersion);
  if (itemCount(db, args.wheelId) >= MAX_ITEMS) throw new CmdError('too_many_items');
  const id = randomUUID();
  const sort = itemCount(db, args.wheelId);
  db.prepare(
    `INSERT INTO wheel_items(id, wheel_id, name, weight, ref_shop_id, ref_member_id, votes, sort)
     VALUES(?,?,?,?,?,?,NULL,?)`,
  ).run(
    id,
    args.wheelId,
    args.name,
    args.weight ?? 20,
    args.refShopId ?? null,
    args.refMemberId ?? null,
    sort,
  );
  const version = bumpWheelVersion(db, args.wheelId);
  return { result: { id, version }, scopes: ['wheels'] };
};

export const wheelItemUpdate: Handler = (
  ctx,
  args: CommandArgs<'wheel.item.update'>,
  baseVersion?: number,
): CmdOk => {
  const { db } = ctx;
  const item = db
    .prepare(`SELECT id, wheel_id, name, weight FROM wheel_items WHERE id = ?`)
    .get(args.id) as { id: string; wheel_id: string; name: string; weight: number } | undefined;
  if (!item) throw new CmdError('not_found');
  const wheel = getWheel(db, item.wheel_id);
  if (!wheel) throw new CmdError('not_found');
  checkWheelVersion(wheel, baseVersion);
  db.prepare(`UPDATE wheel_items SET name = ?, weight = ? WHERE id = ?`).run(
    args.name ?? item.name,
    args.weight ?? item.weight,
    args.id,
  );
  const version = bumpWheelVersion(db, item.wheel_id);
  return { result: { id: args.id, version }, scopes: ['wheels'] };
};

export const wheelItemRemove: Handler = (
  ctx,
  args: CommandArgs<'wheel.item.remove'>,
  baseVersion?: number,
): CmdOk => {
  const { db } = ctx;
  const item = db.prepare(`SELECT id, wheel_id FROM wheel_items WHERE id = ?`).get(args.id) as
    | { id: string; wheel_id: string }
    | undefined;
  if (!item) throw new CmdError('not_found');
  const wheel = getWheel(db, item.wheel_id);
  if (!wheel) throw new CmdError('not_found');
  checkWheelVersion(wheel, baseVersion);
  db.prepare('DELETE FROM wheel_items WHERE id = ?').run(args.id);
  const version = bumpWheelVersion(db, item.wheel_id);
  return { result: { id: args.id, version }, scopes: ['wheels'] };
};

export const wheelEqualize: Handler = (
  ctx,
  args: CommandArgs<'wheel.equalize'>,
  baseVersion?: number,
): CmdOk => {
  const { db } = ctx;
  const wheel = getWheel(db, args.wheelId);
  if (!wheel) throw new CmdError('not_found');
  checkWheelVersion(wheel, baseVersion);
  db.prepare(`UPDATE wheel_items SET weight = 20 WHERE wheel_id = ?`).run(args.wheelId);
  const version = bumpWheelVersion(db, args.wheelId);
  return { result: { wheelId: args.wheelId, version }, scopes: ['wheels'] };
};

export const wheelByVote: Handler = (
  ctx,
  args: CommandArgs<'wheel.byVote'>,
  baseVersion?: number,
): CmdOk => {
  const { db } = ctx;
  const wheel = getWheel(db, args.wheelId);
  if (!wheel) throw new CmdError('not_found');
  checkWheelVersion(wheel, baseVersion);
  if (wheel.kind !== 'shop' || wheel.table_id == null) throw new CmdError('not_shop_wheel');
  syncShopWheelItems(db, wheel.id, wheel.table_id);
  const version = bumpWheelVersion(db, args.wheelId);
  return { result: { wheelId: args.wheelId, version }, scopes: ['wheels'] };
};

/** Xóa mọi vòng (kể cả gắn bàn). */
export const wheelDelete: Handler = (ctx, args: CommandArgs<'wheel.delete'>): CmdOk => {
  const { db } = ctx;
  const wheel = getWheel(db, args.id);
  if (!wheel) throw new CmdError('not_found');
  db.prepare('DELETE FROM wheel_items WHERE wheel_id = ?').run(args.id);
  db.prepare('DELETE FROM spins WHERE wheel_id = ?').run(args.id);
  db.prepare('DELETE FROM wheels WHERE id = ?').run(args.id);
  return { result: { id: args.id }, scopes: ['wheels'] };
};

export const wheelSpin: Handler = (ctx, args: CommandArgs<'wheel.spin'>): CmdOk => {
  const { db, member } = ctx;
  const wheel = getWheel(db, args.wheelId);
  if (!wheel) throw new CmdError('not_found');

  const last = db
    .prepare(
      `SELECT started_at, duration_ms FROM spins WHERE wheel_id = ? ORDER BY started_at DESC LIMIT 1`,
    )
    .get(args.wheelId) as { started_at: number; duration_ms: number } | undefined;
  if (last && last.started_at + last.duration_ms > Date.now()) {
    throw new CmdError('spinning');
  }

  const items = db
    .prepare(
      `SELECT id, name, weight, ref_shop_id AS refShopId, ref_member_id AS refMemberId, votes, sort
       FROM wheel_items WHERE wheel_id = ? ORDER BY sort, rowid`,
    )
    .all(args.wheelId) as Array<{
    id: string;
    name: string;
    weight: number;
    refShopId: string | null;
    refMemberId: string | null;
    votes: number | null;
    sort: number;
  }>;
  if (items.length < 2) throw new CmdError('need_two_items');

  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = randomInt(total);
  let resultIndex = 0;
  for (let i = 0; i < items.length; i++) {
    r -= items[i].weight;
    if (r < 0) {
      resultIndex = i;
      break;
    }
  }

  const id = randomUUID();
  const startedAt = Date.now();
  const durationMs = config.spinDurationMs;
  const itemsJson = JSON.stringify(items);
  db.prepare(
    `INSERT INTO spins(id, wheel_id, by_member, items_json, result_index, result_name, started_at, duration_ms)
     VALUES(?,?,?,?,?,?,?,?)`,
  ).run(id, args.wheelId, member.id, itemsJson, resultIndex, items[resultIndex].name, startedAt, durationMs);

  return {
    result: {
      spinId: id,
      wheelId: args.wheelId,
      resultIndex,
      resultName: items[resultIndex].name,
      startedAt,
      durationMs,
      items,
    },
    scopes: ['wheels'],
  };
};
