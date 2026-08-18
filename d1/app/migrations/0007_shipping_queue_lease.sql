PRAGMA foreign_keys = ON;

ALTER TABLE shipping_outbox ADD COLUMN queued_at TEXT;
ALTER TABLE shipping_outbox ADD COLUMN lease_token TEXT;
CREATE INDEX IF NOT EXISTS shipping_outbox_lease_idx ON shipping_outbox(status, available_at, queued_at);
