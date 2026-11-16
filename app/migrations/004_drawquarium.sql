-- Drawquarium văn phòng: bể chung của phòng chat.

CREATE TABLE IF NOT EXISTS be_drawing (
  id TEXT PRIMARY KEY,
  author_user_id TEXT NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL CHECK(kind IN ('ca', 'cay', 'thuc_an', 'do')),
  name TEXT NOT NULL,
  strokes TEXT NOT NULL,
  stroke_hash TEXT NOT NULL,
  swim_type TEXT NOT NULL DEFAULT 'thuong',
  wave INTEGER NOT NULL DEFAULT 1,
  hidden INTEGER NOT NULL DEFAULT 0,
  reported INTEGER NOT NULL DEFAULT 0,
  scale REAL NOT NULL DEFAULT 0.58,
  feeds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_be_drawing_kind ON be_drawing(kind, hidden);

CREATE TABLE IF NOT EXISTS be_placement (
  drawing_id TEXT PRIMARY KEY REFERENCES be_drawing(id) ON DELETE CASCADE,
  x REAL NOT NULL,
  y REAL NOT NULL,
  z INTEGER NOT NULL DEFAULT 0,
  phase REAL NOT NULL DEFAULT 0,
  hold_x REAL,
  hold_y REAL,
  hold_until INTEGER,
  released_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS be_tank (
  id TEXT PRIMARY KEY,
  sand TEXT NOT NULL,
  lighting TEXT NOT NULL,
  water_level REAL NOT NULL,
  rock_count INTEGER NOT NULL,
  wood_count INTEGER NOT NULL,
  dirt REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

INSERT OR IGNORE INTO be_tank(id, sand, lighting, water_level, rock_count, wood_count, dirt, updated_at)
VALUES ('main', 'vang', 'auto', 0.78, 3, 1, 0, '1970-01-01T00:00:00.000Z');

CREATE TABLE IF NOT EXISTS be_wallet (
  user_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  scales INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS be_unlock (
  user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  PRIMARY KEY (user_id, item)
);

CREATE TABLE IF NOT EXISTS be_session (
  user_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  last_active_at INTEGER NOT NULL,
  hidden_at INTEGER
);

CREATE TABLE IF NOT EXISTS be_food (
  id TEXT PRIMARY KEY,
  x REAL NOT NULL,
  y REAL NOT NULL,
  born_at INTEGER NOT NULL,
  eater_id TEXT,
  eaten_at INTEGER,
  sprite_hash TEXT
);
