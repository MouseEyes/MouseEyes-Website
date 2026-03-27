CREATE TABLE IF NOT EXISTS download_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  updates INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_download_signups_created_at
  ON download_signups(created_at);