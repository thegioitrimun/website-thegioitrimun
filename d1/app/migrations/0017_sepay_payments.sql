PRAGMA foreign_keys = ON;

ALTER TABLE product_orders ADD COLUMN payment_provider TEXT;
ALTER TABLE product_orders ADD COLUMN payment_reference TEXT;
ALTER TABLE product_orders ADD COLUMN payment_expires_at TEXT;
ALTER TABLE product_orders ADD COLUMN paid_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS product_orders_payment_reference_idx
  ON product_orders(payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS sepay_transactions (
  sepay_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES product_orders(id) ON DELETE SET NULL,
  payment_reference TEXT,
  gateway TEXT NOT NULL,
  account_number TEXT NOT NULL,
  sub_account TEXT,
  transfer_type TEXT NOT NULL CHECK (transfer_type IN ('in', 'out')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  accumulated INTEGER NOT NULL DEFAULT 0,
  transaction_date TEXT NOT NULL,
  reference_code TEXT,
  content TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('matched', 'unmatched', 'amount_mismatch', 'ignored')),
  reason TEXT,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sepay_transactions_order_idx
  ON sepay_transactions(order_id, received_at DESC);
CREATE INDEX IF NOT EXISTS sepay_transactions_reference_idx
  ON sepay_transactions(payment_reference, received_at DESC);
CREATE INDEX IF NOT EXISTS sepay_transactions_status_idx
  ON sepay_transactions(status, received_at DESC);
