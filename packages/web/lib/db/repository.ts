import type {
  AnalyzerSignal,
  ChainedEvent,
  ProcessEvent,
  ReceiptSummary,
} from "@receipts/shared";
import { getDb, prepare } from "./index";
import { generateSlug } from "./slug";
import type { CodingReceiptRow } from "./types";
import {
  buildAlgorithmChain,
  buildApiClientChain,
  buildBrokenPalindromeChain,
  buildDemoChain,
  buildRegexFixChain,
  buildReceipt,
  buildSortingLabChain,
} from "@/lib/mock-data";

// Hybrid persistence: active editor sessions stay in memory for fast capture.
// SQLite receives one durable transaction at mint time, when the receipt becomes
// a public artifact. Public reads then come only from the file-backed database.

type DbReceiptRecord = {
  id: string;
  created_at: string;
  session_id: string;
  handle: string;
  slug: string;
  signature_snippet: string;
  duration_ms: number;
  total_events: number;
  edit_events: number;
  run_events: number;
  external_pastes: number;
  internal_pastes: number;
  longest_idle_ms: number;
  snapshot_count: number;
  signals_json: string;
  chain_ok: number;
  languages_json: string;
};

type DbEventRecord = {
  seq: number;
  event_id: string;
  kind: ProcessEvent["kind"];
  at: string;
  payload_json: string;
  prev_hash: string;
  hash: string;
};

type MintInput = {
  sessionId: string;
  handle: string;
  chainedEvents: ChainedEvent[];
  summary: ReceiptSummary;
  signals: AnalyzerSignal[];
  signatureSnippet: string;
  chainOk: boolean;
  languages: string[];
  slug?: string;
};

function parseReceipt(row: DbReceiptRecord): CodingReceiptRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    sessionId: row.session_id,
    handle: row.handle,
    slug: row.slug,
    signatureSnippet: row.signature_snippet,
    summary: {
      totalEvents: row.total_events,
      durationMs: row.duration_ms,
      editEvents: row.edit_events,
      runEvents: row.run_events,
      externalPastes: row.external_pastes,
      internalPastes: row.internal_pastes,
      longestIdleMs: row.longest_idle_ms,
      snapshotCount: row.snapshot_count,
    },
    signals: JSON.parse(row.signals_json) as AnalyzerSignal[],
    languages: JSON.parse(row.languages_json) as string[],
    chainOk: row.chain_ok === 1,
  };
}

function processEventPayload(event: ChainedEvent): ProcessEvent {
  const { seq: _seq, prevHash: _prevHash, hash: _hash, ...payload } = event;
  return payload;
}

