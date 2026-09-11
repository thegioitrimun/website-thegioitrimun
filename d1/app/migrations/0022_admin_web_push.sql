-- Future orders only. A trigger keeps every order source and its notification atomic.
CREATE TABLE admin_push_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  order_code TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE admin_push_read_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  read_seq INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE admin_push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  subscribed_seq INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX admin_push_subscriptions_user ON admin_push_subscriptions(user_id, active);
CREATE TABLE admin_push_deliveries (
  event_seq INTEGER NOT NULL REFERENCES admin_push_events(seq) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL REFERENCES admin_push_subscriptions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_status INTEGER,
  PRIMARY KEY (event_seq, subscription_id)
);
CREATE INDEX admin_push_deliveries_due ON admin_push_deliveries(status, next_attempt_at);
CREATE TRIGGER admin_push_new_order AFTER INSERT ON product_orders
WHEN julianday(NEW.created_at) >= julianday('now', '-1 day') BEGIN
  INSERT OR IGNORE INTO admin_push_events(order_id, order_code) VALUES (NEW.id, NEW.order_code);
  INSERT OR IGNORE INTO admin_push_deliveries(event_seq, subscription_id)
    SELECT e.seq, s.id FROM admin_push_events e, admin_push_subscriptions s
    WHERE e.order_id = NEW.id AND s.active = 1 AND s.subscribed_seq < e.seq;
END;
