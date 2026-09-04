PRAGMA foreign_keys = ON;

-- Dedicated VAT access is intentionally separate from the generic admin role.
INSERT OR IGNORE INTO roles (id, code, name, created_at)
VALUES ('role-accountant', 'accountant', 'Kế toán VAT', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- A single Vietnamese legal entity is supported in v1. The go-live date remains
-- NULL until the master admin approves classifications and explicitly enables it.
CREATE TABLE IF NOT EXISTS tax_entities (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  tax_code TEXT,
  address TEXT,
  tax_authority TEXT,
  default_method TEXT NOT NULL DEFAULT 'deduction_01'
    CHECK (default_method IN ('deduction_01', 'direct_04')),
  filing_cycle TEXT NOT NULL DEFAULT 'quarterly'
    CHECK (filing_cycle IN ('monthly', 'quarterly')),
  go_live_date TEXT,
  htkk_version TEXT NOT NULL DEFAULT 'pending_sample',
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  classifications_approved_at TEXT,
  classifications_approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO tax_entities (
  id, legal_name, default_method, filing_cycle, htkk_version, currency,
  timezone, is_active, created_at, updated_at
) VALUES (
  'tax-entity-primary', 'CHƯA CẤU HÌNH PHÁP NHÂN', 'deduction_01', 'quarterly',
  'pending_sample', 'VND', 'Asia/Ho_Chi_Minh', 0,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

CREATE TABLE IF NOT EXISTS vat_categories (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tax_class TEXT NOT NULL
    CHECK (tax_class IN ('non_subject', 'zero', 'reduced', 'standard')),
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  default_price_mode TEXT NOT NULL DEFAULT 'inclusive'
    CHECK (default_price_mode IN ('inclusive', 'exclusive')),
  direct_revenue_category TEXT NOT NULL DEFAULT 'goods'
    CHECK (direct_revenue_category IN ('goods', 'services', 'manufacturing_transport_goods_services', 'other')),
  reduction_eligible INTEGER NOT NULL DEFAULT 0 CHECK (reduction_eligible IN (0, 1)),
  effective_from TEXT,
  effective_to TEXT,
  legal_basis TEXT NOT NULL DEFAULT '',
  requires_approval INTEGER NOT NULL DEFAULT 1 CHECK (requires_approval IN (0, 1)),
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS vat_categories_effective_idx
  ON vat_categories(is_active, effective_from, effective_to, rate_bps);

INSERT OR IGNORE INTO vat_categories (
  id, code, name, tax_class, rate_bps, default_price_mode,
  direct_revenue_category, reduction_eligible, effective_from, effective_to,
  legal_basis, requires_approval, is_active, created_at, updated_at
) VALUES
  ('vat-cat-non-subject', 'NON_SUBJECT', 'Không chịu thuế', 'non_subject', 0, 'inclusive', 'goods', 0, NULL, NULL,
   'Luật Thuế GTGT và văn bản hướng dẫn có hiệu lực', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vat-cat-0', 'VAT_0', 'Thuế suất 0%', 'zero', 0, 'inclusive', 'goods', 0, NULL, NULL,
   'Luật 48/2024/QH15; Luật 149/2025/QH15; Luật 09/2026/QH16', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vat-cat-5', 'VAT_5', 'Thuế suất 5%', 'standard', 500, 'inclusive', 'goods', 0, NULL, NULL,
   'Luật 48/2024/QH15; Nghị định 181/2025/NĐ-CP', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vat-cat-8-2026', 'VAT_8_2026', 'Thuế suất giảm 8% đến 31/12/2026', 'reduced', 800, 'inclusive', 'goods', 1, '2025-07-01', '2026-12-31',
   'Nghị quyết 204/2025/QH15; Nghị định 174/2025/NĐ-CP; danh mục loại trừ phải được duyệt', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vat-cat-10', 'VAT_10', 'Thuế suất 10%', 'standard', 1000, 'inclusive', 'goods', 0, NULL, NULL,
   'Luật 48/2024/QH15; Luật 149/2025/QH15; Luật 09/2026/QH16; Nghị định 181/2025/NĐ-CP; Nghị định 144/2026/NĐ-CP', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS vat_rules (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES tax_entities(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL
    CHECK (rule_type IN ('category_rate', 'direct_rate', 'payment_warning', 'invoice_metadata')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  configuration_json TEXT NOT NULL DEFAULT '{}',
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  legal_basis TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_id, code, version)
);
CREATE INDEX IF NOT EXISTS vat_rules_effective_idx
  ON vat_rules(entity_id, rule_type, is_active, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS vat_direct_rates (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES tax_entities(id) ON DELETE CASCADE,
  revenue_category TEXT NOT NULL
    CHECK (revenue_category IN ('goods', 'services', 'manufacturing_transport_goods_services', 'other')),
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  legal_basis TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_id, revenue_category, version)
);

INSERT OR IGNORE INTO vat_direct_rates (
  id, entity_id, revenue_category, rate_bps, effective_from, legal_basis,
  version, created_at, updated_at
) VALUES
  ('vat-direct-goods-v1', 'tax-entity-primary', 'goods', 100, '2025-07-01', 'Tỷ lệ mặc định cần master admin xác nhận trước go-live', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vat-direct-services-v1', 'tax-entity-primary', 'services', 500, '2025-07-01', 'Tỷ lệ mặc định cần master admin xác nhận trước go-live', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vat-direct-manufacturing-v1', 'tax-entity-primary', 'manufacturing_transport_goods_services', 300, '2025-07-01', 'Tỷ lệ mặc định cần master admin xác nhận trước go-live', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vat-direct-other-v1', 'tax-entity-primary', 'other', 200, '2025-07-01', 'Tỷ lệ mặc định cần master admin xác nhận trước go-live', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE products ADD COLUMN vat_category_code TEXT;
ALTER TABLE products ADD COLUMN vat_classification_approved_at TEXT;
ALTER TABLE products ADD COLUMN vat_classification_approved_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE services ADD COLUMN vat_category_code TEXT;
ALTER TABLE services ADD COLUMN vat_classification_approved_at TEXT;
ALTER TABLE services ADD COLUMN vat_classification_approved_by TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Preserve the legacy rate as a suggested classification, but never mark it approved.
UPDATE products
SET vat_category_code = CASE
  WHEN vat_rate >= 0.099 THEN 'VAT_10'
  WHEN vat_rate >= 0.079 THEN 'VAT_8_2026'
  WHEN vat_rate >= 0.049 THEN 'VAT_5'
  WHEN vat_rate = 0 THEN 'VAT_0'
  ELSE NULL END
WHERE vat_category_code IS NULL;

CREATE TABLE IF NOT EXISTS sales_invoices (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES tax_entities(id),
  source_type TEXT NOT NULL
    CHECK (source_type IN ('online_order', 'pos_order', 'pancake_order', 'clinic_service', 'manual', 'import')),
  source_id TEXT,
  source_channel TEXT,
  invoice_template TEXT,
  invoice_series TEXT,
  invoice_number TEXT,
  invoice_code TEXT,
  invoice_date TEXT NOT NULL,
  issued_at TEXT,
  buyer_name TEXT,
  buyer_tax_code TEXT,
  buyer_address TEXT,
  buyer_email TEXT,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'replaced', 'adjusted', 'cancelled')),
  replaces_invoice_id TEXT REFERENCES sales_invoices(id),
  adjusts_invoice_id TEXT REFERENCES sales_invoices(id),
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  price_mode TEXT NOT NULL DEFAULT 'inclusive' CHECK (price_mode IN ('inclusive', 'exclusive')),
  subtotal_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  net_amount INTEGER NOT NULL DEFAULT 0,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  gross_amount INTEGER NOT NULL DEFAULT 0,
  reconciliation_status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (reconciliation_status IN ('candidate', 'matched', 'verified', 'excluded', 'issue')),
  reconciliation_note TEXT,
  source_checksum TEXT,
  import_job_id TEXT,
  idempotency_key TEXT UNIQUE,
  immutable_hash TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_invoices_source_unique
  ON sales_invoices(entity_id, source_type, source_id)
  WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_invoices_number_unique
  ON sales_invoices(entity_id, invoice_template, invoice_series, invoice_number, invoice_date)
  WHERE invoice_number IS NOT NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS sales_invoices_period_idx
  ON sales_invoices(entity_id, invoice_date, status, reconciliation_status);

CREATE TABLE IF NOT EXISTS sales_invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  source_type TEXT,
  source_id TEXT,
  description TEXT NOT NULL,
  unit TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price INTEGER NOT NULL DEFAULT 0,
  gross_before_discount INTEGER NOT NULL DEFAULT 0,
  allocated_discount INTEGER NOT NULL DEFAULT 0,
  vat_category_code TEXT NOT NULL,
  tax_class TEXT NOT NULL
    CHECK (tax_class IN ('non_subject', 'zero', 'reduced', 'standard')),
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  price_mode TEXT NOT NULL CHECK (price_mode IN ('inclusive', 'exclusive')),
  net_amount INTEGER NOT NULL,
  vat_amount INTEGER NOT NULL,
  gross_amount INTEGER NOT NULL,
  direct_revenue_category TEXT NOT NULL DEFAULT 'goods'
    CHECK (direct_revenue_category IN ('goods', 'services', 'manufacturing_transport_goods_services', 'other')),
  created_at TEXT NOT NULL,
  UNIQUE(invoice_id, line_number)
);
CREATE INDEX IF NOT EXISTS sales_invoice_lines_rate_idx ON sales_invoice_lines(invoice_id, rate_bps);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES tax_entities(id),
  supplier_name TEXT NOT NULL,
  supplier_tax_code TEXT,
  invoice_template TEXT,
  invoice_series TEXT,
  invoice_number TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  received_at TEXT,
  payment_method TEXT,
  payment_reference TEXT,
  paid_at TEXT,
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'replaced', 'adjusted', 'cancelled')),
  subtotal_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  net_amount INTEGER NOT NULL DEFAULT 0,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  deductible_vat_amount INTEGER NOT NULL DEFAULT 0,
  gross_amount INTEGER NOT NULL DEFAULT 0,
  deduction_status TEXT NOT NULL DEFAULT 'review'
    CHECK (deduction_status IN ('review', 'eligible', 'partial', 'excluded')),
  exclusion_reason TEXT,
  non_cash_payment_warning INTEGER NOT NULL DEFAULT 0 CHECK (non_cash_payment_warning IN (0, 1)),
  warning_note TEXT,
  import_job_id TEXT,
  idempotency_key TEXT UNIQUE,
  immutable_hash TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_invoices_number_unique
  ON purchase_invoices(entity_id, supplier_tax_code, invoice_series, invoice_number, invoice_date)
  WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS purchase_invoices_period_idx
  ON purchase_invoices(entity_id, invoice_date, status, deduction_status);
CREATE INDEX IF NOT EXISTS purchase_invoices_supplier_day_idx
  ON purchase_invoices(entity_id, supplier_tax_code, invoice_date);

CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  description TEXT NOT NULL,
  unit TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price INTEGER NOT NULL DEFAULT 0,
  gross_before_discount INTEGER NOT NULL DEFAULT 0,
  allocated_discount INTEGER NOT NULL DEFAULT 0,
  vat_category_code TEXT NOT NULL,
  tax_class TEXT NOT NULL
    CHECK (tax_class IN ('non_subject', 'zero', 'reduced', 'standard')),
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  price_mode TEXT NOT NULL CHECK (price_mode IN ('inclusive', 'exclusive')),
  net_amount INTEGER NOT NULL,
  vat_amount INTEGER NOT NULL,
  deductible_vat_amount INTEGER NOT NULL DEFAULT 0,
  gross_amount INTEGER NOT NULL,
  exclusion_reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(invoice_id, line_number)
);

CREATE TABLE IF NOT EXISTS vat_periods (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES tax_entities(id),
  period_key TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  filing_cycle TEXT NOT NULL CHECK (filing_cycle IN ('monthly', 'quarterly')),
  method TEXT NOT NULL CHECK (method IN ('deduction_01', 'direct_04')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'locked', 'filed', 'amended')),
  method_snapshot_json TEXT NOT NULL,
  opening_credit_amount INTEGER NOT NULL DEFAULT 0,
  output_vat_amount INTEGER NOT NULL DEFAULT 0,
  input_vat_amount INTEGER NOT NULL DEFAULT 0,
  deductible_input_vat_amount INTEGER NOT NULL DEFAULT 0,
  adjustment_amount INTEGER NOT NULL DEFAULT 0,
  tax_payable_amount INTEGER NOT NULL DEFAULT 0,
  closing_credit_amount INTEGER NOT NULL DEFAULT 0,
  direct_revenue_amount INTEGER NOT NULL DEFAULT 0,
  direct_tax_amount INTEGER NOT NULL DEFAULT 0,
  reconciliation_issue_count INTEGER NOT NULL DEFAULT 0,
  submitted_for_review_at TEXT,
  locked_at TEXT,
  locked_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  filed_at TEXT,
  filed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  parent_period_id TEXT REFERENCES vat_periods(id),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_id, period_key, parent_period_id)
);
CREATE INDEX IF NOT EXISTS vat_periods_dates_idx ON vat_periods(entity_id, starts_on, ends_on, status);

