-- D1 keeps foreign keys enabled inside migrations. Back up every dependent row
-- because dropping the parent still executes ON DELETE CASCADE/SET NULL actions.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE _0019_product_order_items AS SELECT * FROM product_order_items;
CREATE TABLE _0019_order_lookup_otps AS SELECT * FROM order_lookup_otps;
CREATE TABLE _0019_order_payment_logs AS SELECT * FROM order_payment_logs;
CREATE TABLE _0019_order_refund_logs AS SELECT * FROM order_refund_logs;
CREATE TABLE _0019_order_status_history AS SELECT * FROM order_status_history;
CREATE TABLE _0019_shipping_outbox AS SELECT * FROM shipping_outbox;
CREATE TABLE _0019_shipping_shipments AS SELECT * FROM shipping_shipments;
CREATE TABLE _0019_deplao_automation_jobs AS SELECT * FROM deplao_automation_jobs;
CREATE TABLE _0019_sepay_order_links AS
  SELECT sepay_id, order_id FROM sepay_transactions WHERE order_id IS NOT NULL;
CREATE TABLE _0019_telegram_order_links AS
  SELECT id, order_id FROM telegram_order_outbox WHERE order_id IS NOT NULL;

CREATE TABLE product_orders_next (
  id TEXT PRIMARY KEY,
  order_code TEXT NOT NULL UNIQUE,
  checkout_idempotency_key TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT COLLATE NOCASE,
  locale TEXT NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en', 'ru', 'cn')),
  shipping_street TEXT NOT NULL,
  shipping_ward TEXT NOT NULL,
  shipping_district TEXT NOT NULL DEFAULT '',
  shipping_province TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled', 'refunded')),
  fulfillment_status TEXT NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'bank_transfer', 'cash')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  subtotal_price INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_price >= 0),
  discount_code TEXT,
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  taxable_amount INTEGER NOT NULL DEFAULT 0 CHECK (taxable_amount >= 0),
  tax_amount INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  shipping_provider TEXT,
  shipping_fee INTEGER NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  shipping_net_amount INTEGER NOT NULL DEFAULT 0 CHECK (shipping_net_amount >= 0),
  shipping_tax_rate REAL NOT NULL DEFAULT 0 CHECK (shipping_tax_rate >= 0),
  shipping_tax_amount INTEGER NOT NULL DEFAULT 0 CHECK (shipping_tax_amount >= 0),
  shipping_code TEXT,
  ghtk_label TEXT,
  ghtk_status_text TEXT,
  estimated_delivery_time TEXT,
  currency TEXT NOT NULL DEFAULT 'VND',
  grand_total INTEGER NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  total_price INTEGER NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  tax_profile_id TEXT,
  tax_mode TEXT CHECK (tax_mode IS NULL OR tax_mode IN ('exclusive', 'inclusive')),
  tax_rate REAL NOT NULL DEFAULT 0,
  payment_provider TEXT,
  payment_reference TEXT,
  payment_expires_at TEXT,
  paid_at TEXT,
  order_channel TEXT NOT NULL DEFAULT 'online' CHECK (order_channel IN ('online', 'pos')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO product_orders_next (
  id, order_code, checkout_idempotency_key, user_id, customer_name, customer_phone,
  customer_email, locale, shipping_street, shipping_ward, shipping_district,
  shipping_province, notes, status, fulfillment_status, payment_method, payment_status,
  subtotal_price, discount_code, discount_amount, taxable_amount, tax_amount,
  shipping_provider, shipping_fee, shipping_net_amount, shipping_tax_rate,
  shipping_tax_amount, shipping_code, ghtk_label, ghtk_status_text,
  estimated_delivery_time, currency, grand_total, total_price, tax_profile_id,
  tax_mode, tax_rate, payment_provider, payment_reference, payment_expires_at,
  paid_at, order_channel, created_at, updated_at
)
SELECT
  id, order_code, checkout_idempotency_key, user_id, customer_name, customer_phone,
  customer_email, locale, shipping_street, shipping_ward, shipping_district,
  shipping_province, notes, status, fulfillment_status, payment_method, payment_status,
  subtotal_price, discount_code, discount_amount, taxable_amount, tax_amount,
  shipping_provider, shipping_fee, shipping_net_amount, shipping_tax_rate,
  shipping_tax_amount, shipping_code, ghtk_label, ghtk_status_text,
  estimated_delivery_time, currency, grand_total, total_price, tax_profile_id,
  tax_mode, tax_rate, payment_provider, payment_reference, payment_expires_at,
  paid_at, 'online', created_at, updated_at
FROM product_orders;

DROP TABLE product_orders;
ALTER TABLE product_orders_next RENAME TO product_orders;

INSERT INTO product_order_items SELECT * FROM _0019_product_order_items;
INSERT INTO order_lookup_otps SELECT * FROM _0019_order_lookup_otps;
INSERT INTO order_payment_logs SELECT * FROM _0019_order_payment_logs;
INSERT INTO order_refund_logs SELECT * FROM _0019_order_refund_logs;
INSERT INTO order_status_history SELECT * FROM _0019_order_status_history;
INSERT INTO shipping_outbox SELECT * FROM _0019_shipping_outbox;
INSERT INTO shipping_shipments SELECT * FROM _0019_shipping_shipments;
INSERT INTO deplao_automation_jobs SELECT * FROM _0019_deplao_automation_jobs;

UPDATE sepay_transactions
SET order_id = (
  SELECT backup.order_id FROM _0019_sepay_order_links AS backup
  WHERE backup.sepay_id = sepay_transactions.sepay_id
)
WHERE sepay_id IN (SELECT sepay_id FROM _0019_sepay_order_links);

UPDATE telegram_order_outbox
SET order_id = (
  SELECT backup.order_id FROM _0019_telegram_order_links AS backup
  WHERE backup.id = telegram_order_outbox.id
)
WHERE id IN (SELECT id FROM _0019_telegram_order_links);

DROP TABLE _0019_product_order_items;
DROP TABLE _0019_order_lookup_otps;
DROP TABLE _0019_order_payment_logs;
DROP TABLE _0019_order_refund_logs;
DROP TABLE _0019_order_status_history;
DROP TABLE _0019_shipping_outbox;
DROP TABLE _0019_shipping_shipments;
DROP TABLE _0019_deplao_automation_jobs;
DROP TABLE _0019_sepay_order_links;
DROP TABLE _0019_telegram_order_links;

CREATE INDEX product_orders_user_idx ON product_orders(user_id, created_at DESC);
CREATE INDEX product_orders_email_idx ON product_orders(customer_email COLLATE NOCASE, created_at DESC);
CREATE INDEX product_orders_phone_idx ON product_orders(customer_phone, created_at DESC);
CREATE INDEX product_orders_status_idx ON product_orders(status, created_at DESC);
CREATE INDEX product_orders_created_idx ON product_orders(created_at DESC);
CREATE INDEX product_orders_channel_idx ON product_orders(order_channel, created_at DESC);
CREATE UNIQUE INDEX product_orders_payment_reference_idx
  ON product_orders(payment_reference)
  WHERE payment_reference IS NOT NULL;

PRAGMA defer_foreign_keys = OFF;
PRAGMA foreign_key_check;
