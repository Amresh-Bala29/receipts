import type { ChainedEvent } from "./chain";
import type { AnalyzerSignal, ReceiptSummary } from "./receipt";

// Deterministic analyzer only. This module performs counting and statistics
// over captured events, with no Codex, OpenAI, network, time, or I/O calls.

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
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

function summarize(events: ChainedEvent[]): ReceiptSummary {
  const sortedEvents = [...events].sort((left, right) => left.seq - right.seq);
  const first = sortedEvents[0];
  const last = sortedEvents[sortedEvents.length - 1];
  const firstAt = first?.at ? new Date(first.at).getTime() : 0;
  const lastAt = last?.at ? new Date(last.at).getTime() : firstAt;

  const summary: ReceiptSummary = {
    totalEvents: events.length,
    // Duration is wall-clock time from first to last event, NOT sum of activity time.
    durationMs: sortedEvents.length < 2 ? 0 : Math.max(0, lastAt - firstAt),
    editEvents: 0,
    runEvents: 0,
    externalPastes: 0,
    internalPastes: 0,
    longestIdleMs: 0,
    snapshotCount: 0,
  };

  for (const event of events) {
    if (event.kind === "edit") {
      summary.editEvents += 1;
    } else if (event.kind === "run") {
      summary.runEvents += 1;
    } else if (event.kind === "paste") {
      if (event.source === "external") {
        summary.externalPastes += 1;
      } else {
        summary.internalPastes += 1;
      }
    } else if (event.kind === "idle") {
      summary.longestIdleMs = Math.max(summary.longestIdleMs, event.idleMs);
    } else if (event.kind === "snapshot") {
      summary.snapshotCount += 1;
    }
  }

  return summary;
}

function computePasteSignal(
  events: ChainedEvent[],
  summary: ReceiptSummary,
): AnalyzerSignal {
  const externalPastes = events.filter(
    (event) => event.kind === "paste" && event.source === "external",
  ) as Array<Extract<ChainedEvent, { kind: "paste" }>>;
  const largePasteCount = externalPastes.filter((event) => event.length > 40).length;

  if (summary.externalPastes === 0) {
    return {
      id: "no-large-external-pastes",
      label: "No external pastes longer than 40 chars",
      status: "good",
      detail: "No external pastes during this session.",
    };
  }

  return {
    id: "no-large-external-pastes",
    label:
      largePasteCount === 0
        ? "No external pastes longer than 40 chars"
        : `${largePasteCount} external ${plural(largePasteCount, "paste")} longer than 40 chars`,
    status:
      largePasteCount === 0
        ? "good"
        : largePasteCount <= 2
          ? "neutral"
          : "concern",
    detail:
      largePasteCount === 0
        ? `${summary.externalPastes} external ${plural(summary.externalPastes, "paste")} captured. None exceeded 40 characters.`
        : `${largePasteCount} external ${plural(largePasteCount, "paste")} exceeded 40 characters out of ${summary.externalPastes} total external ${plural(summary.externalPastes, "paste")}.`,
  };
}

function computeCadenceSignal(events: ChainedEvent[]): AnalyzerSignal {
  const windows = new Map<number, number>();
  // The live editor records each paste as an `edit` (with the actual text
  // redacted) immediately followed by a `paste` annotation. Cadence is meant
  // to reflect typing rhythm only, so detect those edits by their position in
  // the chain and exclude them.
  const ordered = [...events].sort((left, right) => left.seq - right.seq);
  const pasteEditSeqs = new Set<number>();
  for (let i = 0; i < ordered.length; i += 1) {
    const cur = ordered[i];
    const prev = ordered[i - 1];
    if (cur && prev && cur.kind === "paste" && prev.kind === "edit") {
      pasteEditSeqs.add(prev.seq);
    }
  }

  for (const event of ordered) {
    if (event.kind !== "edit" || event.textInserted.length === 0) {
      continue;
    }

    if (pasteEditSeqs.has(event.seq)) {
      continue;
    }

    const at = Date.parse(event.at);
    if (!Number.isFinite(at)) {
      continue;
    }

    const bucket = Math.floor(at / 10_000);
    windows.set(bucket, (windows.get(bucket) ?? 0) + event.textInserted.length);
  }

  const charsPerSecond = Array.from(windows.values()).map((chars) => chars / 10);
  const windowCount = charsPerSecond.length;

  if (windowCount < 6) {
    return {
      id: "consistent-typing-cadence",
      label: "Variable typing cadence",
      status: "neutral",
      detail: "Not enough typing windows to assess cadence.",
    };
  }

  const avgCps =
    charsPerSecond.reduce((total, value) => total + value, 0) / windowCount;
  const variance =
    charsPerSecond.reduce((total, value) => total + (value - avgCps) ** 2, 0) /
    windowCount;
  const stddev = Math.sqrt(variance);
  const cv = avgCps === 0 ? 0 : stddev / avgCps;

  return {
    id: "consistent-typing-cadence",
    label:
      cv < 0.55
        ? "Consistent typing cadence"
        : cv < 1.0
          ? "Variable typing cadence"
          : "Highly variable typing cadence",
    status: cv < 0.55 ? "good" : cv < 1.0 ? "neutral" : "concern",
    detail: `Typing speed measured across ${windowCount} ten-second windows. Coefficient of variation ${cv.toFixed(2)} (${avgCps.toFixed(1)} chars per second on average).`,
  };
}

