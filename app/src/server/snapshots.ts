import type { Db } from './db.ts';
import type { ScopeName } from '../shared/types.ts';
import { matrixToRecord } from '../shared/perms-catalog.ts';
import { loadChatSnap, parseChatSub } from './commands/chat.ts';

function shopStats(db: Db) {
  const tables = db
    .prepare(
      `SELECT t.id, t.date, t.winner_shop_id,
              (SELECT shop_id FROM table_shops ts WHERE ts.table_id = t.id ORDER BY rowid LIMIT 1) AS first_shop
       FROM tables t`,
    )
    .all() as {
    id: number;
    date: string;
    winner_shop_id: string | null;
    first_shop: string | null;
  }[];

  const effective = new Map<string, { times: number; lastDate: string | null }>();
  for (const t of tables) {
    let shopId = t.winner_shop_id;
    if (!shopId) {
      const votes = db
        .prepare(
          `SELECT shop_id, COUNT(*) AS c FROM votes WHERE table_id = ? GROUP BY shop_id ORDER BY c DESC`,
        )
        .all(t.id) as { shop_id: string; c: number }[];
      if (votes.length) {
        const top = votes[0].c;
        const tied = votes.filter((v) => v.c === top).map((v) => v.shop_id);
        if (tied.length === 1) shopId = tied[0];
        else {
          const order = db
            .prepare(`SELECT shop_id FROM table_shops WHERE table_id = ? ORDER BY rowid`)
            .all(t.id) as { shop_id: string }[];
          shopId = order.find((s) => tied.includes(s.shop_id))?.shop_id ?? tied[0];
        }
      } else {
        shopId = t.first_shop;
      }
    }
    if (!shopId) continue;
    const cur = effective.get(shopId) || { times: 0, lastDate: null };
    cur.times += 1;
    if (!cur.lastDate || t.date > cur.lastDate) cur.lastDate = t.date;
    effective.set(shopId, cur);
  }
  return effective;
}

export function snapMembers(db: Db) {
  const rows = db
    .prepare(
      `SELECT id, username, display_name AS displayName, is_operator AS isOperator, tier,
              avatar_id AS avatarId,
              bank_bin AS bankBin, bank_account AS bankAccount,
              bank_name_display AS bankNameDisplay, disabled
       FROM members ORDER BY display_name COLLATE NOCASE`,
    )
    .all() as Array<Record<string, unknown>>;
  return {
    scope: 'members' as ScopeName,
    version: 1,
    data: rows.map((r) => ({
      ...r,
      isOperator: !!r.isOperator || r.tier === 'chu_xi',
      avatarId: (r.avatarId as string | null) ?? null,
      disabled: !!r.disabled,
    })),
  };
}

export function snapPerms(db: Db) {
  const rows = db
    .prepare(`SELECT tier, perm_key, allowed FROM role_permissions ORDER BY tier, perm_key`)
    .all() as Array<{ tier: string; perm_key: string; allowed: number }>;
  const grants = db
    .prepare(
      `SELECT id, member_id AS memberId, perm_key AS permKey, granted_by AS grantedBy,
              expires_at AS expiresAt, created_at AS createdAt
       FROM perm_grants WHERE expires_at > ? ORDER BY expires_at`,
    )
    .all(new Date().toISOString());
  const requests = db
    .prepare(
      `SELECT id, member_id AS memberId, perm_key AS permKey, status,
              decided_by AS decidedBy, created_at AS createdAt, decided_at AS decidedAt
       FROM perm_requests WHERE status = 'pending' ORDER BY created_at`,
    )
    .all();
  const version =
    rows.length +
    (grants as unknown[]).length * 10 +
    (requests as unknown[]).length * 100 +
    1;
  return {
    scope: 'perms' as ScopeName,
    version,
    data: {
      matrix: matrixToRecord(rows),
      grants,
      requests,
    },
  };
}

