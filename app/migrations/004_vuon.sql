-- Vườn: một dòng cho mỗi người × loài. care_days chỉ tăng.

CREATE TABLE IF NOT EXISTS garden_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 0
);

INSERT INTO garden_meta(id, version)
SELECT 1, 0
WHERE NOT EXISTS (SELECT 1 FROM garden_meta WHERE id = 1);

CREATE TABLE IF NOT EXISTS garden_care (
  member_id TEXT NOT NULL REFERENCES members(id),
  species_id TEXT NOT NULL,
  care_days INTEGER NOT NULL DEFAULT 0 CHECK (care_days >= 0),
  last_care_on TEXT,
  PRIMARY KEY (member_id, species_id)
);