CREATE TABLE IF NOT EXISTS vat_period_entries (
  period_id TEXT NOT NULL REFERENCES vat_periods(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('sales', 'purchase', 'adjustment')),
  entry_id TEXT NOT NULL,
  immutable_hash TEXT NOT NULL,
  net_amount INTEGER NOT NULL DEFAULT 0,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  deductible_vat_amount INTEGER NOT NULL DEFAULT 0,
  direct_revenue_category TEXT,
  rate_bps INTEGER,
  created_at TEXT NOT NULL,
  PRIMARY KEY(period_id, entry_type, entry_id)
);

CREATE TABLE IF NOT EXISTS vat_adjustments (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES vat_periods(id),
  adjustment_type TEXT NOT NULL
    CHECK (adjustment_type IN ('output_increase', 'output_decrease', 'input_increase', 'input_decrease', 'credit_carry', 'other')),
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  legal_basis TEXT,
  source_period_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'voided')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vat_return_versions (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES vat_periods(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  return_form TEXT NOT NULL CHECK (return_form IN ('01/GTGT', '04/GTGT')),
  htkk_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'locked', 'filed', 'superseded')),
  snapshot_json TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  xml_validation_status TEXT NOT NULL DEFAULT 'pending_sample'
    CHECK (xml_validation_status IN ('pending_sample', 'internal_valid', 'htkk_valid', 'failed')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE(period_id, version_number)
);

