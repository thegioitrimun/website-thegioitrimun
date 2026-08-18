PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pancake_entity_links (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'customer', 'order')),
  local_entity_id TEXT NOT NULL,
  pancake_entity_id TEXT,
  pancake_parent_id TEXT,
  pancake_variation_id TEXT,
  local_checksum TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'blocked', 'failed')),
  last_error TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, local_entity_id)
);
CREATE INDEX IF NOT EXISTS pancake_entity_links_remote_idx
  ON pancake_entity_links(entity_type, pancake_entity_id);
CREATE INDEX IF NOT EXISTS pancake_entity_links_status_idx
  ON pancake_entity_links(sync_status, updated_at);

CREATE TABLE IF NOT EXISTS pancake_sync_outbox (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'customer', 'order')),
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'hide')),
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'processing', 'retrying', 'completed', 'blocked', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  queued_at TEXT,
  lease_token TEXT,
  last_error TEXT,
  response_json TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pancake_sync_outbox_dispatch_idx
  ON pancake_sync_outbox(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS pancake_sync_outbox_entity_idx
  ON pancake_sync_outbox(entity_type, entity_id, created_at DESC);
