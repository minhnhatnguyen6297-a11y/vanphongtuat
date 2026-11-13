import { randomUUID } from 'node:crypto';
import { nowIso } from '../db.ts';
import { CmdError } from '../errors.ts';
import { currentTableId } from '../perms.ts';
import { bumpTableVersion } from '../snapshots.ts';
import type { CmdCtx, CmdOk, Handler } from './types.ts';
import type { CommandArgs } from '../../shared/commands.ts';

function ensureShopOnTable(db: CmdCtx['db'], tableId: number, shopId: string) {
  const ok = db
    .prepare('SELECT 1 FROM table_shops WHERE table_id = ? AND shop_id = ?')
    .get(tableId, shopId);
  if (!ok) throw new CmdError('shop_not_on_table');
}

function ensureTableWheels(ctx: CmdCtx, tableId: number) {
  const { db, member } = ctx;
  const existing = db
    .prepare(`SELECT id, kind FROM wheels WHERE table_id = ?`)
    .all(tableId) as { id: string; kind: string }[];
  const hasShop = existing.some((w) => w.kind === 'shop');
  const hasPerson = existing.some((w) => w.kind === 'person');

  if (!hasShop) {
    const wid = randomUUID();
    db.prepare(
      `INSERT INTO wheels(id, title, kind, table_id, created_by, version) VALUES(?,?,?,?,?,1)`,
    ).run(wid, 'Trưa nay ăn gì?', 'shop', tableId, member.id);
    syncShopWheelItems(db, wid, tableId);
  }
  if (!hasPerson) {
    const wid = randomUUID();
    db.prepare(
      `INSERT INTO wheels(id, title, kind, table_id, created_by, version) VALUES(?,?,?,?,?,1)`,
    ).run(wid, 'Ai đi lấy đồ?', 'person', tableId, member.id);
    syncPersonWheelItems(db, wid, tableId);
  }
}

export function syncShopWheelItems(db: CmdCtx['db'], wheelId: string, tableId: number) {
  db.prepare('DELETE FROM wheel_items WHERE wheel_id = ?').run(wheelId);
  const shops = db
    .prepare(
      `SELECT ts.shop_id, s.name,
              (SELECT COUNT(*) FROM votes v WHERE v.table_id = ts.table_id AND v.shop_id = ts.shop_id) AS vc
       FROM table_shops ts JOIN shops s ON s.id = ts.shop_id
       WHERE ts.table_id = ? ORDER BY ts.rowid`,
    )
    .all(tableId) as { shop_id: string; name: string; vc: number }[];
  let sort = 0;
  const ins = db.prepare(
    `INSERT INTO wheel_items(id, wheel_id, name, weight, ref_shop_id, ref_member_id, votes, sort)
     VALUES(?,?,?,?,?,?,?,?)`,
  );
  for (const s of shops) {
    const weight = Math.min(100, Math.max(5, s.vc * 10));
    ins.run(randomUUID(), wheelId, s.name, weight, s.shop_id, null, s.vc, sort++);
  }
  db.prepare('UPDATE wheels SET version = version + 1 WHERE id = ?').run(wheelId);
}

export function syncPersonWheelItems(db: CmdCtx['db'], wheelId: string, tableId: number) {
  db.prepare('DELETE FROM wheel_items WHERE wheel_id = ?').run(wheelId);
  const people = db
    .prepare(
      `SELECT DISTINCT o.member_id, m.display_name
       FROM orders o JOIN members m ON m.id = o.member_id
       WHERE o.table_id = ? ORDER BY m.display_name`,
    )
    .all(tableId) as { member_id: string; display_name: string }[];
  let sort = 0;
  const ins = db.prepare(
    `INSERT INTO wheel_items(id, wheel_id, name, weight, ref_shop_id, ref_member_id, votes, sort)
     VALUES(?,?,?,?,?,?,?,?)`,
  );
  for (const p of people) {
    ins.run(randomUUID(), wheelId, p.display_name, 20, null, p.member_id, null, sort++);
  }
  db.prepare('UPDATE wheels SET version = version + 1 WHERE id = ?').run(wheelId);
}

