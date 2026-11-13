import { hashPin, verifyPin, randomPin } from '../auth.ts';
import { CmdError } from '../errors.ts';
import { getMemberTier, setMemberTier } from '../perms.ts';
import { nowIso, newId } from '../db.ts';
import { isAvatarId } from '../../shared/avatars.ts';
import type { CmdOk, Handler } from './types.ts';
import type { CommandArgs } from '../../shared/commands.ts';

export const memberUpdateProfile: Handler = (ctx, args: CommandArgs<'member.updateProfile'>): CmdOk => {
  const { db, member } = ctx;
  const row = db
    .prepare(
      `SELECT display_name, avatar_id, bank_bin, bank_account, bank_name_display FROM members WHERE id = ?`,
    )
    .get(member.id) as {
    display_name: string;
    avatar_id: string | null;
    bank_bin: string | null;
    bank_account: string | null;
    bank_name_display: string | null;
  };

  let avatarId = row.avatar_id;
  if (args.avatarId !== undefined) {
    if (args.avatarId == null || args.avatarId === '') avatarId = null;
    else if (!isAvatarId(args.avatarId)) throw new CmdError('bad_args', { field: 'avatarId' });
    else avatarId = args.avatarId;
  }

  db.prepare(
    `UPDATE members SET display_name = ?, avatar_id = ?, bank_bin = ?, bank_account = ?, bank_name_display = ?
     WHERE id = ?`,
  ).run(
    args.displayName ?? row.display_name,
    avatarId,
    args.bankBin !== undefined ? args.bankBin : row.bank_bin,
    args.bankAccount !== undefined ? args.bankAccount : row.bank_account,
    args.bankNameDisplay !== undefined ? args.bankNameDisplay : row.bank_name_display,
    member.id,
  );
  return { result: { id: member.id, avatarId }, scopes: ['members'] };
};

export const memberChangePin: Handler = (ctx, args: CommandArgs<'member.changePin'>): CmdOk => {
  const { db, member } = ctx;
  const row = db.prepare(`SELECT pin_hash, pin_salt FROM members WHERE id = ?`).get(member.id) as {
    pin_hash: Buffer;
    pin_salt: Buffer;
  };
  if (!verifyPin(args.oldPin, row.pin_hash, row.pin_salt)) throw new CmdError('bad_pin');
  const { hash, salt } = hashPin(args.newPin);
  db.prepare(`UPDATE members SET pin_hash = ?, pin_salt = ? WHERE id = ?`).run(hash, salt, member.id);
  return { result: { ok: true }, scopes: [] };
};

export const adminAddMember: Handler = (ctx, args: CommandArgs<'admin.addMember'>): CmdOk => {
  const { db } = ctx;
  const exists = db
    .prepare(`SELECT id FROM members WHERE username = ? COLLATE NOCASE`)
    .get(args.username);
  if (exists) throw new CmdError('username_taken');
  const pin = randomPin();
  const { hash, salt } = hashPin(pin);
  const id = newId();
  db.prepare(
    `INSERT INTO members(id, username, display_name, pin_hash, pin_salt, is_operator, tier, disabled, created_at)
     VALUES(?,?,?,?,?,0,'dan_den',0,?)`,
  ).run(id, args.username.toLowerCase(), args.displayName, hash, salt, nowIso());
  return { result: { id, username: args.username.toLowerCase(), pin }, scopes: ['members'] };
};

export const adminResetPin: Handler = (ctx, args: CommandArgs<'admin.resetPin'>): CmdOk => {
  const { db } = ctx;
  const row = db.prepare(`SELECT id FROM members WHERE id = ?`).get(args.memberId);
  if (!row) throw new CmdError('not_found');
  const pin = randomPin();
  const { hash, salt } = hashPin(pin);
  db.prepare(`UPDATE members SET pin_hash = ?, pin_salt = ? WHERE id = ?`).run(
    hash,
    salt,
    args.memberId,
  );
  return { result: { memberId: args.memberId, pin }, scopes: [] };
};

export const adminDisable: Handler = (ctx, args: CommandArgs<'admin.disable'>): CmdOk => {
  const { db, member } = ctx;
  if (args.memberId === member.id) throw new CmdError('cannot_disable_self');
  const row = db.prepare(`SELECT id FROM members WHERE id = ?`).get(args.memberId);
  if (!row) throw new CmdError('not_found');
  if (getMemberTier(db, args.memberId) === 'chu_xi' && member.tier !== 'chu_xi') {
    throw new CmdError('forbidden');
  }
  db.prepare(`UPDATE members SET disabled = ? WHERE id = ?`).run(args.disabled ? 1 : 0, args.memberId);
  if (args.disabled) {
    db.prepare(`UPDATE auth_sessions SET revoked = 1 WHERE member_id = ?`).run(args.memberId);
  }
  return { result: { memberId: args.memberId, disabled: args.disabled }, scopes: ['members'] };
};

/** Đồng bộ tier: operator ↔ chu_xi (cùng invariant last chu_xi). */
export const adminSetOperator: Handler = (ctx, args: CommandArgs<'admin.setOperator'>): CmdOk => {
  const { db, member } = ctx;
  setMemberTier(db, member, args.memberId, args.isOperator ? 'chu_xi' : 'dan_den');
  return {
    result: {
      memberId: args.memberId,
      isOperator: args.isOperator,
      tier: args.isOperator ? 'chu_xi' : 'dan_den',
    },
    scopes: ['members', 'perms'],
  };
};
