import type { ChainedEvent } from "./chain";

export type ReplayAnnotation = {
  seq: number;
  offsetMs: number;
  kind: "paste" | "run" | "idle";
  label: string;
  tone: "good" | "neutral" | "concern";
};

function sortedEvents(events: ChainedEvent[]): ChainedEvent[] {
  return [...events].sort((left, right) => left.seq - right.seq);
}

function formatDurationCompact(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (ms < 3_600_000) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function reconstructFileState(
  events: ChainedEvent[],
  uptoSeq: number,
): Map<string, string> {
  const state = new Map<string, string>();
  const stopSeq = Math.max(0, uptoSeq);

  for (const event of sortedEvents(events)) {
    if (event.seq > stopSeq) {
      break;
    }

    if (event.kind !== "edit") {
      continue;
    }

    if (event.rangeStart > event.rangeEnd) {
      const nodeEnv = (
        globalThis as typeof globalThis & {
          process?: { env?: { NODE_ENV?: string } };
        }
      ).process?.env?.NODE_ENV;
      if (nodeEnv === "development") {
        console.warn(`Replay skipped invalid edit range for ${event.eventId}`);
      }
      continue;
    }

    const current = state.get(event.file) ?? "";
    const start = Math.max(0, Math.min(event.rangeStart, current.length));
    const end = Math.max(start, Math.min(event.rangeEnd, current.length));
    state.set(
      event.file,
      current.slice(0, start) + event.textInserted + current.slice(end),
    );
  }

  return state;
}

export function buildReplayIndex(events: ChainedEvent[]): {
  totalDurationMs: number;
  seqToOffsetMs: number[];
  editSeqs: number[];
  annotations: ReplayAnnotation[];
} {
  const ordered = sortedEvents(events);
  const firstAt = ordered[0]?.at ? Date.parse(ordered[0].at) : 0;
  const lastAt = ordered.at(-1)?.at ? Date.parse(ordered.at(-1)!.at) : firstAt;
  const seqToOffsetMs: number[] = [];
  const editSeqs: number[] = [];
  const annotations: ReplayAnnotation[] = [];

  for (const event of ordered) {
    const at = Date.parse(event.at);
    const offsetMs = Number.isFinite(at) ? Math.max(0, at - firstAt) : 0;
    seqToOffsetMs[event.seq] = offsetMs;

    if (event.kind === "edit") {
      editSeqs.push(event.seq);
    } else if (event.kind === "paste") {
      annotations.push({
        seq: event.seq,
        offsetMs,
        kind: "paste",
        label: `${event.length}-char ${event.source} paste`,
        tone:
          event.source === "external" && event.length > 40
            ? "concern"
            : "neutral",
      });
    } else if (event.kind === "run") {
      annotations.push({
        seq: event.seq,
        offsetMs,
        kind: "run",
        label: event.exitCode === 0 ? "Run succeeded" : "Run failed",
        tone: event.exitCode === 0 ? "good" : "neutral",
      });
    } else if (event.kind === "idle" && event.idleMs > 60_000) {
      annotations.push({
        seq: event.seq,
        offsetMs,
        kind: "idle",
        label: `${formatDurationCompact(event.idleMs)} of quiet thinking`,
        tone: "good",
      });
    }
  }

  return {
    totalDurationMs:
      ordered.length < 2 ? 0 : Math.max(0, lastAt - firstAt),
    seqToOffsetMs,
    editSeqs,
    annotations,
  };
}
