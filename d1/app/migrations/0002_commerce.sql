PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS product_categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT, name_ru TEXT, name_cn TEXT,
  description TEXT, description_en TEXT, description_ru TEXT, description_cn TEXT,
  image_path TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_brands (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT,
  logo_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  sku TEXT UNIQUE,
  category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
  brand TEXT,
  name TEXT NOT NULL,
  name_en TEXT, name_ru TEXT, name_cn TEXT,
  description TEXT, description_en TEXT, description_ru TEXT, description_cn TEXT,
  long_description TEXT, long_description_en TEXT, long_description_ru TEXT, long_description_cn TEXT,
  usage_instructions TEXT, usage_instructions_en TEXT, usage_instructions_ru TEXT, usage_instructions_cn TEXT,
  ingredients TEXT, ingredients_en TEXT, ingredients_ru TEXT, ingredients_cn TEXT,
  inci_text TEXT,
  key_benefits_json TEXT NOT NULL DEFAULT '[]',
  key_benefits_en_json TEXT NOT NULL DEFAULT '[]',
  key_benefits_ru_json TEXT NOT NULL DEFAULT '[]',
  key_benefits_cn_json TEXT NOT NULL DEFAULT '[]',
  skin_types_json TEXT NOT NULL DEFAULT '[]',
  faq_items_json TEXT NOT NULL DEFAULT '[]',
  precautions TEXT, precautions_en TEXT, precautions_ru TEXT, precautions_cn TEXT,
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  vat_rate REAL NOT NULL DEFAULT 0 CHECK (vat_rate >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  volume TEXT,
  origin TEXT, origin_en TEXT, origin_ru TEXT, origin_cn TEXT,
  texture TEXT, texture_en TEXT, texture_ru TEXT, texture_cn TEXT,
  expiry_date TEXT,
  sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  archived_at TEXT,
  source_updated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS products_brand_idx ON products(brand COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS products_published_created_idx ON products(is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS products_featured_idx ON products(is_featured, is_published);
CREATE INDEX IF NOT EXISTS products_name_idx ON products(name COLLATE NOCASE);

CREATE TRIGGER IF NOT EXISTS products_prevent_negative_stock
BEFORE UPDATE OF stock_quantity ON products
WHEN NEW.stock_quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_STOCK');
END;

CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  alt_text TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images(product_id, is_primary DESC, display_order);

CREATE TABLE IF NOT EXISTS product_ingredient_snapshots (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  inci_text TEXT NOT NULL,
  inci_hash TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  recognized_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  analyzer_version TEXT NOT NULL,
  source_updated_at TEXT,
  analyzed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS product_ingredient_snapshots_hash_idx ON product_ingredient_snapshots(inci_hash);

CREATE TABLE IF NOT EXISTS discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
  value REAL NOT NULL CHECK (value >= 0),
  min_purchase_amount INTEGER NOT NULL DEFAULT 0 CHECK (min_purchase_amount >= 0),
  max_discount_amount INTEGER,
  starts_at TEXT,
  ends_at TEXT,
  usage_limit INTEGER,
  usage_limit_per_user INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS discount_codes_active_idx ON discount_codes(is_active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id TEXT PRIMARY KEY,
  discount_code_id TEXT NOT NULL REFERENCES discount_codes(id),
  order_id TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_email TEXT COLLATE NOCASE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_orders (
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
  payment_method TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'bank_transfer')),
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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS product_orders_user_idx ON product_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_orders_email_idx ON product_orders(customer_email COLLATE NOCASE, created_at DESC);
CREATE INDEX IF NOT EXISTS product_orders_phone_idx ON product_orders(customer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS product_orders_status_idx ON product_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_orders_created_idx ON product_orders(created_at DESC);

CREATE TABLE IF NOT EXISTS product_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT,
  product_image_path TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_purchase INTEGER NOT NULL CHECK (price_at_purchase >= 0),
  vat_rate REAL NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(order_id, product_id)
);
CREATE INDEX IF NOT EXISTS product_order_items_order_idx ON product_order_items(order_id);
CREATE INDEX IF NOT EXISTS product_order_items_product_idx ON product_order_items(product_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS order_status_history_order_idx ON order_status_history(order_id, created_at);

CREATE TABLE IF NOT EXISTS order_payment_logs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('unpaid', 'paid', 'failed', 'refunded')),
  transaction_ref TEXT,
  paid_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS order_payment_logs_order_idx ON order_payment_logs(order_id, created_at);

CREATE TABLE IF NOT EXISTS order_refund_logs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  restocked INTEGER NOT NULL DEFAULT 0 CHECK (restocked IN (0, 1)),
  refunded_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id TEXT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  comment TEXT NOT NULL,
  verified_purchase INTEGER NOT NULL DEFAULT 0 CHECK (verified_purchase IN (0, 1)),
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS product_reviews_product_idx ON product_reviews(product_id, is_published, created_at DESC);

CREATE TABLE IF NOT EXISTS wishlists (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id)
);
