-- Pancake remains asynchronous in both directions. Incoming events are persisted
-- before they are processed so webhook retries and the bounded polling fallback
-- cannot create duplicate orders or customers.
PRAGMA defer_foreign_keys = ON;

ALTER TABLE pancake_sync_settings ADD COLUMN inbound_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (inbound_enabled IN (0, 1));
ALTER TABLE pancake_sync_settings ADD COLUMN inbound_orders_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (inbound_orders_enabled IN (0, 1));
ALTER TABLE pancake_sync_settings ADD COLUMN inbound_customers_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (inbound_customers_enabled IN (0, 1));
ALTER TABLE pancake_sync_settings ADD COLUMN inbound_poll_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (inbound_poll_enabled IN (0, 1));

-- Keep full Pancake line snapshots even when a variation has not been linked to
-- the website catalog yet. Existing website rows keep their original product FK.
CREATE TABLE product_order_items_next (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT,
  product_image_path TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_purchase INTEGER NOT NULL CHECK (price_at_purchase >= 0),
  vat_rate REAL NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  external_product_id TEXT,
  external_variation_id TEXT,
  source_system TEXT NOT NULL DEFAULT 'website' CHECK (source_system IN ('website', 'pancake')),
  created_at TEXT NOT NULL,
  UNIQUE(order_id, product_id),
  UNIQUE(order_id, external_variation_id)
);

INSERT INTO product_order_items_next (
  id, order_id, product_id, product_name, product_sku, product_image_path,
  quantity, price_at_purchase, vat_rate, tax_amount, created_at
)
SELECT id, order_id, product_id, product_name, product_sku, product_image_path,
  quantity, price_at_purchase, vat_rate, tax_amount, created_at
FROM product_order_items;

DROP TABLE product_order_items;
ALTER TABLE product_order_items_next RENAME TO product_order_items;
CREATE INDEX product_order_items_order_idx ON product_order_items(order_id);
CREATE INDEX product_order_items_product_idx ON product_order_items(product_id);
CREATE INDEX product_order_items_external_variation_idx
  ON product_order_items(external_variation_id)
  WHERE external_variation_id IS NOT NULL;

CREATE TABLE pancake_customers (
  id TEXT PRIMARY KEY,
  pancake_customer_id TEXT,
  normalized_phone TEXT,
  name TEXT NOT NULL DEFAULT 'Khách lẻ',
  phone TEXT,
  email TEXT COLLATE NOCASE,
  gender TEXT,
  date_of_birth TEXT,
  address_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'pancake_pos' CHECK (source IN ('pancake_pos', 'pancake_online')),
  linked_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  raw_json TEXT NOT NULL DEFAULT '{}',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX pancake_customers_remote_idx
  ON pancake_customers(pancake_customer_id)
  WHERE pancake_customer_id IS NOT NULL;
CREATE INDEX pancake_customers_phone_idx
  ON pancake_customers(normalized_phone, updated_at DESC)
  WHERE normalized_phone IS NOT NULL;
CREATE INDEX pancake_customers_email_idx
  ON pancake_customers(email COLLATE NOCASE, updated_at DESC)
  WHERE email IS NOT NULL;

CREATE TABLE pancake_inbound_orders (
  pancake_order_id TEXT PRIMARY KEY,
  local_order_id TEXT NOT NULL UNIQUE REFERENCES product_orders(id) ON DELETE CASCADE,
  pancake_customer_id TEXT,
  pancake_updated_at TEXT,
  payload_checksum TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  inventory_applied_at TEXT,
  import_status TEXT NOT NULL DEFAULT 'imported'
    CHECK (import_status IN ('linked', 'imported', 'partial', 'failed')),
  last_error TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX pancake_inbound_orders_local_idx ON pancake_inbound_orders(local_order_id);
CREATE INDEX pancake_inbound_orders_updated_idx ON pancake_inbound_orders(pancake_updated_at DESC);

CREATE TABLE pancake_inbound_events (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('order', 'customer')),
  remote_id TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('webhook', 'poll', 'manual')),
  receipt_id TEXT REFERENCES webhook_receipts(id) ON DELETE SET NULL,
  remote_updated_at TEXT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'processing', 'retrying', 'completed', 'ignored', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  queued_at TEXT,
  lease_token TEXT,
  last_error TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX pancake_inbound_events_dispatch_idx
  ON pancake_inbound_events(status, available_at, created_at);
CREATE INDEX pancake_inbound_events_remote_idx
  ON pancake_inbound_events(resource_type, remote_id, remote_updated_at DESC);

CREATE TABLE pancake_inbound_cursors (
  resource_type TEXT PRIMARY KEY CHECK (resource_type IN ('order', 'customer')),
  cursor_timestamp TEXT,
  window_end_at TEXT,
  next_page INTEGER NOT NULL DEFAULT 1 CHECK (next_page >= 1),
  last_polled_at TEXT,
  lease_until TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO pancake_inbound_cursors (resource_type, created_at, updated_at)
VALUES ('order', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO pancake_inbound_cursors (resource_type, created_at, updated_at)
VALUES ('customer', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

PRAGMA defer_foreign_keys = OFF;
PRAGMA foreign_key_check;
