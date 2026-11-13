import type { Db } from '../db.ts';
import type { AuthMember } from '../perms.ts';
import type { ScopeName } from '../../shared/types.ts';

export type ChatMsg = {
  id: string;
  scope: string;
  memberId: string;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
};

export type ChatEvent = { t: 'chat'; scope: string; msg: ChatMsg };

export type CmdCtx = {
  db: Db;
  member: AuthMember;
};

export type CmdOk = {
  result: unknown;
  scopes: ScopeName[];
  events?: ChatEvent[];
};

export type Handler = (ctx: CmdCtx, args: any, baseVersion?: number) => CmdOk;
