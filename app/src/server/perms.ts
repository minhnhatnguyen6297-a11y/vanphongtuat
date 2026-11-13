import type { Db } from './db.ts';
import { CmdError } from './errors.ts';
import type { CommandName } from '../shared/commands.ts';
import {
  DEFAULT_MATRIX,
  GRANT_TTL_MS,
  PERM_KEYS,
  TIERS,
  isNoGrantPerm,
  isPermKey,
  isTier,
  type PermKey,
  type Tier,
} from '../shared/perms-catalog.ts';

export type AuthMember = {
  id: string;
  username: string;
  displayName: string;
  isOperator: boolean;
  tier: Tier;
  avatarId: string | null;
  disabled: boolean;
};

export function requireOperator(member: AuthMember) {
  if (!member.isOperator && member.tier !== 'chu_xi') throw new CmdError('forbidden');
}

export function currentTableId(db: Db): number | null {
  const row = db.prepare('SELECT id FROM tables ORDER BY id DESC LIMIT 1').get() as
    | { id: number }
    | undefined;
  return row?.id ?? null;
}

export function getTableHost(db: Db, tableId: number): string | null {
  const row = db.prepare('SELECT host_id FROM tables WHERE id = ?').get(tableId) as
    | { host_id: string }
    | undefined;
  return row?.host_id ?? null;
}

/** @deprecated host_id chỉ gánh lẻ — không authorize. Giữ cho compat gọi cũ. */
export function requireHost(db: Db, member: AuthMember, tableId: number) {
  const host = getTableHost(db, tableId);
  if (!host || host !== member.id) throw new CmdError('forbidden');
}

export function getMemberTier(db: Db, memberId: string): Tier {
  const row = db.prepare(`SELECT tier FROM members WHERE id = ?`).get(memberId) as
    | { tier: string }
    | undefined;
  return isTier(row?.tier) ? row.tier : 'dan_den';
}

export function countActiveChuXi(db: Db, exceptMemberId?: string): number {
  if (exceptMemberId) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS c FROM members WHERE tier = 'chu_xi' AND disabled = 0 AND id != ?`,
      )
      .get(exceptMemberId) as { c: number };
    return row.c;
  }
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM members WHERE tier = 'chu_xi' AND disabled = 0`)
    .get() as { c: number };
  return row.c;
}

export function hasPerm(db: Db, memberId: string, perm: PermKey, nowMs = Date.now()): boolean {
  const tier = getMemberTier(db, memberId);
  const row = db
    .prepare(`SELECT allowed FROM role_permissions WHERE tier = ? AND perm_key = ?`)
    .get(tier, perm) as { allowed: number } | undefined;
  if (row?.allowed) return true;

  if (isNoGrantPerm(perm)) return false;

  const nowIso = new Date(nowMs).toISOString();
  const grant = db
    .prepare(
      `SELECT 1 AS ok FROM perm_grants
       WHERE member_id = ? AND perm_key = ? AND expires_at > ?
       LIMIT 1`,
    )
    .get(memberId, perm, nowIso) as { ok: number } | undefined;
  return !!grant;
}

export function requirePerm(db: Db, member: AuthMember, perm: PermKey) {
  if (member.disabled) throw new CmdError('forbidden');
  if (!hasPerm(db, member.id, perm)) throw new CmdError('forbidden');
}

export function canEditOrder(
  db: Db,
  member: AuthMember,
  order: { member_id: string; table_id: number },
): boolean {
  if (order.member_id === member.id) return hasPerm(db, member.id, 'order');
  return hasPerm(db, member.id, 'order.edit_others');
}

/** Ma trận sau khi apply: ≥1 tầng còn setWinner và ≥1 tầng còn setBill. */
export function assertMatrixHasWinnerAndBill(
  rows: Array<{ tier: string; perm_key: string; allowed: number }>,
): void {
  let hasWinner = false;
  let hasBill = false;
  for (const r of rows) {
    if (!r.allowed) continue;
    if (r.perm_key === 'table.setWinner') hasWinner = true;
    if (r.perm_key === 'table.setBill') hasBill = true;
  }
  if (!hasWinner || !hasBill) throw new CmdError('matrix_invariant');
}

export function loadMatrixRows(db: Db): Array<{ tier: string; perm_key: string; allowed: number }> {
  return db
    .prepare(`SELECT tier, perm_key, allowed FROM role_permissions`)
    .all() as Array<{ tier: string; perm_key: string; allowed: number }>;
}

export function applyMatrixRows(
  db: Db,
  entries: Array<{ tier: Tier; permKey: PermKey; allowed: boolean }>,
): void {
  for (const e of entries) {
    if (isNoGrantPerm(e.permKey)) throw new CmdError('forbidden');
  }

  const byKey = new Map<string, boolean>();
  for (const e of entries) {
    byKey.set(`${e.tier}\0${e.permKey}`, e.allowed);
  }

  const next: Array<{ tier: string; perm_key: string; allowed: number }> = [];
  for (const tier of TIERS) {
    for (const permKey of PERM_KEYS) {
      let allowed: boolean;
      if (isNoGrantPerm(permKey)) {
        allowed = DEFAULT_MATRIX[tier].has(permKey);
      } else if (byKey.has(`${tier}\0${permKey}`)) {
        allowed = byKey.get(`${tier}\0${permKey}`)!;
      } else {
        const cur = db
          .prepare(`SELECT allowed FROM role_permissions WHERE tier = ? AND perm_key = ?`)
          .get(tier, permKey) as { allowed: number } | undefined;
        allowed = cur ? !!cur.allowed : DEFAULT_MATRIX[tier].has(permKey);
      }
      next.push({ tier, perm_key: permKey, allowed: allowed ? 1 : 0 });
    }
  }

  assertMatrixHasWinnerAndBill(next);

  const upsert = db.prepare(
    `INSERT INTO role_permissions(tier, perm_key, allowed) VALUES(?,?,?)
     ON CONFLICT(tier, perm_key) DO UPDATE SET allowed = excluded.allowed`,
  );
  for (const r of next) upsert.run(r.tier, r.perm_key, r.allowed);
}