function insertReceiptWithSlug(input: MintInput, slug: string) {
  const db = getDb();
  const receiptId = `receipt-${crypto.randomUUID()}`;
  const orderedEvents = [...input.chainedEvents].sort(
    (left, right) => left.seq - right.seq,
  );
  const startedAt = orderedEvents[0]?.at ?? new Date().toISOString();
  const endedAt = orderedEvents.at(-1)?.at ?? startedAt;
  const insertSession = prepare(
    "upsert-session",
    `INSERT INTO coding_sessions (id, handle, started_at, ended_at, languages_json)
     VALUES (@id, @handle, @startedAt, @endedAt, @languagesJson)
     ON CONFLICT(id) DO UPDATE SET
       handle = excluded.handle,
       ended_at = excluded.ended_at,
       languages_json = excluded.languages_json`,
  );
  const insertReceipt = prepare(
    "insert-receipt",
    `INSERT INTO coding_receipts (
      id, session_id, handle, slug, signature_snippet, duration_ms, total_events,
      edit_events, run_events, external_pastes, internal_pastes, longest_idle_ms,
      snapshot_count, signals_json, chain_ok
    ) VALUES (
      @id, @sessionId, @handle, @slug, @signatureSnippet, @durationMs, @totalEvents,
      @editEvents, @runEvents, @externalPastes, @internalPastes, @longestIdleMs,
      @snapshotCount, @signalsJson, @chainOk
    )`,
  );
  const insertEvent = prepare(
    "insert-event",
    `INSERT INTO process_events (
      receipt_id, seq, event_id, kind, at, payload_json, prev_hash, hash
    ) VALUES (
      @receiptId, @seq, @eventId, @kind, @at, @payloadJson, @prevHash, @hash
    )`,
  );

  const write = db.transaction(() => {
    insertSession.run({
      id: input.sessionId,
      handle: input.handle,
      startedAt,
      endedAt,
      languagesJson: JSON.stringify(input.languages),
    });
    insertReceipt.run({
      id: receiptId,
      sessionId: input.sessionId,
      handle: input.handle,
      slug,
      signatureSnippet: input.signatureSnippet,
      durationMs: input.summary.durationMs,
      totalEvents: input.summary.totalEvents,
      editEvents: input.summary.editEvents,
      runEvents: input.summary.runEvents,
      externalPastes: input.summary.externalPastes,
      internalPastes: input.summary.internalPastes,
      longestIdleMs: input.summary.longestIdleMs,
      snapshotCount: input.summary.snapshotCount,
      signalsJson: JSON.stringify(input.signals),
      chainOk: input.chainOk ? 1 : 0,
    });
    for (const event of orderedEvents) {
      insertEvent.run({
        receiptId,
        seq: event.seq,
        eventId: event.eventId,
        kind: event.kind,
        at: event.at,
        payloadJson: JSON.stringify(processEventPayload(event)),
        prevHash: event.prevHash,
        hash: event.hash,
      });
    }
  });

  write();
  return { id: receiptId, slug };
}

export function createSession(input: {
  handle: string | null;
  startedAt: string;
  languages: string[];
}): { id: string } {
  const id = `session-${crypto.randomUUID()}`;
  prepare(
    "create-session",
    `INSERT INTO coding_sessions (id, handle, started_at, languages_json)
     VALUES (@id, @handle, @startedAt, @languagesJson)`,
  ).run({
    id,
    handle: input.handle,
    startedAt: input.startedAt,
    languagesJson: JSON.stringify(input.languages),
  });
  return { id };
}

export function appendEventsToSession(
  _sessionId: string,
  _events: ChainedEvent[],
): void {
  // Active session events are intentionally not written before mint.
}