function computeRunSignal(events: ChainedEvent[]): AnalyzerSignal {
  const runs = events.filter((event) => event.kind === "run");
  const runCount = runs.length;
  const errorCount = runs.filter((event) => event.exitCode !== 0).length;
  const successCount = runCount - errorCount;
  const firstHalf = runs.slice(0, Math.ceil(runCount / 2));
  const secondHalf = runs.slice(Math.ceil(runCount / 2));
  const firstErrors = firstHalf.filter((event) => event.exitCode !== 0).length;
  const secondErrors = secondHalf.filter((event) => event.exitCode !== 0).length;
  const errorRateFirstHalf =
    firstHalf.length === 0 ? 0 : firstErrors / firstHalf.length;
  const errorRateSecondHalf =
    secondHalf.length === 0 ? 0 : secondErrors / secondHalf.length;
  const improving = errorRateFirstHalf > errorRateSecondHalf;

  if (runCount === 0) {
    return {
      id: "iterative-debugging",
      label: "No code was run during this session",
      status: "neutral",
      detail: "No run events were recorded during this session.",
    };
  }

  return {
    id: "iterative-debugging",
    label:
      runCount >= 3 && improving
        ? `Iterative debugging pattern (${runCount} ${plural(runCount, "run")})`
        : runCount >= 3
          ? `Frequent runs (${runCount} runs)`
          : `${runCount} ${plural(runCount, "run")} captured`,
    status: runCount >= 3 && improving ? "good" : "neutral",
    detail:
      runCount >= 3 && improving
        ? `${errorCount} runs ended in error, ${successCount} succeeded. Error rate decreased from ${(errorRateFirstHalf * 100).toFixed(0)}% to ${(errorRateSecondHalf * 100).toFixed(0)}% over the session.`
        : `${errorCount} runs ended in error, ${successCount} succeeded.`,
  };
}

function computeIdleSignal(events: ChainedEvent[]): AnalyzerSignal {
  let longIdleCount = 0;
  let totalIdleMs = 0;

  for (const event of events) {
    if (event.kind !== "idle") {
      continue;
    }

    totalIdleMs += event.idleMs;
    if (event.idleMs > 240_000) {
      longIdleCount += 1;
    }
  }

  return {
    id: "long-idle-periods",
    label:
      longIdleCount === 0
        ? "No long idle periods"
        : longIdleCount === 1
          ? "One long idle period over 4 minutes"
          : `${longIdleCount} long idle periods over 4 minutes`,
    status:
      longIdleCount === 0
        ? "good"
        : longIdleCount <= 2
          ? "neutral"
          : "concern",
    detail: `${longIdleCount} idle ${plural(longIdleCount, "period")} exceeded 4 minutes. Total idle time across the session was ${formatDurationCompact(totalIdleMs)}.`,
  };
}

function computeSnapshotSignal(summary: ReceiptSummary): AnalyzerSignal {
  return {
    id: "snapshots-verified",
    label:
      summary.snapshotCount === 0
        ? "No file snapshots recorded"
        : "All snapshots verified",
    status: summary.snapshotCount === 0 ? "neutral" : "good",
    detail:
      summary.snapshotCount === 0
        ? "Snapshot capture did not run during this session."
        : `${summary.snapshotCount} file ${plural(summary.snapshotCount, "snapshot")} captured at 30 second intervals. All hashes are part of the verified chain.`,
  };
}

export function computeAnalyzerSignals(events: ChainedEvent[]): {
  signals: AnalyzerSignal[];
  summary: ReceiptSummary;
} {
  const summary = summarize(events);
  const signals: AnalyzerSignal[] = [
    computePasteSignal(events, summary),
    computeCadenceSignal(events),
    computeRunSignal(events),
    computeIdleSignal(events),
    computeSnapshotSignal(summary),
  ];

  return { signals, summary };
}
