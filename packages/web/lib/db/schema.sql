CREATE TABLE IF NOT EXISTS coding_sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  handle TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  languages_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS coding_receipts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  session_id TEXT NOT NULL REFERENCES coding_sessions(id) ON DELETE CASCADE,
  handle TEXT NOT NULL DEFAULT 'anonymous',
  slug TEXT NOT NULL UNIQUE,
  signature_snippet TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  total_events INTEGER NOT NULL,
  edit_events INTEGER NOT NULL,
  run_events INTEGER NOT NULL,
  external_pastes INTEGER NOT NULL,
  internal_pastes INTEGER NOT NULL,
  longest_idle_ms INTEGER NOT NULL,
  snapshot_count INTEGER NOT NULL,
  signals_json TEXT NOT NULL,
  chain_ok INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS process_events (
  receipt_id TEXT NOT NULL REFERENCES coding_receipts(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('edit','paste','run','idle','focus','snapshot')),
  at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (receipt_id, seq)
);

CREATE INDEX IF NOT EXISTS process_events_receipt_idx ON process_events(receipt_id);
CREATE INDEX IF NOT EXISTS coding_receipts_handle_idx ON coding_receipts(handle);
CREATE INDEX IF NOT EXISTS coding_receipts_slug_idx ON coding_receipts(slug);
