PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingredient_source_record_chunks (
  source_id TEXT NOT NULL REFERENCES ingredient_source_records(source_id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  chunk_text TEXT NOT NULL,
  PRIMARY KEY (source_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS ingredient_source_record_chunks_source_idx
  ON ingredient_source_record_chunks(source_id, chunk_index);