export function snapShops(db: Db) {
  const stats = shopStats(db);
  const shops = db
    .prepare(
      `SELECT id, name, phone, type, maps_url AS mapsUrl, created_by AS createdBy,
              version, created_at AS createdAt, updated_at AS updatedAt
       FROM shops ORDER BY name COLLATE NOCASE`,
    )
    .all() as Array<Record<string, unknown> & { id: string; version: number }>;

  const menuStmt = db.prepare(
    `SELECT id, shop_id AS shopId, name, price, sort FROM menu_items WHERE shop_id = ? ORDER BY sort, name`,
  );

  const data = shops.map((s) => {
    const st = stats.get(s.id) || { times: 0, lastDate: null };
    return {
      ...s,
      menu: menuStmt.all(s.id),
      stats: { times: st.times, lastDate: st.lastDate },
    };
  });

  const version = shops.reduce((m, s) => Math.max(m, s.version), 0);
  return { scope: 'shops' as ScopeName, version, data };
}

export type TableSnap = {
  id: number;
  date: string;
  hostId: string;
  winnerShopId: string | null;
  winnerSpinId: string | null;
  pickupMemberId: string | null;
  pickupSpinId: string | null;
  billTotal: number | null;
  billMode: string;
  version: number;
  createdAt: string;
  voteEndsAt: string | null;
  shopIds: string[];
  votes: unknown[];
  orders: unknown[];
};

export function loadTable(db: Db, tableId: number): TableSnap | null {
  const t = db
    .prepare(
      `SELECT id, date, host_id AS hostId, winner_shop_id AS winnerShopId,
              winner_spin_id AS winnerSpinId, pickup_member_id AS pickupMemberId,
              pickup_spin_id AS pickupSpinId, bill_total AS billTotal,
              bill_mode AS billMode, version, created_at AS createdAt,
              vote_ends_at AS voteEndsAt
       FROM tables WHERE id = ?`,
    )
    .get(tableId) as Omit<TableSnap, 'shopIds' | 'votes' | 'orders'> | undefined;
  if (!t) return null;

  const shopIds = (
    db.prepare(`SELECT shop_id FROM table_shops WHERE table_id = ? ORDER BY rowid`).all(tableId) as {
      shop_id: string;
    }[]
  ).map((r) => r.shop_id);

  const votes = db
    .prepare(
      `SELECT table_id AS tableId, member_id AS memberId, shop_id AS shopId, updated_at AS updatedAt
       FROM votes WHERE table_id = ?`,
    )
    .all(tableId);

  const orders = db
    .prepare(
      `SELECT id, table_id AS tableId, member_id AS memberId, text, price, version,
              created_at AS createdAt, updated_at AS updatedAt
       FROM orders WHERE table_id = ? ORDER BY created_at`,
    )
    .all(tableId);

  return { ...t, shopIds, votes, orders };
}

export function snapTable(db: Db, tableId: number) {
  const data = loadTable(db, tableId);
  if (!data) return null;
  return {
    scope: `table:${tableId}` as ScopeName,
    version: Number(data.version),
    data,
  };
}

export function snapCurrentTable(db: Db) {
  const ids = db.prepare('SELECT id FROM tables ORDER BY id DESC').all() as { id: number }[];
  if (!ids.length) {
    return {
      scope: 'table:current' as ScopeName,
      version: 0,
      data: { table: null, tables: [] as TableSnap[] },
    };
  }
  const tables = ids.map((r) => loadTable(db, r.id)!).filter(Boolean);
  const current = tables[0]!;
  return {
    scope: 'table:current' as ScopeName,
    version: Number(current.version),
    data: { table: current, tables },
  };
}

