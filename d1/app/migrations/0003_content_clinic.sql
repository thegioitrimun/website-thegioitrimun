PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT, name_ru TEXT, name_cn TEXT,
  description TEXT, description_en TEXT, description_ru TEXT, description_cn TEXT,
  long_description TEXT, long_description_en TEXT, long_description_ru TEXT, long_description_cn TEXT,
  benefits_json TEXT NOT NULL DEFAULT '[]',
  benefits_en_json TEXT NOT NULL DEFAULT '[]',
  benefits_ru_json TEXT NOT NULL DEFAULT '[]',
  benefits_cn_json TEXT NOT NULL DEFAULT '[]',
  faq_items_json TEXT NOT NULL DEFAULT '[]',
  local_seo_tags_json TEXT NOT NULL DEFAULT '[]',
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  duration_minutes INTEGER,
  image_path TEXT,
  icon TEXT,
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS services_published_idx ON services(is_published, is_featured, updated_at DESC);

CREATE TABLE IF NOT EXISTS procedure_steps (
  id TEXT PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(service_id, step_number)
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT COLLATE NOCASE,
  customer_phone TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en', 'ru', 'cn')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rescheduled', 'completed', 'cancelled')),
  notes TEXT,
  internal_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments(appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON appointments(status, appointment_date);
CREATE INDEX IF NOT EXISTS appointments_email_idx ON appointments(customer_email COLLATE NOCASE, created_at DESC);

CREATE TABLE IF NOT EXISTS blog_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT, name_ru TEXT, name_cn TEXT,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category_slug TEXT REFERENCES blog_categories(slug) ON DELETE SET NULL,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  title_en TEXT, title_ru TEXT, title_cn TEXT,
  summary TEXT, summary_en TEXT, summary_ru TEXT, summary_cn TEXT,
  content TEXT, content_en TEXT, content_ru TEXT, content_cn TEXT,
  image_path TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  canonical_url TEXT,
  local_seo_tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS blog_posts_public_idx ON blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON blog_posts(category_slug, status, published_at DESC);

CREATE TABLE IF NOT EXISTS site_content (
  resource TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (resource, resource_key)
);
CREATE INDEX IF NOT EXISTS site_content_resource_idx ON site_content(resource, is_published);

CREATE TABLE IF NOT EXISTS patient_profiles (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth TEXT,
  gender TEXT,
  address_json TEXT NOT NULL DEFAULT '{}',
  emergency_contact_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS medical_records (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  practitioner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  summary TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  private_document_prefix TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS medical_records_patient_idx ON medical_records(patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS private_documents (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medical_record_id TEXT REFERENCES medical_records(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  checksum TEXT,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS private_documents_owner_idx ON private_documents(owner_user_id, created_at DESC);
