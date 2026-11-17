ALTER TABLE game_rooms ADD COLUMN last_play_at TEXT;
ALTER TABLE game_rooms ADD COLUMN empty_since TEXT;
UPDATE game_rooms SET last_play_at = updated_at WHERE last_play_at IS NULL;

CREATE TABLE IF NOT EXISTS tank_fish (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES members(id),
  png BLOB NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tank_fish_owner ON tank_fish(owner_id);
