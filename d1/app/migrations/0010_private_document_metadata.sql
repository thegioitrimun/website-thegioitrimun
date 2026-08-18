PRAGMA foreign_keys = ON;

ALTER TABLE private_documents ADD COLUMN original_name TEXT;
ALTER TABLE private_documents ADD COLUMN ai_summary TEXT;

CREATE INDEX IF NOT EXISTS private_documents_record_idx
  ON private_documents(medical_record_id, created_at DESC);