/** Gán tầng + sync is_operator. Invariant ≥1 chu_xi. */
export function setMemberTier(
  db: Db,
  actor: AuthMember | null,
  memberId: string,
  tier: Tier,
): void {
  if (!isTier(tier)) throw new CmdError('invalid_args');

  const target = db
    .prepare(`SELECT id, tier, disabled FROM members WHERE id = ?`)
    .get(memberId) as { id: string; tier: string; disabled: number } | undefined;
  if (!target) throw new CmdError('not_found');

  const currentTier = isTier(target.tier) ? target.tier : 'dan_den';

  if (actor) {
    if (tier === 'chu_xi' && actor.tier !== 'chu_xi') throw new CmdError('forbidden');
    if (currentTier === 'chu_xi' && tier !== 'chu_xi' && actor.tier !== 'chu_xi') {
      throw new CmdError('forbidden');
    }
  }

  if (currentTier === 'chu_xi' && tier !== 'chu_xi') {
    if (countActiveChuXi(db, memberId) < 1) throw new CmdError('last_chu_xi');
  }

  db.prepare(`UPDATE members SET tier = ?, is_operator = ? WHERE id = ?`).run(
    tier,
    tier === 'chu_xi' ? 1 : 0,
    memberId,
  );
}

export function grantExpiresIso(fromMs = Date.now()): string {
  return new Date(fromMs + GRANT_TTL_MS).toISOString();
}

function resolveCommandPerm(
  db: Db,
  member: AuthMember,
  name: CommandName,
  args: Record<string, unknown>,
): PermKey | 'self' {
  switch (name) {
    case 'vote.set':
      return 'vote';
    case 'order.add':
      return 'order';
    case 'order.update':
    case 'order.remove': {
      const id = String(args.id || '');
      const order = db
        .prepare('SELECT member_id, table_id FROM orders WHERE id = ?')
        .get(id) as { member_id: string; table_id: number } | undefined;
      if (!order) throw new CmdError('not_found');
      if (order.member_id === member.id) return 'order';
      return 'order.edit_others';
    }
    case 'table.create':
      return 'table.create';
    case 'table.addShop':
      return 'table.addShop';
    case 'table.setWinner':
      return 'table.setWinner';
    case 'table.setBill':
    case 'table.setResidualHost':
      return 'table.setBill';
    case 'table.setPickup':
      return 'table.setPickup';
    case 'shop.upsert':
      return args.id ? 'shop.edit' : 'shop.add';
    case 'shop.setMenu':
      return 'shop.edit';
    case 'shop.delete':
      return 'shop.delete';
    case 'wheel.create':
      return 'wheel.create';
    case 'wheel.rename':
    case 'wheel.item.add':
    case 'wheel.item.update':
    case 'wheel.item.remove':
    case 'wheel.equalize':
    case 'wheel.byVote':
      return 'wheel.edit';
    case 'wheel.delete':
      return 'wheel.delete';
    case 'wheel.spin':
      return 'wheel.spin';
    case 'chat.send':
      return 'chat.send';
    case 'chat.delete':
      // handler tự check owner 2 phút ∪ chat.mod
      return 'self';
    case 'perm.setMatrix':
    case 'perm.setTier':
      return 'perm.manage';
    case 'perm.approve':
    case 'perm.deny':
      return 'perm.approve';
    case 'perm.request':
    case 'member.updateProfile':
    case 'member.changePin':
      return 'self';
    case 'admin.addMember':
    case 'admin.resetPin':
    case 'admin.disable':
    case 'admin.setOperator':
      return 'member.admin';
    case 'game.create':
    case 'game.start':
      return 'game.host';
    case 'game.join':
      return args.as === 'spectate' ? 'game.spectate' : 'game.play';
    case 'game.move': {
      // Cần game.play; host seat vẫn OK (spec §6.1)
      const roomId = String(args.roomId ?? '');
      const seat = db
        .prepare(`SELECT seat FROM game_members WHERE room_id = ? AND member_id = ?`)
        .get(roomId, member.id) as { seat: string } | undefined;
      if (seat?.seat === 'host') return 'self';
      return 'game.play';
    }
    case 'game.leave':
      return 'self';
    default:
      throw new CmdError('unknown_command');
  }
}

/** Authorize ghi bằng hasPerm — không requireHost. */
export function assertCommandAllowed(
  db: Db,
  member: AuthMember,
  name: CommandName,
  args: Record<string, unknown>,
): void {
  if (member.disabled) throw new CmdError('forbidden');

  const need = resolveCommandPerm(db, member, name, args);
  if (need === 'self') return;

  if (!isPermKey(need)) throw new CmdError('forbidden');
  if (!hasPerm(db, member.id, need)) throw new CmdError('forbidden');

  if (name === 'admin.disable' || name === 'admin.setOperator' || name === 'admin.resetPin') {
    const targetId = String(args.memberId || '');
    const targetTier = getMemberTier(db, targetId);
    if (targetTier === 'chu_xi' && member.tier !== 'chu_xi') {
      throw new CmdError('forbidden');
    }
  }
}
