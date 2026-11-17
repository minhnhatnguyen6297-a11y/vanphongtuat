import type { Db } from './db.ts';

/** Empty open rooms survive this long so a dropped tab can reconnect. */
export const EMPTY_GRACE_MS = 60_000;
/** No game action (not a socket heartbeat) for this long and the room expires. */
export const IDLE_EXPIRE_MS = 30 * 60_000;

type RoomSweep = {
  id: string;
  status: string;
  last_play_at: string | null;
  empty_since: string | null;
  updated_at: string;
};

function memberIds(db: Db, roomId: string): string[] {
  return (
    db.prepare(`SELECT member_id FROM game_members WHERE room_id = ?`).all(roomId) as {
      member_id: string;
    }[]
  ).map((r) => r.member_id);
}

function deleteRoom(db: Db, id: string) {
  db.prepare(`DELETE FROM game_rooms WHERE id = ?`).run(id);
}

/**
 * Drop rooms the server should no longer offer.
 * Playing games are not removed just because everyone disconnected;
 * they expire only after IDLE_EXPIRE_MS without a play action.
 */
export function sweepRooms(db: Db, now: number, present: ReadonlySet<string>): string[] {
  const rooms = db
    .prepare(
      `SELECT id, status, last_play_at, empty_since, updated_at FROM game_rooms`,
    )
    .all() as RoomSweep[];
  const removed: string[] = [];
  const setEmpty = db.prepare(`UPDATE game_rooms SET empty_since = ? WHERE id = ?`);
  const clearEmpty = db.prepare(`UPDATE game_rooms SET empty_since = NULL WHERE id = ?`);

  for (const room of rooms) {
    const last = Date.parse(room.last_play_at || room.updated_at);
    const idle = Number.isFinite(last) ? now - last : 0;
    if ((room.status === 'open' || room.status === 'playing') && idle >= IDLE_EXPIRE_MS) {
      deleteRoom(db, room.id);
      removed.push(room.id);
      continue;
    }
    if (room.status === 'ended') {
      const updated = Date.parse(room.updated_at);
      if (Number.isFinite(updated) && now - updated >= EMPTY_GRACE_MS) {
        deleteRoom(db, room.id);
        removed.push(room.id);
      }
      continue;
    }
    if (room.status === 'playing') {
      if (room.empty_since) clearEmpty.run(room.id);
      continue;
    }
    const online = memberIds(db, room.id).some((id) => present.has(id));
    if (online) {
      if (room.empty_since) clearEmpty.run(room.id);
      continue;
    }
    if (!room.empty_since) {
      setEmpty.run(new Date(now).toISOString(), room.id);
      continue;
    }
    const since = Date.parse(room.empty_since);
    if (Number.isFinite(since) && now - since >= EMPTY_GRACE_MS) {
      deleteRoom(db, room.id);
      removed.push(room.id);
    }
  }
  return removed;
}

export function roomIdleExpired(lastPlayAt: string | null, updatedAt: string, now: number): boolean {
  const last = Date.parse(lastPlayAt || updatedAt);
  if (!Number.isFinite(last)) return false;
  return now - last >= IDLE_EXPIRE_MS;
}

let presentNow: () => ReadonlySet<string> = () => new Set();

export function setRoomPresence(fn: () => ReadonlySet<string>) {
  presentNow = fn;
}

export function sweepRoomsNow(db: Db, now = Date.now()): string[] {
  return sweepRooms(db, now, presentNow());
}
