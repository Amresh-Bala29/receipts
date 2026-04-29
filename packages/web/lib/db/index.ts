import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS coding_sessions (
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
CREATE INDEX IF NOT EXISTS coding_receipts_slug_idx ON coding_receipts(slug);`;

function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  // Vercel and AWS Lambda only allow writes under /tmp. Without this fallback
  // the default path lands under cwd (/var/task), which is read-only and
  // would EACCES on first request.
  if (process.env.VERCEL || process.env.LAMBDA_TASK_ROOT) {
    return "/tmp/receipts.db";
  }
  return path.join(process.cwd(), "data", "receipts.db");
}

const dbPath = resolveDbPath();

mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
const statements = new Map<string, Database.Statement>();

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

db.exec(SCHEMA_SQL);

export function getDb() {
  return db;
}

export function prepare<T extends unknown[] | Record<string, unknown>>(
  key: string,
  sql: string,
) {
  let statement = statements.get(key);
  if (!statement) {
    statement = db.prepare<T>(sql);
    statements.set(key, statement);
  }
  return statement;
}
