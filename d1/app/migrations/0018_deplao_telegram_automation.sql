PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS deplao_automation_jobs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('order.created', 'order.paid')),
  order_id TEXT NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  order_code TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'leased', 'waiting_friend', 'retrying', 'completed', 'failed', 'delivery_unknown', 'expired')
  ),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  lease_owner TEXT,
  lease_token_hash TEXT,
  lease_expires_at TEXT,
  last_error TEXT,
  result_json TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS deplao_jobs_claim_idx
  ON deplao_automation_jobs(status, available_at, expires_at, created_at);
CREATE INDEX IF NOT EXISTS deplao_jobs_order_idx
  ON deplao_automation_jobs(order_id, created_at);

CREATE TABLE IF NOT EXISTS telegram_order_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id TEXT REFERENCES product_orders(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'queued', 'sending', 'retrying', 'accepted', 'delivery_unknown', 'failed')
  ),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  queued_at TEXT,
  last_attempt_at TEXT,
  telegram_message_ids_json TEXT,
  last_error TEXT,
  accepted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS telegram_order_outbox_dispatch_idx
  ON telegram_order_outbox(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS telegram_order_outbox_order_idx
  ON telegram_order_outbox(order_id, created_at);

CREATE TABLE IF NOT EXISTS deplao_devices (
  device_id TEXT PRIMARY KEY,
  app_version TEXT,
  selected_zalo_account_id TEXT,
  selected_zalo_connected INTEGER NOT NULL DEFAULT 0 CHECK (selected_zalo_connected IN (0, 1)),
  backlog_count INTEGER NOT NULL DEFAULT 0 CHECK (backlog_count >= 0),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  offline_notified_at TEXT,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deplao_request_nonces (
  device_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (device_id, nonce)
);

CREATE INDEX IF NOT EXISTS deplao_request_nonces_expiry_idx
  ON deplao_request_nonces(expires_at);
