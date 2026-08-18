PRAGMA foreign_keys = ON;

ALTER TABLE appointments ADD COLUMN doctor_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS admin_report_schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  preset TEXT NOT NULL CHECK (preset IN ('7d', '30d', '90d')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly')),
  day_of_week INTEGER CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
  hour_local INTEGER NOT NULL CHECK (hour_local BETWEEN 0 AND 23),
  minute_local INTEGER NOT NULL DEFAULT 0 CHECK (minute_local BETWEEN 0 AND 59),
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  recipients_json TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  next_run_at TEXT,
  last_sent_at TEXT,
  last_error_at TEXT,
  last_error_message TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_report_schedules_due_idx
  ON admin_report_schedules(enabled, next_run_at);

