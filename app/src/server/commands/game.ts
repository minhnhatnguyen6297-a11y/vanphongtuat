import { randomInt, randomUUID } from 'node:crypto';
import { CmdError } from '../errors.ts';
import { nowIso, type Db } from '../db.ts';
import { emptyCaro, applyCaroMove, type CaroState } from '../../shared/game-caro.ts';
import {
  emptyCaNgua,
  applyCaNguaMove,
  type CaNguaState,
} from '../../shared/game-ca-ngua.ts';
import {
  emptyTiPhu,
  applyTiPhuMove,
  type TiPhuState,
} from '../../shared/game-ti-phu.ts';
import type { CmdOk, Handler } from './types.ts';
import type { CommandArgs } from '../../shared/commands.ts';

export type GameKind = 'caro' | 'ca_ngua' | 'ti_phu';
export type GameSeat = 'host' | 'player' | 'spectator';
export type GameStatus = 'open' | 'playing' | 'ended';

type RoomRow = {
  id: string;
  kind: GameKind;
  title: string;
  status: GameStatus;
  host_id: string;
  state_json: string;
  version: number;
};

function getRoom(db: Db, id: string): RoomRow | undefined {
  return db
    .prepare(
      `SELECT id, kind, title, status, host_id, state_json, version FROM game_rooms WHERE id = ?`,
    )
    .get(id) as RoomRow | undefined;
}

function getSeat(db: Db, roomId: string, memberId: string): GameSeat | null {
  const row = db
    .prepare(`SELECT seat FROM game_members WHERE room_id = ? AND member_id = ?`)
    .get(roomId, memberId) as { seat: GameSeat } | undefined;
  return row?.seat ?? null;
}

function bumpRoom(db: Db, roomId: string, patch?: { status?: GameStatus; stateJson?: string }) {
  const now = nowIso();
  if (patch?.status != null && patch.stateJson != null) {
    db.prepare(
      `UPDATE game_rooms SET version = version + 1, updated_at = ?, status = ?, state_json = ? WHERE id = ?`,
    ).run(now, patch.status, patch.stateJson, roomId);
  } else if (patch?.status != null) {
    db.prepare(
      `UPDATE game_rooms SET version = version + 1, updated_at = ?, status = ? WHERE id = ?`,
    ).run(now, patch.status, roomId);
  } else if (patch?.stateJson != null) {
    db.prepare(
      `UPDATE game_rooms SET version = version + 1, updated_at = ?, state_json = ? WHERE id = ?`,
    ).run(now, patch.stateJson, roomId);
  } else {
    db.prepare(`UPDATE game_rooms SET version = version + 1, updated_at = ? WHERE id = ?`).run(
      now,
      roomId,
    );
  }
  const row = db.prepare(`SELECT version FROM game_rooms WHERE id = ?`).get(roomId) as {
    version: number;
  };
  return row.version;
}

function listPlayers(db: Db, roomId: string): Array<{ memberId: string; seat: GameSeat }> {
  return (
    db
      .prepare(
        `SELECT member_id AS memberId, seat FROM game_members
         WHERE room_id = ? AND seat IN ('host','player') ORDER BY joined_at`,
      )
      .all(roomId) as Array<{ memberId: string; seat: GameSeat }>
  );
}

function parseCaro(json: string): CaroState {
  return JSON.parse(json) as CaroState;
}

export const gameCreate: Handler = (ctx, args: CommandArgs<'game.create'>): CmdOk => {
  const { db, member } = ctx;
  const kind = args.kind as GameKind;
  if (kind !== 'caro' && kind !== 'ca_ngua' && kind !== 'ti_phu') {
    throw new CmdError('unsupported_kind');
  }
  const id = randomUUID();
  const now = nowIso();
  const stateJson =
    kind === 'caro'
      ? JSON.stringify(emptyCaro([member.id]))
      : kind === 'ca_ngua'
        ? JSON.stringify(emptyCaNgua([member.id]))
        : JSON.stringify(emptyTiPhu([member.id]));
  db.prepare(
    `INSERT INTO game_rooms(id, kind, title, status, host_id, state_json, created_at, updated_at, version)
     VALUES(?,?,?,'open',?,?,?,?,1)`,
  ).run(id, kind, args.title, member.id, stateJson, now, now);
  db.prepare(
    `INSERT INTO game_members(room_id, member_id, seat, joined_at) VALUES(?,?, 'host', ?)`,
  ).run(id, member.id, now);
  return { result: { id }, scopes: ['games'] };
};