export const tableCreate: Handler = (ctx, args: CommandArgs<'table.create'>): CmdOk => {
  const { db, member } = ctx;
  for (const sid of args.shopIds) {
    const s = db.prepare('SELECT id FROM shops WHERE id = ?').get(sid);
    if (!s) throw new CmdError('not_found', { what: 'shop', id: sid });
  }
  const date = new Date().toISOString().slice(0, 10);
  const voteEndsAt =
    args.voteEndsInSec != null && args.voteEndsInSec > 0
      ? new Date(Date.now() + args.voteEndsInSec * 1000).toISOString()
      : null;
  const info = db
    .prepare(
      `INSERT INTO tables(date, host_id, bill_mode, created_at, version, vote_ends_at)
       VALUES(?,?, 'item', ?, 1, ?)`,
    )
    .run(date, member.id, nowIso(), voteEndsAt);
  const tableId = Number(info.lastInsertRowid);
  const ins = db.prepare(
    `INSERT INTO table_shops(table_id, shop_id, added_by) VALUES(?,?,?)`,
  );
  for (const sid of args.shopIds) ins.run(tableId, sid, member.id);
  ensureTableWheels(ctx, tableId);
  return {
    result: { tableId, voteEndsAt },
    scopes: ['table:current', 'wheels', `table:${tableId}`],
  };
};

export const tableAddShop: Handler = (ctx, args: CommandArgs<'table.addShop'>): CmdOk => {
  const { db, member } = ctx;
  const tableId = currentTableId(db);
  if (tableId == null) throw new CmdError('no_table');
  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(args.shopId);
  if (!shop) throw new CmdError('not_found');
  const exists = db
    .prepare('SELECT 1 FROM table_shops WHERE table_id = ? AND shop_id = ?')
    .get(tableId, args.shopId);
  if (exists) throw new CmdError('already_added');
  db.prepare(`INSERT INTO table_shops(table_id, shop_id, added_by) VALUES(?,?,?)`).run(
    tableId,
    args.shopId,
    member.id,
  );
  bumpTableVersion(db, tableId);
  const shopWheel = db
    .prepare(`SELECT id FROM wheels WHERE table_id = ? AND kind = 'shop'`)
    .get(tableId) as { id: string } | undefined;
  if (shopWheel) syncShopWheelItems(db, shopWheel.id, tableId);
  else ensureTableWheels(ctx, tableId);
  return {
    result: { tableId, shopId: args.shopId },
    scopes: ['table:current', 'wheels', `table:${tableId}`],
  };
};

export const voteSet: Handler = (ctx, args: CommandArgs<'vote.set'>): CmdOk => {
  const { db, member } = ctx;
  const tableId = currentTableId(db);
  if (tableId == null) throw new CmdError('no_table');
  if (args.shopId == null) {
    db.prepare('DELETE FROM votes WHERE table_id = ? AND member_id = ?').run(tableId, member.id);
  } else {
    ensureShopOnTable(db, tableId, args.shopId);
    db.prepare(
      `INSERT INTO votes(table_id, member_id, shop_id, updated_at) VALUES(?,?,?,?)
       ON CONFLICT(table_id, member_id) DO UPDATE SET shop_id = excluded.shop_id, updated_at = excluded.updated_at`,
    ).run(tableId, member.id, args.shopId, nowIso());
  }
  bumpTableVersion(db, tableId);
  const shopWheel = db
    .prepare(`SELECT id FROM wheels WHERE table_id = ? AND kind = 'shop'`)
    .get(tableId) as { id: string } | undefined;
  if (shopWheel) syncShopWheelItems(db, shopWheel.id, tableId);
  return {
    result: { tableId, shopId: args.shopId },
    scopes: ['table:current', 'wheels', `table:${tableId}`, 'shops'],
  };
};

