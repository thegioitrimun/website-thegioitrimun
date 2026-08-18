PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  inci_name TEXT NOT NULL,
  inci_name_norm TEXT NOT NULL UNIQUE,
  name_vi TEXT,
  description_vi TEXT,
  description_en TEXT,
  ewg_min INTEGER,
  ewg_max INTEGER,
  cir_rating TEXT CHECK (cir_rating IS NULL OR cir_rating IN ('A', 'B', 'C', 'D')),
  comedogenic_rating INTEGER,
  irritancy_rating INTEGER,
  flags_json TEXT NOT NULL DEFAULT '{}',
  source_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ingredients_ewg_idx ON ingredients(ewg_min, ewg_max);

CREATE TABLE IF NOT EXISTS ingredient_aliases (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_norm TEXT NOT NULL UNIQUE,
  locale TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ingredient_aliases_ingredient_idx ON ingredient_aliases(ingredient_id);

CREATE TABLE IF NOT EXISTS ingredient_functions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_vi TEXT NOT NULL,
  name_en TEXT,
  icon_key TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingredient_function_links (
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  function_id TEXT NOT NULL REFERENCES ingredient_functions(id) ON DELETE CASCADE,
  confidence REAL NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
  PRIMARY KEY (ingredient_id, function_id)
);

CREATE TABLE IF NOT EXISTS ingredient_skin_effects (
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  skin_type TEXT NOT NULL CHECK (skin_type IN ('dry', 'oily', 'sensitive')),
  effect TEXT NOT NULL CHECK (effect IN ('good', 'caution')),
  reason_vi TEXT,
  reason_en TEXT,
  PRIMARY KEY (ingredient_id, skin_type, effect)
);

CREATE TABLE IF NOT EXISTS analyzer_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS analyzer_rules_active_idx ON analyzer_rules(is_active, rule_type, priority DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS ingredient_search_fts USING fts5(
  ingredient_id UNINDEXED,
  term,
  tokenize = 'unicode61 remove_diacritics 2'
);
