-- Phân quyền · chat · game (spec 2026-11-12)
-- db.ts load từ APP_ROOT/migrations — không đặt dưới src/server/migrations.

ALTER TABLE members ADD COLUMN tier TEXT NOT NULL DEFAULT 'dan_den';

UPDATE members SET tier = 'chu_xi' WHERE is_operator = 1;
UPDATE members SET tier = 'dan_den' WHERE is_operator = 0;

CREATE TABLE IF NOT EXISTS role_permissions (
  tier TEXT NOT NULL,
  perm_key TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 0 CHECK(allowed IN (0, 1)),
  PRIMARY KEY(tier, perm_key)
);

CREATE TABLE IF NOT EXISTS perm_grants (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  perm_key TEXT NOT NULL,
  granted_by TEXT NOT NULL REFERENCES members(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_perm_grants_member ON perm_grants(member_id, perm_key);
CREATE INDEX IF NOT EXISTS idx_perm_grants_expires ON perm_grants(expires_at);

CREATE TABLE IF NOT EXISTS perm_requests (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  perm_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied')),
  decided_by TEXT REFERENCES members(id),
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_perm_requests_status ON perm_requests(status, created_at);

ALTER TABLE tables ADD COLUMN vote_ends_at TEXT;

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_chat_scope ON chat_messages(scope, created_at);

CREATE TABLE IF NOT EXISTS game_rooms (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('caro', 'ca_ngua', 'ti_phu')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'playing', 'ended')),
  host_id TEXT NOT NULL REFERENCES members(id),
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS game_members (
  room_id TEXT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  seat TEXT NOT NULL CHECK(seat IN ('host', 'player', 'spectator')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY(room_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_game_members_member ON game_members(member_id);