export const gameJoin: Handler = (ctx, args: CommandArgs<'game.join'>): CmdOk => {
  const { db, member } = ctx;
  const room = getRoom(db, args.roomId);
  if (!room) throw new CmdError('not_found');
  if (room.status === 'ended') throw new CmdError('ended');

  const existing = getSeat(db, room.id, member.id);
  if (existing) {
    return { result: { roomId: room.id, seat: existing }, scopes: ['games'] };
  }

  let seat: GameSeat;
  if (args.as === 'spectate') {
    seat = 'spectator';
  } else {
    if (room.status !== 'open') throw new CmdError('already_started');
    const players = listPlayers(db, room.id);
    const maxPlayers = room.kind === 'caro' ? 2 : room.kind === 'ca_ngua' ? 4 : 6;
    if (players.length >= maxPlayers) throw new CmdError('room_full');
    seat = 'player';
  }

  db.prepare(
    `INSERT INTO game_members(room_id, member_id, seat, joined_at) VALUES(?,?,?,?)`,
  ).run(room.id, member.id, seat, nowIso());
  bumpRoom(db, room.id);
  return { result: { roomId: room.id, seat }, scopes: ['games'] };
};

export const gameLeave: Handler = (ctx, args: CommandArgs<'game.leave'>): CmdOk => {
  const { db, member } = ctx;
  const room = getRoom(db, args.roomId);
  if (!room) throw new CmdError('not_found');
  const seat = getSeat(db, room.id, member.id);
  if (!seat) throw new CmdError('not_found');
  if (seat === 'host' && room.status === 'open') {
    // host rời khi open → đóng phòng
    db.prepare(`DELETE FROM game_members WHERE room_id = ?`).run(room.id);
    db.prepare(`DELETE FROM game_rooms WHERE id = ?`).run(room.id);
    return { result: { left: true, closed: true }, scopes: ['games'] };
  }
  // Đang chơi: giữ ghế host/player để vào lại không bị đẩy sang spectator.
  if (room.status === 'playing' && (seat === 'host' || seat === 'player')) {
    return { result: { left: true, seatKept: true, seat }, scopes: ['games'] };
  }
  db.prepare(`DELETE FROM game_members WHERE room_id = ? AND member_id = ?`).run(
    room.id,
    member.id,
  );
  bumpRoom(db, room.id);
  return { result: { left: true }, scopes: ['games'] };
};

export const gameStart: Handler = (ctx, args: CommandArgs<'game.start'>): CmdOk => {
  const { db, member } = ctx;
  const room = getRoom(db, args.roomId);
  if (!room) throw new CmdError('not_found');
  if (room.host_id !== member.id) throw new CmdError('forbidden');
  if (getSeat(db, room.id, member.id) !== 'host') throw new CmdError('forbidden');
  if (room.status !== 'open') throw new CmdError('already_started');

  const players = listPlayers(db, room.id);
  const playerIds = players.map((p) => p.memberId);
  const ordered = [
    ...playerIds.filter((id) => id === room.host_id),
    ...playerIds.filter((id) => id !== room.host_id),
  ];

  if (room.kind === 'caro') {
    if (players.length !== 2) throw new CmdError('need_players');
    const state = emptyCaro(ordered);
    const version = bumpRoom(db, room.id, {
      status: 'playing',
      stateJson: JSON.stringify(state),
    });
    return { result: { id: room.id, version, state }, scopes: ['games'] };
  }

  if (room.kind === 'ca_ngua') {
    if (players.length < 2 || players.length > 4) throw new CmdError('need_players');
    const state = emptyCaNgua(ordered);
    const version = bumpRoom(db, room.id, {
      status: 'playing',
      stateJson: JSON.stringify(state),
    });
    return { result: { id: room.id, version, state }, scopes: ['games'] };
  }

  if (room.kind === 'ti_phu') {
    if (players.length < 2 || players.length > 6) throw new CmdError('need_players');
    const state = emptyTiPhu(ordered);
    const version = bumpRoom(db, room.id, {
      status: 'playing',
      stateJson: JSON.stringify(state),
    });
    return { result: { id: room.id, version, state }, scopes: ['games'] };
  }

  throw new CmdError('unsupported_kind');
};

