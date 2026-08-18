PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS funnel_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  path TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS funnel_events_name_created_idx
ON funnel_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS funnel_events_session_created_idx
ON funnel_events(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS funnel_events_user_created_idx
ON funnel_events(user_id, created_at DESC)
WHERE user_id IS NOT NULL;