export function mintReceipt(input: MintInput): { id: string; slug: string } {
  if (input.slug) {
    return insertReceiptWithSlug(input, input.slug);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return insertReceiptWithSlug(input, generateSlug());
    } catch (error) {
      lastError = error;
      if (
        !(
          error instanceof Error &&
          error.message.includes("UNIQUE constraint failed")
        )
      ) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to mint");
}

export function getReceiptBySlug(slug: string): {
  receipt: CodingReceiptRow;
  events: ChainedEvent[];
} | null {
  const receiptRow = prepare<[string]>(
    "get-receipt-by-slug",
    `SELECT r.*, s.languages_json
     FROM coding_receipts r
     JOIN coding_sessions s ON s.id = r.session_id
     WHERE r.slug = ?`,
  ).get(slug) as DbReceiptRecord | undefined;

  if (!receiptRow) {
    return null;
  }

  const eventRows = prepare<[string]>(
    "get-events-by-receipt",
    `SELECT seq, event_id, kind, at, payload_json, prev_hash, hash
     FROM process_events
     WHERE receipt_id = ?
     ORDER BY seq ASC`,
  ).all(receiptRow.id) as DbEventRecord[];

  const events = eventRows.map((row) => ({
    ...(JSON.parse(row.payload_json) as ProcessEvent),
    seq: row.seq,
    prevHash: row.prev_hash,
    hash: row.hash,
  }));

  return { receipt: parseReceipt(receiptRow), events };
}

export function listReceiptsByHandle(
  handle: string,
  limit = 50,
): CodingReceiptRow[] {
  const rows = prepare<{ handle: string; limit: number }>(
    "list-receipts-by-handle",
    `SELECT r.*, s.languages_json
     FROM coding_receipts r
     JOIN coding_sessions s ON s.id = r.session_id
     WHERE r.handle = @handle
     ORDER BY r.created_at DESC
     LIMIT @limit`,
  ).all({ handle, limit }) as DbReceiptRecord[];
  return rows.map(parseReceipt);
}

export function countReceiptsByHandle(handle: string): number {
  const row = prepare<[string]>(
    "count-receipts-by-handle",
    "SELECT COUNT(*) as count FROM coding_receipts WHERE handle = ?",
  ).get(handle) as { count: number } | undefined;
  return row?.count ?? 0;
}

function countReceipts(): number {
  const row = prepare<[]>(
    "count-receipts",
    "SELECT COUNT(*) as count FROM coding_receipts",
  ).get() as { count: number } | undefined;
  return row?.count ?? 0;
}

function seedReceipt(
  id: string,
  sessionId: string,
  events: ChainedEvent[],
  slug?: string,
) {
  const receipt = buildReceipt(id, sessionId, events, {
    name: "Maya Chen",
    handle: "maya.codes",
  });
  if (slug === "broken" && receipt.chainOk) {
    throw new Error("Broken seed unexpectedly verified cleanly");
  }
  mintReceipt({
    sessionId,
    handle: "maya.codes",
    chainedEvents: events,
    summary: receipt.summary,
    signals: receipt.signals,
    signatureSnippet: receipt.signatureSnippet,
    chainOk: receipt.chainOk,
    languages: receipt.languages,
    slug,
  });
}

export function seedIfEmpty() {
  const requiredSeedSlugs = ["demo", "sort", "api", "reg", "algo", "broken"];
  const existingRequired = requiredSeedSlugs.filter(
    (slug) => getReceiptBySlug(slug) !== null,
  );
  if (countReceipts() > 0 && existingRequired.length === requiredSeedSlugs.length) {
    return;
  }

  const knownSeedSessions = [
    "demo-session",
    "session-sorting-lab",
    "session-api-client",
    "session-portfolio-task",
    "session-sort",
    "session-api",
    "session-reg",
    "session-algo",
    "session-broken",
  ];
  const knownSeedSlugs = [
    "demo",
    "sort24",
    "api789",
    "prt234",
    "sort",
    "api",
    "reg",
    "algo",
    "broken",
  ];
  const sessionPlaceholders = knownSeedSessions.map(() => "?").join(",");
  const slugPlaceholders = knownSeedSlugs.map(() => "?").join(",");
  getDb()
    .prepare(
      `DELETE FROM coding_receipts
       WHERE session_id IN (${sessionPlaceholders}) OR slug IN (${slugPlaceholders})`,
    )
    .run(...knownSeedSessions, ...knownSeedSlugs);

  seedReceipt("demo", "demo-session", buildDemoChain(), "demo");
  seedReceipt(
    "sort",
    "session-sort",
    buildSortingLabChain("session-sort"),
    "sort",
  );
  seedReceipt(
    "api",
    "session-api",
    buildApiClientChain("session-api"),
    "api",
  );
  seedReceipt(
    "reg",
    "session-reg",
    buildRegexFixChain("session-reg"),
    "reg",
  );
  seedReceipt(
    "algo",
    "session-algo",
    buildAlgorithmChain("session-algo"),
    "algo",
  );
  seedReceipt(
    "broken",
    "session-broken",
    buildBrokenPalindromeChain("session-broken"),
    "broken",
  );
}

// Skip during `next build`. Next 14 evaluates each route module in parallel
// workers when collecting page data, which races the DELETE/INSERT seed steps
// against the slug UNIQUE constraint. Production servers and dev mode each run
// in a single process, so seeding stays correct there.
if (process.env.NEXT_PHASE !== "phase-production-build") {
  seedIfEmpty();
}