export const tableSetWinner: Handler = (ctx, args: CommandArgs<'table.setWinner'>): CmdOk => {
  const { db } = ctx;
  const tableId = currentTableId(db);
  if (tableId == null) throw new CmdError('no_table');
  ensureShopOnTable(db, tableId, args.shopId);

  if (args.spinId) {
    const spin = db
      .prepare(
        `SELECT s.id, s.result_index, s.items_json, w.table_id, w.kind
         FROM spins s JOIN wheels w ON w.id = s.wheel_id
         WHERE s.id = ?`,
      )
      .get(args.spinId) as
      | {
          id: string;
          result_index: number;
          items_json: string;
          table_id: number | null;
          kind: string;
        }
      | undefined;
    if (!spin || spin.table_id !== tableId || spin.kind !== 'shop') {
      throw new CmdError('bad_spin');
    }
    const items = JSON.parse(spin.items_json) as Array<{
      name: string;
      refShopId?: string | null;
    }>;
    const hit = items[spin.result_index];
    if (!hit || hit.refShopId !== args.shopId) throw new CmdError('bad_spin');
  }

  db.prepare(
    `UPDATE tables SET winner_shop_id = ?, winner_spin_id = ?, version = version + 1 WHERE id = ?`,
  ).run(args.shopId, args.spinId ?? null, tableId);
  return {
    result: { tableId, shopId: args.shopId, spinId: args.spinId ?? null },
    scopes: ['table:current', `table:${tableId}`, 'shops'],
  };
};

export const tableSetBill: Handler = (ctx, args: CommandArgs<'table.setBill'>): CmdOk => {
  const { db } = ctx;
  const tableId = currentTableId(db);
  if (tableId == null) throw new CmdError('no_table');
  db.prepare(
    `UPDATE tables SET bill_total = ?, bill_mode = ?, version = version + 1 WHERE id = ?`,
  ).run(args.total, args.mode, tableId);
  return {
    result: { tableId, total: args.total, mode: args.mode },
    scopes: ['table:current', `table:${tableId}`],
  };
};

export const tableSetResidualHost: Handler = (
  ctx,
  args: CommandArgs<'table.setResidualHost'>,
): CmdOk => {
  const { db } = ctx;
  const tableId = currentTableId(db);
  if (tableId == null) throw new CmdError('no_table');
  const mem = db.prepare(`SELECT id FROM members WHERE id = ? AND disabled = 0`).get(args.memberId);
  if (!mem) throw new CmdError('not_found');
  db.prepare(`UPDATE tables SET host_id = ?, version = version + 1 WHERE id = ?`).run(
    args.memberId,
    tableId,
  );
  return {
    result: { tableId, memberId: args.memberId },
    scopes: ['table:current', `table:${tableId}`],
  };
};

export const tableSetPickup: Handler = (ctx, args: CommandArgs<'table.setPickup'>): CmdOk => {
  const { db } = ctx;
  const tableId = currentTableId(db);
  if (tableId == null) throw new CmdError('no_table');

  const spin = db
    .prepare(
      `SELECT s.id, s.result_index, s.items_json, w.table_id, w.kind
       FROM spins s JOIN wheels w ON w.id = s.wheel_id
       WHERE s.id = ?`,
    )
    .get(args.spinId) as
    | {
        id: string;
        result_index: number;
        items_json: string;
        table_id: number | null;
        kind: string;
      }
    | undefined;
  if (!spin || spin.table_id !== tableId || spin.kind !== 'person') {
    throw new CmdError('bad_spin');
  }
  const items = JSON.parse(spin.items_json) as Array<{
    name: string;
    refMemberId?: string | null;
  }>;
  const hit = items[spin.result_index];
  if (!hit || hit.refMemberId !== args.memberId) throw new CmdError('bad_spin');

  const mem = db.prepare('SELECT id FROM members WHERE id = ?').get(args.memberId);
  if (!mem) throw new CmdError('not_found');

  db.prepare(
    `UPDATE tables SET pickup_member_id = ?, pickup_spin_id = ?, version = version + 1 WHERE id = ?`,
  ).run(args.memberId, args.spinId, tableId);
  return {
    result: { tableId, memberId: args.memberId, spinId: args.spinId },
    scopes: ['table:current', `table:${tableId}`],
  };
};
