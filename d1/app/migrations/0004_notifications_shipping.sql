PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS notification_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('customer', 'admin')),
  recipient_email TEXT NOT NULL COLLATE NOCASE,
  locale TEXT NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en', 'ru', 'cn')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sending', 'accepted', 'retrying', 'delivery_unknown', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  queued_at TEXT,
  last_attempt_at TEXT,
  accepted_at TEXT,
  smtp_response TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notification_outbox_dispatch_idx ON notification_outbox(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS notification_outbox_aggregate_idx ON notification_outbox(aggregate_type, aggregate_id);

CREATE TABLE IF NOT EXISTS shipping_outbox (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'cancel', 'refresh', 'label')),
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'retrying', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL,
  response_json TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shipping_outbox_dispatch_idx ON shipping_outbox(status, available_at, created_at);

CREATE TABLE IF NOT EXISTS shipping_shipments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES product_orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_order_id TEXT,
  tracking_code TEXT,
  status TEXT,
  status_text TEXT,
  request_json TEXT,
  response_json TEXT,
  label_object_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shipping_shipments_tracking_idx ON shipping_shipments(tracking_code);

CREATE TABLE IF NOT EXISTS shipping_status_history (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES shipping_shipments(id) ON DELETE CASCADE,
  provider_status TEXT,
  mapped_status TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shipping_status_history_shipment_idx ON shipping_status_history(shipment_id, occurred_at);

CREATE TABLE IF NOT EXISTS webhook_receipts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  headers_json TEXT NOT NULL DEFAULT '{}',
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  last_error TEXT,
  UNIQUE(provider, event_hash)
);

CREATE TABLE IF NOT EXISTS migration_checkpoints (
  source_name TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  cursor_value TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source_name, resource_name)
);

CREATE TABLE IF NOT EXISTS shadow_read_diffs (
  id TEXT PRIMARY KEY,
  resource_name TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  source_checksum TEXT,
  target_checksum TEXT,
  diff_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shadow_read_diffs_resource_idx ON shadow_read_diffs(resource_name, created_at DESC);
