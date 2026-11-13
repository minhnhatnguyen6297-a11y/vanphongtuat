import { randomUUID } from 'node:crypto';
import { nowIso } from '../db.ts';
import { CmdError } from '../errors.ts';
import { hasPerm, type AuthMember } from '../perms.ts';
import type { Db } from '../db.ts';
import type { ChatEvent, ChatMsg, CmdOk, Handler } from './types.ts';
import type { CommandArgs } from '../../shared/commands.ts';
import { LOBBY_CHAT_SCOPE } from '../../shared/chat.ts';

export type { ChatEvent, ChatMsg };

const BODY_MAX = 500;
const RATE_MS = 500; // ~2 tin/s
const OWNER_DELETE_MS = 2 * 60 * 1000;
const SNAP_LIMIT = 100;

const lastSendAt = new Map<string, number>();

/** Test helper — xóa rate limit in-memory. */
export function resetChatRateLimit(): void {
  lastSendAt.clear();
}

const SCOPE_RE = /^(table:\d+|wheel:[0-9a-f-]{36}|game:[0-9a-f-]{36}|lobby)$/i;

export function parseChatScope(raw: string): string | null {
  const s = String(raw || '').trim();
  return SCOPE_RE.test(s) ? s : null;
}

/** Hello sub key: chat:table:1 | chat:wheel:uuid | chat:game:uuid | chat:lobby */
export function chatSubKey(scope: string): `chat:${string}` {
  return `chat:${scope}`;
}

export function parseChatSub(sub: string): string | null {
  if (!sub.startsWith('chat:')) return null;
  return parseChatScope(sub.slice(5));
}

export function canAccessChatScope(db: Db, member: AuthMember, scope: string): boolean {
  if (member.disabled) return false;
  const parsed = parseChatScope(scope);
  if (!parsed) return false;

  if (parsed === LOBBY_CHAT_SCOPE) {
    return true;
  }
  if (parsed.startsWith('table:')) {
    const id = Number(parsed.slice(6));
    const row = db.prepare('SELECT id FROM tables WHERE id = ?').get(id);
    return !!row;
  }
  if (parsed.startsWith('wheel:')) {
    const id = parsed.slice(6);
    const row = db.prepare('SELECT id FROM wheels WHERE id = ?').get(id);
    return !!row;
  }
  if (parsed.startsWith('game:')) {
    const roomId = parsed.slice(5);
    const row = db
      .prepare('SELECT 1 AS ok FROM game_members WHERE room_id = ? AND member_id = ?')
      .get(roomId, member.id);
    return !!row;
  }
  return false;
}

function rowToMsg(r: {
  id: string;
  scope: string;
  member_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}): ChatMsg {
  return {
    id: r.id,
    scope: r.scope,
    memberId: r.member_id,
    body: r.deleted_at ? '' : r.body,
    createdAt: r.created_at,
    deletedAt: r.deleted_at,
    deletedBy: r.deleted_by,
  };
}

export function loadChatSnap(db: Db, scope: string): { scope: string; messages: ChatMsg[] } {
  const rows = db
    .prepare(
      `SELECT id, scope, member_id, body, created_at, deleted_at, deleted_by
       FROM chat_messages WHERE scope = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(scope, SNAP_LIMIT) as Array<{
    id: string;
    scope: string;
    member_id: string;
    body: string;
    created_at: string;
    deleted_at: string | null;
    deleted_by: string | null;
  }>;
  const messages = rows.reverse().map(rowToMsg);
  return { scope, messages };
}

export const chatSend: Handler = (ctx, args: CommandArgs<'chat.send'>): CmdOk => {
  const { db, member } = ctx;
  const scope = parseChatScope(args.scope);
  if (!scope) throw new CmdError('invalid_args');
  if (!canAccessChatScope(db, member, scope)) throw new CmdError('forbidden');
  if (!hasPerm(db, member.id, 'chat.send')) throw new CmdError('forbidden');

  const body = String(args.body ?? '').trim();
  if (!body || body.length > BODY_MAX) throw new CmdError('invalid_args');

  const now = Date.now();
  const prev = lastSendAt.get(member.id) ?? 0;
  if (now - prev < RATE_MS) throw new CmdError('rate_limited');
  lastSendAt.set(member.id, now);

  const id = randomUUID();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO chat_messages(id, scope, member_id, body, created_at, deleted_at, deleted_by)
     VALUES(?,?,?,?,?,NULL,NULL)`,
  ).run(id, scope, member.id, body, createdAt);

  const msg: ChatMsg = {
    id,
    scope,
    memberId: member.id,
    body,
    createdAt,
    deletedAt: null,
    deletedBy: null,
  };
  const event: ChatEvent = { t: 'chat', scope, msg };
  return { result: { id }, scopes: [], events: [event] };
};

export const chatDelete: Handler = (ctx, args: CommandArgs<'chat.delete'>): CmdOk => {
  const { db, member } = ctx;
  const row = db
    .prepare(
      `SELECT id, scope, member_id, body, created_at, deleted_at, deleted_by
       FROM chat_messages WHERE id = ?`,
    )
    .get(args.id) as
    | {
        id: string;
        scope: string;
        member_id: string;
        body: string;
        created_at: string;
        deleted_at: string | null;
        deleted_by: string | null;
      }
    | undefined;
  if (!row) throw new CmdError('not_found');
  if (row.deleted_at) {
    const msg = rowToMsg(row);
    return {
      result: { id: row.id },
      scopes: [],
      events: [{ t: 'chat', scope: row.scope, msg }],
    };
  }
  if (!canAccessChatScope(db, member, row.scope)) throw new CmdError('forbidden');

  const isOwner = row.member_id === member.id;
  const createdMs = new Date(row.created_at).getTime();
  const withinOwnerWindow = isOwner && Date.now() - createdMs <= OWNER_DELETE_MS;
  const isMod = hasPerm(db, member.id, 'chat.mod');
  if (!withinOwnerWindow && !isMod) throw new CmdError('forbidden');

  const deletedAt = nowIso();
  db.prepare(`UPDATE chat_messages SET deleted_at = ?, deleted_by = ?, body = '' WHERE id = ?`).run(
    deletedAt,
    member.id,
    row.id,
  );

  const msg: ChatMsg = {
    id: row.id,
    scope: row.scope,
    memberId: row.member_id,
    body: '',
    createdAt: row.created_at,
    deletedAt,
    deletedBy: member.id,
  };
  return {
    result: { id: row.id },
    scopes: [],
    events: [{ t: 'chat', scope: row.scope, msg }],
  };
};