CREATE TABLE IF NOT EXISTS vat_import_jobs (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES tax_entities(id),
  import_type TEXT NOT NULL CHECK (import_type IN ('sales', 'purchase')),
  file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'previewed'
    CHECK (status IN ('previewed', 'committed', 'failed', 'cancelled')),
  row_count INTEGER NOT NULL DEFAULT 0,
  valid_count INTEGER NOT NULL DEFAULT 0,
  issue_count INTEGER NOT NULL DEFAULT 0,
  preview_json TEXT NOT NULL DEFAULT '[]',
  committed_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vat_import_issues (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL REFERENCES vat_import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER,
  field_name TEXT,
  issue_code TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('warning', 'error')),
  message TEXT NOT NULL,
  raw_value TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS vat_import_issues_job_idx ON vat_import_issues(import_job_id, row_number);

CREATE TABLE IF NOT EXISTS vat_documents (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES tax_entities(id),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('sales_invoice', 'purchase_invoice', 'period', 'return_version')),
  owner_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS vat_documents_owner_idx ON vat_documents(owner_type, owner_id, created_at DESC);

-- Previously missing source queues/history. source_hash protects D1-only data from
-- accidental overwrite during insert-only delta migration.
CREATE TABLE IF NOT EXISTS catalog_seo_events (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  source_table TEXT NOT NULL,
  product_id INTEGER,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  processed_at TEXT,
  source_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS catalog_seo_events_queue_idx ON catalog_seo_events(processed_at, created_at);

CREATE TABLE IF NOT EXISTS product_ingredient_sync_events (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  source_updated_at TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  source_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS product_ingredient_sync_events_queue_idx
  ON product_ingredient_sync_events(processed_at, attempt_count, created_at);

CREATE TABLE IF NOT EXISTS product_generation_jobs (
  id TEXT PRIMARY KEY,
  input_name TEXT NOT NULL,
  normalized_slug TEXT,
  status TEXT NOT NULL,
  generated_payload_json TEXT NOT NULL DEFAULT '{}',
  validation_warnings_json TEXT NOT NULL DEFAULT '[]',
  model TEXT,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  source_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS product_generation_jobs_status_idx ON product_generation_jobs(status, updated_at DESC);

-- Clinical parity destinations remain available even though the source tables are empty.
CREATE TABLE IF NOT EXISTS clinic_invoices (
  id TEXT PRIMARY KEY,
  medical_record_id TEXT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  sales_invoice_id TEXT REFERENCES sales_invoices(id) ON DELETE SET NULL,
  total_amount INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
  payment_date TEXT,
  payment_method TEXT,
  notes TEXT,
  source_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinic_performed_services (
  id TEXT PRIMARY KEY,
  medical_record_id TEXT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  date_performed TEXT,
  performer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  source_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinic_prescribed_medications (
  id TEXT PRIMARY KEY,
  medical_record_id TEXT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  duration_days INTEGER,
  unit TEXT,
  route TEXT,
  total_quantity INTEGER,
  dispensed_status TEXT,
  notes TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  source_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Versioned content replacements for contact_page_content and testimonials.
CREATE TABLE IF NOT EXISTS source_content_versions (
  id TEXT PRIMARY KEY,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  site_resource TEXT NOT NULL,
  site_resource_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  source_updated_at TEXT,
  imported_at TEXT NOT NULL,
  UNIQUE(source_table, source_id, source_hash)
);
CREATE INDEX IF NOT EXISTS source_content_versions_lookup_idx
  ON source_content_versions(source_table, source_id, imported_at DESC);

-- Every migration conflict is recorded; the delta importer never overwrites it.
CREATE TABLE IF NOT EXISTS source_migration_manifest (
  source_table TEXT PRIMARY KEY,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('table', 'site_content', 'vat_model', 'view_replacement')),
  target_name TEXT NOT NULL,
  primary_key_json TEXT NOT NULL DEFAULT '[]',
  transform_rule TEXT NOT NULL,
  source_row_count INTEGER NOT NULL DEFAULT 0,
  imported_row_count INTEGER NOT NULL DEFAULT 0,
  skipped_row_count INTEGER NOT NULL DEFAULT 0,
  conflict_row_count INTEGER NOT NULL DEFAULT 0,
  source_checksum TEXT,
  verified_at TEXT,
  updated_at TEXT NOT NULL
);

PRAGMA foreign_key_check;
