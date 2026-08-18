PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingredient_shard_metadata (
  shard_index INTEGER PRIMARY KEY,
  shard_count INTEGER NOT NULL CHECK (shard_count > 0),
  ingredient_count INTEGER NOT NULL DEFAULT 0,
  source_record_count INTEGER NOT NULL DEFAULT 0,
  source_bytes INTEGER NOT NULL DEFAULT 0,
  generated_at TEXT NOT NULL
);
