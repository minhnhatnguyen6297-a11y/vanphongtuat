import { randomUUID } from 'node:crypto';
import { nowIso } from '../db.ts';
import { CmdError } from '../errors.ts';
import { currentTableId, canEditOrder } from '../perms.ts';
import { bumpTableVersion, bumpOrderVersion } from '../snapshots.ts';
import { syncPersonWheelItems } from './table.ts';
import type { CmdOk, Handler } from './types.ts';
import type { CommandArgs } from '../../shared/commands.ts';

function refreshPersonWheel(db: Parameters<Handler>[0]['db'], tableId: number) {
  const w = db
    .prepare(`SELECT id FROM wheels WHERE table_id = ? AND kind = 'person'`)
    .get(tableId) as { id: string } | undefined;
  if (w) syncPersonWheelItems(db, w.id, tableId);
}

export const orderAdd: Handler = (ctx, args: CommandArgs<'order.add'>): CmdOk => {
  const { db, member } = ctx;
  const tableId = currentTableId(db);
  if (tableId == null) throw new CmdError('no_table');
  const id = randomUUID();
  const now = nowIso();
  db.prepare(
    `INSERT INTO orders(id, table_id, member_id, text, price, created_at, updated_at, version)
     VALUES(?,?,?,?,?,?,?,1)`,
  ).run(id, tableId, member.id, args.text, args.price, now, now);
  bumpTableVersion(db, tableId);
  refreshPersonWheel(db, tableId);
  return {
    result: { id, tableId },
    scopes: ['table:current', `table:${tableId}`, 'wheels'],
  };
};

export const orderUpdate: Handler = (
  ctx,
  args: CommandArgs<'order.update'>,
  baseVersion?: number,
): CmdOk => {
  const { db, member } = ctx;
  const order = db
    .prepare(`SELECT id, table_id, member_id, version FROM orders WHERE id = ?`)
    .get(args.id) as
    | { id: string; table_id: number; member_id: string; version: number }
    | undefined;
  if (!order) throw new CmdError('not_found');
  if (!canEditOrder(db, member, order)) throw new CmdError('forbidden');
  if (baseVersion != null && baseVersion !== order.version) {
    throw new CmdError('conflict', {
      current: db
        .prepare(
          `SELECT id, table_id AS tableId, member_id AS memberId, text, price, version FROM orders WHERE id = ?`,
        )
        .get(args.id),
    });
  }
  db.prepare(`UPDATE orders SET text = ?, price = ?, updated_at = ? WHERE id = ?`).run(
    args.text,
    args.price,
    nowIso(),
    args.id,
  );
  const version = bumpOrderVersion(db, args.id);
  bumpTableVersion(db, order.table_id);
  return {
    result: { id: args.id, version },
    scopes: ['table:current', `table:${order.table_id}`],
  };
};

export const orderRemove: Handler = (
  ctx,
  args: CommandArgs<'order.remove'>,
  baseVersion?: number,
): CmdOk => {
  const { db, member } = ctx;
  const order = db
    .prepare(`SELECT id, table_id, member_id, version FROM orders WHERE id = ?`)
    .get(args.id) as
    | { id: string; table_id: number; member_id: string; version: number }
    | undefined;
  if (!order) throw new CmdError('not_found');
  if (!canEditOrder(db, member, order)) throw new CmdError('forbidden');
  if (baseVersion != null && baseVersion !== order.version) {
    throw new CmdError('conflict', { current: order });
  }
  db.prepare('DELETE FROM orders WHERE id = ?').run(args.id);
  bumpTableVersion(db, order.table_id);
  refreshPersonWheel(db, order.table_id);
  return {
    result: { id: args.id },
    scopes: ['table:current', `table:${order.table_id}`, 'wheels'],
  };
};
