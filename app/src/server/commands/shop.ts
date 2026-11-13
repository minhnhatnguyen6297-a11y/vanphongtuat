import { randomUUID } from 'node:crypto';
import { nowIso } from '../db.ts';
import { CmdError } from '../errors.ts';
import { bumpShopVersion } from '../snapshots.ts';
import type { CmdOk, Handler } from './types.ts';
import type { CommandArgs } from '../../shared/commands.ts';

function normalizeName(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export const shopUpsert: Handler = (
  ctx,
  args: CommandArgs<'shop.upsert'>,
  baseVersion?: number,
): CmdOk => {
  const { db, member } = ctx;
  const now = nowIso();
  const norm = normalizeName(args.name);

  if (args.id) {
    const existing = db
      .prepare('SELECT id, version FROM shops WHERE id = ?')
      .get(args.id) as { id: string; version: number } | undefined;
    if (!existing) throw new CmdError('not_found');
    if (baseVersion != null && baseVersion !== existing.version) {
      throw new CmdError('conflict', {
        current: db
          .prepare(
            `SELECT id, name, phone, type, maps_url AS mapsUrl, version FROM shops WHERE id = ?`,
          )
          .get(args.id),
      });
    }
  }

  const dup = db
    .prepare(`SELECT id, name FROM shops`)
    .all() as { id: string; name: string }[];
  for (const s of dup) {
    if (normalizeName(s.name) === norm && s.id !== args.id) {
      throw new CmdError('duplicate_name');
    }
  }

  let id = args.id;
  if (!id) {
    id = randomUUID();
    db.prepare(
      `INSERT INTO shops(id, name, phone, type, maps_url, created_by, created_at, updated_at, version)
       VALUES(?,?,?,?,?,?,?,?,1)`,
    ).run(
      id,
      args.name,
      args.phone ?? null,
      args.type ?? '',
      args.mapsUrl ?? null,
      member.id,
      now,
      now,
    );
  } else {
    db.prepare(
      `UPDATE shops SET name = ?, phone = ?, type = ?, maps_url = ?, updated_at = ? WHERE id = ?`,
    ).run(args.name, args.phone ?? null, args.type ?? '', args.mapsUrl ?? null, now, id);
    bumpShopVersion(db, id);
  }

  return { result: { id }, scopes: ['shops'] };
};

export const shopSetMenu: Handler = (
  ctx,
  args: CommandArgs<'shop.setMenu'>,
  baseVersion?: number,
): CmdOk => {
  const { db } = ctx;
  const shop = db.prepare('SELECT id, version FROM shops WHERE id = ?').get(args.shopId) as
    | { id: string; version: number }
    | undefined;
  if (!shop) throw new CmdError('not_found');
  if (baseVersion != null && baseVersion !== shop.version) {
    throw new CmdError('conflict', { current: { id: shop.id, version: shop.version } });
  }
  db.prepare('DELETE FROM menu_items WHERE shop_id = ?').run(args.shopId);
  const ins = db.prepare(
    `INSERT INTO menu_items(id, shop_id, name, price, sort) VALUES(?,?,?,?,?)`,
  );
  let sort = 0;
  for (const it of args.items) {
    ins.run(it.id || randomUUID(), args.shopId, it.name, it.price, sort++);
  }
  const version = bumpShopVersion(db, args.shopId);
  return { result: { shopId: args.shopId, version, count: args.items.length }, scopes: ['shops'] };
};

/** Gỡ tham chiếu bàn/vote/wheel rồi xóa quán (LAN vui — xóa được luôn). */
export const shopDelete: Handler = (ctx, args: CommandArgs<'shop.delete'>): CmdOk => {
  const { db } = ctx;
  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(args.id) as
    | { id: string }
    | undefined;
  if (!shop) throw new CmdError('not_found');

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM votes WHERE shop_id = ?').run(args.id);
    db.prepare('DELETE FROM table_shops WHERE shop_id = ?').run(args.id);
    db.prepare('UPDATE tables SET winner_shop_id = NULL WHERE winner_shop_id = ?').run(args.id);
    db.prepare('UPDATE wheel_items SET ref_shop_id = NULL WHERE ref_shop_id = ?').run(args.id);
    db.prepare('DELETE FROM menu_items WHERE shop_id = ?').run(args.id);
    db.prepare('DELETE FROM shops WHERE id = ?').run(args.id);
  });
  tx();
  return { result: { id: args.id }, scopes: ['shops', 'table:current', 'wheels'] };
};
