-- Bể cá chung của phòng chat. Nét vẽ là nguồn; ảnh sprite nằm ngoài SQLite.

CREATE TABLE IF NOT EXISTS be_tank (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  sand INTEGER NOT NULL DEFAULT 0,
  lighting TEXT NOT NULL DEFAULT 'auto',
  water_level REAL NOT NULL DEFAULT 0.78,
  rocks INTEGER NOT NULL DEFAULT 1,
  wood INTEGER NOT NULL DEFAULT 1,
  dirt INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

INSERT OR IGNORE INTO be_tank(id, sand, lighting, water_level, rocks, wood, dirt, updated_at)
VALUES (1, 0, 'auto', 0.78, 1, 1, 0, '1970-01-01T00:00:00.000Z');

CREATE TABLE IF NOT EXISTS be_drawing (
  id TEXT PRIMARY KEY,
  author_user_id TEXT NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL CHECK (kind IN ('ca', 'cay', 'thuc_an', 'do')),
  name TEXT NOT NULL,
  strokes TEXT NOT NULL,
  swim_type TEXT NOT NULL DEFAULT 'active',
  wave INTEGER NOT NULL DEFAULT 1,
  hidden INTEGER NOT NULL DEFAULT 0,
  sprite_hash TEXT NOT NULL,
  fed_count INTEGER NOT NULL DEFAULT 0,
  growth REAL NOT NULL DEFAULT 0.62,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_be_drawing_kind ON be_drawing(kind, hidden);

CREATE TABLE IF NOT EXISTS be_placement (
  id TEXT PRIMARY KEY,
  drawing_id TEXT NOT NULL UNIQUE REFERENCES be_drawing(id),
  x REAL NOT NULL,
  y REAL NOT NULL,
  z INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS be_wallet (
  user_id TEXT PRIMARY KEY REFERENCES members(id),
  scales INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS be_unlock (
  user_id TEXT NOT NULL REFERENCES members(id),
  item TEXT NOT NULL,
  PRIMARY KEY (user_id, item)
);

CREATE TABLE IF NOT EXISTS be_pellet (
  id TEXT PRIMARY KEY,
  x REAL NOT NULL,
  born_at TEXT NOT NULL,
  eaten_at TEXT,
  eaten_by TEXT
);

CREATE TABLE IF NOT EXISTS be_report (
  id TEXT PRIMARY KEY,
  drawing_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
