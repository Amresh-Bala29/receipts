import type { ChainedEvent, ProcessEvent, Receipt } from "@receipts/shared";
import { computeAnalyzerSignals, processEventBatchSchema } from "@receipts/shared";
import { appendChainedEvent, verifyChainedEvents } from "./chain";
import {
  getReceiptBySlug,
  listReceiptsByHandle,
  mintReceipt as persistReceipt,
} from "./db/repository";

export type SessionRecord = {
  id: string;
  createdAt: string;
  author: { name: string; handle: string };
  events: ChainedEvent[];
};

type StoreState = {
  sessions: Map<string, SessionRecord>;
};

const globalForStore = globalThis as typeof globalThis & {
  __receiptsActiveStore?: StoreState;
};

function getActiveStore(): StoreState {
  globalForStore.__receiptsActiveStore ??= { sessions: new Map() };
  return globalForStore.__receiptsActiveStore;
}

function rowToReceipt(row: ReturnType<typeof listReceiptsByHandle>[number]): Receipt {
  return {
    id: row.slug,
    sessionId: row.sessionId,
    author: { name: row.handle, handle: row.handle },
    createdAt: row.createdAt,
    signatureSnippet: row.signatureSnippet,
    summary: row.summary,
    signals: row.signals,
    languages: row.languages,
    chainOk: row.chainOk,
  };
}

export function createSession(): SessionRecord {
  const session: SessionRecord = {
    id: `session-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    author: { name: "anonymous", handle: "anonymous" },
    events: [],
  };

  getActiveStore().sessions.set(session.id, session);
  return session;
}

export function appendEvents(sessionId: string, events: ProcessEvent[]) {
  const parsed = processEventBatchSchema.parse(events);
  const session = getActiveStore().sessions.get(sessionId);

  if (!session) {
    throw new Error("Session not found");
  }

  const appended = parsed.map((event) => {
    const chained = appendChainedEvent(session.events.at(-1) ?? null, event);
    session.events.push(chained);
    return chained;
  });

  return appended;
}

export function listSessions(): SessionRecord[] {
  return Array.from(getActiveStore().sessions.values());
}

export function listReceipts(handle = "maya.codes"): Receipt[] {
  return listReceiptsByHandle(handle).map(rowToReceipt);
}

export function getReceipt(slug: string) {
  const record = getReceiptBySlug(slug);
  if (!record) {
    return null;
  }

  const verification = verifyChainedEvents(record.events);
  return {
    receipt: { ...rowToReceipt(record.receipt), chainOk: verification.ok },
    events: record.events,
    verification,
  };
}

export function mintReceipt(sessionId: string, handle = "anonymous"): Receipt {
  const store = getActiveStore();
  const session = store.sessions.get(sessionId);

  if (!session) {
    throw new Error("Session not found");
  }

  const normalizedHandle = handle || "anonymous";
  const events = [...session.events].sort((left, right) => left.seq - right.seq);
  const { signals, summary } = computeAnalyzerSignals(events);
  if (summary.durationMs === 0 && events.length >= 2) {
    const first = events[0];
    const last = events.at(-1);
    console.error("Receipt duration computed as zero from multiple events", {
      firstAt: first?.at,
      lastAt: last?.at,
      deltaMs:
        first && last ? new Date(last.at).getTime() - new Date(first.at).getTime() : null,
    });
  }
  const finalHash = events.at(-1)?.hash ?? "unstarted";
  const verification = verifyChainedEvents(events);
  const persisted = persistReceipt({
    sessionId,
    handle: normalizedHandle,
    chainedEvents: events,
    summary,
    signals,
    signatureSnippet: finalHash.slice(0, 12),
    chainOk: verification.ok,
    languages: ["Python"],
  });

  store.sessions.delete(sessionId);

  return {
    id: persisted.slug,
    sessionId,
    author: { name: normalizedHandle, handle: normalizedHandle },
    createdAt: new Date().toISOString(),
    signatureSnippet: finalHash.slice(0, 12),
    summary,
    signals,
    languages: ["Python"],
    chainOk: verification.ok,
  };
}
