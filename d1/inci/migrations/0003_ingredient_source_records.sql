PRAGMA foreign_keys = ON;

-- Raw crawler rows remain operational. Large datasets are partitioned across
-- INCI D1 shards so every database stays below the configured capacity limit.
CREATE TABLE IF NOT EXISTS ingredient_source_records (
  source_id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  source_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ingredient_source_records_ingredient_idx
  ON ingredient_source_records(ingredient_id);
