import type { Db } from './db.ts';
import { nowIso } from './db.ts';
import { parseCommand, VERSIONED_COMMANDS, type CommandName } from '../shared/commands.ts';
import { assertCommandAllowed, type AuthMember } from './perms.ts';
import { handlers } from './commands/index.ts';
import { CmdError } from './errors.ts';
import type { ScopeName } from '../shared/types.ts';
import type { ChatEvent } from './commands/types.ts';

export type DispatchAck =
  | {
      t: 'ack';
      opId: string;
      ok: true;
      result: unknown;
      scopes: ScopeName[];
      events?: ChatEvent[];
    }
  | { t: 'ack'; opId: string; ok: false; error: string; [k: string]: unknown };

export function dispatchCommand(
  db: Db,
  member: AuthMember,
  msg: { opId: string; name: string; args?: unknown; baseVersion?: number },
): DispatchAck {
  const { opId, name, args, baseVersion } = msg;
  if (!opId || typeof opId !== 'string') {
    return { t: 'ack', opId: opId || '', ok: false, error: 'invalid_opid' };
  }

  const cached = db.prepare('SELECT result_json FROM ops WHERE op_id = ?').get(opId) as
    | { result_json: string }
    | undefined;
  if (cached) {
    return JSON.parse(cached.result_json) as DispatchAck;
  }

  const parsed = parseCommand(name, args);
  if ('error' in parsed) {
    return { t: 'ack', opId, ok: false, error: parsed.error, details: parsed.details };
  }

  const cmdName = parsed.name as CommandName;
  const cmdArgs = parsed.args as Record<string, unknown>;

  try {
    const run = db.transaction(() => {
      // re-check cache inside txn
      const again = db.prepare('SELECT result_json FROM ops WHERE op_id = ?').get(opId) as
        | { result_json: string }
        | undefined;
      if (again) return JSON.parse(again.result_json) as DispatchAck;

      assertCommandAllowed(db, member, cmdName, cmdArgs);

      if (VERSIONED_COMMANDS.has(cmdName) && baseVersion === undefined) {
        // baseVersion optional for create-like paths inside versioned names; handlers decide
      }

      const handler = handlers[cmdName];
      const ok = handler({ db, member }, cmdArgs, baseVersion);
      const ack: DispatchAck = {
        t: 'ack',
        opId,
        ok: true,
        result: ok.result,
        scopes: ok.scopes,
        ...(ok.events?.length ? { events: ok.events } : {}),
      };
      db.prepare(
        `INSERT INTO ops(op_id, member_id, name, result_json, created_at) VALUES(?,?,?,?,?)`,
      ).run(opId, member.id, cmdName, JSON.stringify(ack), nowIso());
      return ack;
    });
    return run();
  } catch (e) {
    if (e instanceof CmdError) {
      const ack = e.toAck(opId) as DispatchAck;
      // Store business outcomes for idempotent retries (conflict/spinning/forbidden/…)
      try {
        db.prepare(
          `INSERT OR IGNORE INTO ops(op_id, member_id, name, result_json, created_at) VALUES(?,?,?,?,?)`,
        ).run(opId, member.id, cmdName, JSON.stringify(ack), nowIso());
      } catch {
        /* ignore */
      }
      return ack;
    }
    console.error('dispatch error', e);
    return { t: 'ack', opId, ok: false, error: 'internal' };
  }
}
