PRAGMA foreign_keys = ON;

-- D1 export cannot dump FTS5 virtual tables. Search matching is exact-normalized,
-- so a regular indexed table is sufficient and can be backed up normally.
DROP TABLE IF EXISTS ingredient_search_fts;

CREATE TABLE IF NOT EXISTS ingredient_search_terms (
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  PRIMARY KEY (ingredient_id, term)
);
CREATE INDEX IF NOT EXISTS ingredient_search_terms_term_idx ON ingredient_search_terms(term);

INSERT OR IGNORE INTO ingredient_search_terms (ingredient_id, term)
SELECT id, inci_name_norm FROM ingredients;

INSERT OR IGNORE INTO ingredient_search_terms (ingredient_id, term)
SELECT ingredient_id, alias_norm FROM ingredient_aliases;
