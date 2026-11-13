-- Hôm Nay Ăn Gì — schema đợt 1 (plan §5.1 + §3)

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  pin_hash BLOB NOT NULL,
  pin_salt BLOB NOT NULL,
  is_operator INTEGER NOT NULL DEFAULT 0,
  bank_bin TEXT,
  bank_account TEXT,
  bank_name_display TEXT,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS login_lockouts (
  username TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  lock_level INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER
);

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  type TEXT NOT NULL DEFAULT '' CHECK(type IN ('no','vat','uong','')),
  maps_url TEXT,
  created_by TEXT REFERENCES members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price INTEGER,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  host_id TEXT NOT NULL REFERENCES members(id),
  winner_shop_id TEXT REFERENCES shops(id),
  winner_spin_id TEXT,
  pickup_member_id TEXT REFERENCES members(id),
  pickup_spin_id TEXT,
  bill_total INTEGER,
  bill_mode TEXT NOT NULL DEFAULT 'item' CHECK(bill_mode IN ('item','equal')),
  created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS table_shops (
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  added_by TEXT REFERENCES members(id),
  PRIMARY KEY(table_id, shop_id)
);

CREATE TABLE IF NOT EXISTS votes (
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  shop_id TEXT NOT NULL REFERENCES shops(id),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(table_id, member_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  text TEXT NOT NULL,
  price INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS wheels (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('shop','person','free')),
  table_id INTEGER REFERENCES tables(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES members(id),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS wheel_items (
  id TEXT PRIMARY KEY,
  wheel_id TEXT NOT NULL REFERENCES wheels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK(weight BETWEEN 1 AND 100),
  ref_shop_id TEXT REFERENCES shops(id),
  ref_member_id TEXT REFERENCES members(id),
  votes INTEGER,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS spins (
  id TEXT PRIMARY KEY,
  wheel_id TEXT NOT NULL REFERENCES wheels(id) ON DELETE CASCADE,
  by_member TEXT NOT NULL REFERENCES members(id),
  items_json TEXT NOT NULL,
  result_index INTEGER NOT NULL,
  result_name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ops (
  op_id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  name TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  finished_at TEXT,
  result_json TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_member ON auth_sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_votes_table ON votes(table_id);
CREATE INDEX IF NOT EXISTS idx_wheels_table ON wheels(table_id);
CREATE INDEX IF NOT EXISTS idx_spins_wheel ON spins(wheel_id);
CREATE INDEX IF NOT EXISTS idx_menu_shop ON menu_items(shop_id);
