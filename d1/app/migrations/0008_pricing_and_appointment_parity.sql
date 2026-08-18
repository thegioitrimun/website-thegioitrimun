PRAGMA foreign_keys = ON;

ALTER TABLE discount_codes ADD COLUMN description TEXT;

CREATE INDEX IF NOT EXISTS appointments_doctor_idx
  ON appointments(doctor_id, appointment_date, appointment_time);

CREATE TABLE IF NOT EXISTS tax_profiles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tax_mode TEXT NOT NULL DEFAULT 'exclusive' CHECK (tax_mode IN ('exclusive', 'inclusive')),
  default_rate REAL NOT NULL DEFAULT 0 CHECK (default_rate >= 0),
  applies_to_shipping INTEGER NOT NULL DEFAULT 0 CHECK (applies_to_shipping IN (0, 1)),
  currency TEXT NOT NULL DEFAULT 'VND',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tax_profiles_active_default_idx
  ON tax_profiles(is_active, is_default DESC, created_at);

CREATE TABLE IF NOT EXISTS tax_rates (
  id TEXT PRIMARY KEY,
  tax_profile_id TEXT NOT NULL REFERENCES tax_profiles(id) ON DELETE CASCADE,
  province TEXT COLLATE NOCASE,
  district TEXT COLLATE NOCASE,
  rate REAL NOT NULL CHECK (rate >= 0),
  applies_to_shipping INTEGER CHECK (applies_to_shipping IS NULL OR applies_to_shipping IN (0, 1)),
  currency TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tax_rates_profile_location_idx
  ON tax_rates(tax_profile_id, is_active, province COLLATE NOCASE, district COLLATE NOCASE, priority DESC);

INSERT OR IGNORE INTO tax_profiles (
  id, code, name, tax_mode, default_rate, applies_to_shipping, currency,
  is_active, is_default, created_at, updated_at
) VALUES (
  'tax-profile-vat-standard', 'VAT_STANDARD', 'VAT tiêu chuẩn', 'exclusive', 0.10, 0, 'VND',
  1, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
