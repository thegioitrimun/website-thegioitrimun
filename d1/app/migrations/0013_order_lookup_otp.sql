PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS order_lookup_otps (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  destination_hint TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS order_lookup_otps_order_idx
  ON order_lookup_otps(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_lookup_otps_expiry_idx
  ON order_lookup_otps(expires_at, consumed_at);
