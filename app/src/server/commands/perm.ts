import { nowIso, newId } from '../db.ts';
import { CmdError } from '../errors.ts';
import {
  applyMatrixRows,
  grantExpiresIso,
  setMemberTier,
} from '../perms.ts';
import {
  isNoGrantPerm,
  isPermKey,
  type PermKey,
  type Tier,
} from '../../shared/perms-catalog.ts';
import type { CmdOk, Handler } from './types.ts';
import type { CommandArgs } from '../../shared/commands.ts';

export const permSetMatrix: Handler = (ctx, args: CommandArgs<'perm.setMatrix'>): CmdOk => {
  const { db } = ctx;
  const entries = args.entries.map((e) => {
    if (!isPermKey(e.permKey)) throw new CmdError('invalid_args');
    if (isNoGrantPerm(e.permKey)) throw new CmdError('forbidden');
    return { tier: e.tier as Tier, permKey: e.permKey as PermKey, allowed: e.allowed };
  });
  applyMatrixRows(db, entries);
  return { result: { ok: true }, scopes: ['perms', 'members'] };
};

export const permSetTier: Handler = (ctx, args: CommandArgs<'perm.setTier'>): CmdOk => {
  const { db, member } = ctx;
  setMemberTier(db, member, args.memberId, args.tier);
  return {
    result: { memberId: args.memberId, tier: args.tier },
    scopes: ['members', 'perms'],
  };
};

export const permRequest: Handler = (ctx, args: CommandArgs<'perm.request'>): CmdOk => {
  const { db, member } = ctx;
  if (!isPermKey(args.permKey)) throw new CmdError('invalid_args');
  if (isNoGrantPerm(args.permKey)) throw new CmdError('forbidden');

  const pending = db
    .prepare(
      `SELECT id FROM perm_requests
       WHERE member_id = ? AND perm_key = ? AND status = 'pending'`,
    )
    .get(member.id, args.permKey);
  if (pending) throw new CmdError('already_pending');

  const id = newId();
  db.prepare(
    `INSERT INTO perm_requests(id, member_id, perm_key, status, created_at)
     VALUES(?,?,?, 'pending', ?)`,
  ).run(id, member.id, args.permKey, nowIso());
  return { result: { id, permKey: args.permKey }, scopes: ['perms'] };
};

export const permApprove: Handler = (ctx, args: CommandArgs<'perm.approve'>): CmdOk => {
  const { db, member } = ctx;
  const req = db
    .prepare(
      `SELECT id, member_id, perm_key, status FROM perm_requests WHERE id = ?`,
    )
    .get(args.requestId) as
    | { id: string; member_id: string; perm_key: string; status: string }
    | undefined;
  if (!req) throw new CmdError('not_found');
  if (req.status !== 'pending') throw new CmdError('not_pending');
  if (!isPermKey(req.perm_key) || isNoGrantPerm(req.perm_key)) throw new CmdError('forbidden');

  const now = nowIso();
  const expires = grantExpiresIso();
  const grantId = newId();
  db.prepare(
    `UPDATE perm_requests SET status = 'approved', decided_by = ?, decided_at = ? WHERE id = ?`,
  ).run(member.id, now, req.id);
  db.prepare(
    `INSERT INTO perm_grants(id, member_id, perm_key, granted_by, expires_at, created_at)
     VALUES(?,?,?,?,?,?)`,
  ).run(grantId, req.member_id, req.perm_key, member.id, expires, now);

  return {
    result: { requestId: req.id, grantId, expiresAt: expires },
    scopes: ['perms', 'members'],
  };
};

export const permDeny: Handler = (ctx, args: CommandArgs<'perm.deny'>): CmdOk => {
  const { db, member } = ctx;
  const req = db
    .prepare(`SELECT id, status FROM perm_requests WHERE id = ?`)
    .get(args.requestId) as { id: string; status: string } | undefined;
  if (!req) throw new CmdError('not_found');
  if (req.status !== 'pending') throw new CmdError('not_pending');

  db.prepare(
    `UPDATE perm_requests SET status = 'denied', decided_by = ?, decided_at = ? WHERE id = ?`,
  ).run(member.id, nowIso(), req.id);
  return { result: { requestId: req.id }, scopes: ['perms'] };
};