export const gameMove: Handler = (ctx, args: CommandArgs<'game.move'>): CmdOk => {
  const { db, member } = ctx;
  const room = getRoom(db, args.roomId);
  if (!room) throw new CmdError('not_found');
  if (room.status !== 'playing') throw new CmdError('not_playing');

  const seat = getSeat(db, room.id, member.id);
  if (!seat || seat === 'spectator') throw new CmdError('forbidden');

  if (room.kind === 'caro') {
    const row = Number(args.row);
    const col = Number(args.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) throw new CmdError('illegal_move');
    const state = parseCaro(room.state_json);
    const result = applyCaroMove(state, member.id, row, col);
    if (!result.ok) throw new CmdError(result.error);
    const version = bumpRoom(db, room.id, {
      status: result.ended ? 'ended' : 'playing',
      stateJson: JSON.stringify(result.state),
    });
    return {
      result: { id: room.id, version, state: result.state, ended: result.ended },
      scopes: ['games'],
    };
  }

  if (room.kind === 'ca_ngua') {
    const state = JSON.parse(room.state_json) as CaNguaState;
    const action = String(args.action || '');
    if (action === 'roll') {
      const dice = randomInt(1, 7);
      const result = applyCaNguaMove(state, member.id, { action: 'roll', dice });
      if (!result.ok) throw new CmdError(result.error);
      const version = bumpRoom(db, room.id, {
        status: result.ended ? 'ended' : 'playing',
        stateJson: JSON.stringify(result.state),
      });
      return {
        result: { id: room.id, version, state: result.state, ended: result.ended },
        scopes: ['games'],
      };
    }
    if (action === 'move' || args.pieceId != null) {
      const pieceId = Number(args.pieceId);
      if (!Number.isInteger(pieceId)) throw new CmdError('illegal_move');
      const result = applyCaNguaMove(state, member.id, { action: 'move', pieceId });
      if (!result.ok) throw new CmdError(result.error);
      const version = bumpRoom(db, room.id, {
        status: result.ended ? 'ended' : 'playing',
        stateJson: JSON.stringify(result.state),
      });
      return {
        result: { id: room.id, version, state: result.state, ended: result.ended },
        scopes: ['games'],
      };
    }
    throw new CmdError('illegal_move');
  }

  if (room.kind === 'ti_phu') {
    const state = JSON.parse(room.state_json) as TiPhuState;
    const action = String(args.action || '');
    if (action === 'roll') {
      const dice: [number, number] = [randomInt(1, 7), randomInt(1, 7)];
      const result = applyTiPhuMove(state, member.id, { action: 'roll', dice });
      if (!result.ok) throw new CmdError(result.error);
      const version = bumpRoom(db, room.id, {
        status: result.ended ? 'ended' : 'playing',
        stateJson: JSON.stringify(result.state),
      });
      return {
        result: { id: room.id, version, state: result.state, ended: result.ended },
        scopes: ['games'],
      };
    }
    if (action === 'buy' || action === 'skip') {
      const result = applyTiPhuMove(state, member.id, { action: action as 'buy' | 'skip' });
      if (!result.ok) throw new CmdError(result.error);
      const version = bumpRoom(db, room.id, {
        status: result.ended ? 'ended' : 'playing',
        stateJson: JSON.stringify(result.state),
      });
      return {
        result: { id: room.id, version, state: result.state, ended: result.ended },
        scopes: ['games'],
      };
    }
    throw new CmdError('illegal_move');
  }

  throw new CmdError('unsupported_kind');
};
