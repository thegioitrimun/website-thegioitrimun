CREATE TABLE IF NOT EXISTS pancake_sync_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  master_enabled INTEGER NOT NULL DEFAULT 0 CHECK (master_enabled IN (0, 1)),
  products_enabled INTEGER NOT NULL DEFAULT 0 CHECK (products_enabled IN (0, 1)),
  inventory_enabled INTEGER NOT NULL DEFAULT 0 CHECK (inventory_enabled IN (0, 1)),
  customers_enabled INTEGER NOT NULL DEFAULT 0 CHECK (customers_enabled IN (0, 1)),
  orders_enabled INTEGER NOT NULL DEFAULT 0 CHECK (orders_enabled IN (0, 1)),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO pancake_sync_settings (id) VALUES (1);

DROP TABLE IF EXISTS pancake_sync_outbox_next;

CREATE TABLE pancake_sync_outbox_next (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'inventory', 'customer', 'order')),
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'upsert' CHECK (operation IN ('upsert', 'hide')),
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'paused', 'queued', 'processing', 'retrying', 'completed', 'blocked', 'failed')
  ),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  queued_at TEXT,
  lease_token TEXT,
  last_error TEXT,
  response_json TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pancake_sync_outbox_next (
  id,
  entity_type,
  entity_id,
  operation,
  idempotency_key,
  payload_json,
  status,
  attempts,
  available_at,
  queued_at,
  lease_token,
  last_error,
  response_json,
  completed_at,
  created_at,
  updated_at
)
SELECT
  id,
  entity_type,
  entity_id,
  operation,
  idempotency_key,
  payload_json,
  CASE
    WHEN status IN ('pending', 'queued', 'processing', 'retrying') THEN 'paused'
    ELSE status
  END,
  attempts,
  available_at,
  CASE WHEN status IN ('pending', 'queued', 'processing', 'retrying') THEN NULL ELSE queued_at END,
  CASE WHEN status IN ('pending', 'queued', 'processing', 'retrying') THEN NULL ELSE lease_token END,
  last_error,
  response_json,
  completed_at,
  created_at,
  updated_at
FROM pancake_sync_outbox;

DROP TABLE pancake_sync_outbox;
ALTER TABLE pancake_sync_outbox_next RENAME TO pancake_sync_outbox;

CREATE INDEX IF NOT EXISTS idx_pancake_outbox_dispatch
  ON pancake_sync_outbox(status, available_at, created_at);

CREATE INDEX IF NOT EXISTS idx_pancake_outbox_entity
  ON pancake_sync_outbox(entity_type, entity_id, created_at DESC);
