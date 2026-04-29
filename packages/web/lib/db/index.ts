import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const defaultPath = path.join(process.cwd(), "data", "receipts.db");
const dbPath = process.env.DB_PATH ?? defaultPath;
const schemaPath = path.join(process.cwd(), "lib", "db", "schema.sql");

mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
const statements = new Map<string, Database.Statement>();

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

function initIfEmpty() {
  const schema = readFileSync(schemaPath, "utf8");
  db.exec(schema);
}

initIfEmpty();

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
