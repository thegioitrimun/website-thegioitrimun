PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  object_path TEXT NOT NULL,
  public_url TEXT,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  etag TEXT,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TEXT,
  last_seen_at TEXT NOT NULL,
  deleted_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(bucket, object_path)
);
CREATE INDEX IF NOT EXISTS media_assets_bucket_path_idx ON media_assets(bucket, object_path);
CREATE INDEX IF NOT EXISTS media_assets_uploaded_idx ON media_assets(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS media_assets_active_idx ON media_assets(deleted_at, bucket, updated_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  request_method TEXT NOT NULL,
  request_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'attempted' CHECK (status IN ('attempted', 'succeeded', 'failed')),
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_audit_actor_idx ON admin_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_entity_idx ON admin_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS migration_issues (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  issue_code TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  resolution_status TEXT NOT NULL DEFAULT 'open' CHECK (resolution_status IN ('open', 'resolved', 'unrecoverable')),
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_system, entity_type, entity_id, issue_code)
);
CREATE INDEX IF NOT EXISTS migration_issues_status_idx ON migration_issues(resolution_status, entity_type, updated_at DESC);
