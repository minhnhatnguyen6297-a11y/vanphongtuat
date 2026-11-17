ALTER TABLE tank_fish ADD COLUMN local_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tank_fish_owner_local ON tank_fish(owner_id, local_id);