export function snapGames(db: Db) {
  const rooms = db
    .prepare(
      `SELECT id, kind, title, status, host_id AS hostId, state_json AS stateJson,
              version, created_at AS createdAt, updated_at AS updatedAt
       FROM game_rooms ORDER BY created_at DESC`,
    )
    .all() as Array<{
    id: string;
    kind: string;
    title: string;
    status: string;
    hostId: string;
    stateJson: string;
    version: number;
    createdAt: string;
    updatedAt: string;
  }>;

  const memStmt = db.prepare(
    `SELECT member_id AS memberId, seat, joined_at AS joinedAt
     FROM game_members WHERE room_id = ? ORDER BY joined_at`,
  );

  const data = rooms.map((r) => {
    let state: unknown = {};
    try {
      state = JSON.parse(r.stateJson || '{}');
    } catch {
      state = {};
    }
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      status: r.status,
      hostId: r.hostId,
      state,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      members: memStmt.all(r.id),
    };
  });
  const version = rooms.reduce((m, r) => Math.max(m, r.version), 0);
  return { scope: 'games' as ScopeName, version, data };
}

export function snapWheels(db: Db) {
  const wheels = db
    .prepare(
      `SELECT id, title, kind, table_id AS tableId, created_by AS createdBy, version
       FROM wheels ORDER BY rowid DESC`,
    )
    .all() as Array<Record<string, unknown> & { id: string; version: number }>;

  const itemsStmt = db.prepare(
    `SELECT id, wheel_id AS wheelId, name, weight, ref_shop_id AS refShopId,
            ref_member_id AS refMemberId, votes, sort
     FROM wheel_items WHERE wheel_id = ? ORDER BY sort, rowid`,
  );
  const spinsStmt = db.prepare(
    `SELECT id, wheel_id AS wheelId, by_member AS byMember, items_json AS itemsJson,
            result_index AS resultIndex, result_name AS resultName,
            started_at AS startedAt, duration_ms AS durationMs
     FROM spins WHERE wheel_id = ? ORDER BY started_at DESC LIMIT 5`,
  );

  const data = wheels.map((w) => ({
    ...w,
    items: itemsStmt.all(w.id),
    recentSpins: spinsStmt.all(w.id),
  }));
  const version = wheels.reduce((m, w) => Math.max(m, w.version), 0);
  return { scope: 'wheels' as ScopeName, version, data };
}

export function buildSnap(db: Db, scope: ScopeName) {
  if (scope === 'members') return snapMembers(db);
  if (scope === 'perms') return snapPerms(db);
  if (scope === 'shops') return snapShops(db);
  if (scope === 'wheels') return snapWheels(db);
  if (scope === 'games') return snapGames(db);
  if (scope === 'table:current') return snapCurrentTable(db);
  if (scope.startsWith('chat:')) {
    const inner = parseChatSub(scope);
    if (!inner) return null;
    const data = loadChatSnap(db, inner);
    return {
      scope,
      version: data.messages.length,
      data,
    };
  }
  if (scope.startsWith('table:')) {
    const id = Number(scope.slice(6));
    return snapTable(db, id);
  }
  return null;
}

export function bumpTableVersion(db: Db, tableId: number): number {
  db.prepare('UPDATE tables SET version = version + 1 WHERE id = ?').run(tableId);
  const row = db.prepare('SELECT version FROM tables WHERE id = ?').get(tableId) as {
    version: number;
  };
  return row.version;
}

export function bumpShopVersion(db: Db, shopId: string): number {
  db.prepare('UPDATE shops SET version = version + 1, updated_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    shopId,
  );
  const row = db.prepare('SELECT version FROM shops WHERE id = ?').get(shopId) as {
    version: number;
  };
  return row.version;
}

export function bumpWheelVersion(db: Db, wheelId: string): number {
  db.prepare('UPDATE wheels SET version = version + 1 WHERE id = ?').run(wheelId);
  const row = db.prepare('SELECT version FROM wheels WHERE id = ?').get(wheelId) as {
    version: number;
  };
  return row.version;
}

export function bumpOrderVersion(db: Db, orderId: string): number {
  db.prepare('UPDATE orders SET version = version + 1, updated_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    orderId,
  );
  const row = db.prepare('SELECT version FROM orders WHERE id = ?').get(orderId) as {
    version: number;
  };
  return row.version;
}
