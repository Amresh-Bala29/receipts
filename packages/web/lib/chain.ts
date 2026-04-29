import { createHash } from "node:crypto";
import type { ChainedEvent, ProcessEvent } from "@receipts/shared";

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function appendChainedEvent(
  prev: ChainedEvent | null,
  next: ProcessEvent,
): ChainedEvent {
  const seq = prev ? prev.seq + 1 : 1;
  const prevHash = prev?.hash ?? "genesis";
  const hash = sha256Hex(stableJson({ event: next, seq, prevHash }));
  return { ...next, seq, prevHash, hash };
}

export function verifyChainedEvents(
  events: ChainedEvent[],
): { ok: boolean; brokenAtSeq?: number } {
  const orderedEvents = [...events].sort((left, right) => left.seq - right.seq);
  let prev: ChainedEvent | null = null;

  for (const event of orderedEvents) {
    const { seq, prevHash, hash, ...processEvent } = event;
    const expectedSeq = prev ? prev.seq + 1 : 1;
    const expectedPrevHash = prev?.hash ?? "genesis";
    const expectedHash = sha256Hex(
      stableJson({ event: processEvent, seq, prevHash }),
    );

    if (
      seq !== expectedSeq ||
      prevHash !== expectedPrevHash ||
      hash !== expectedHash
    ) {
      return { ok: false, brokenAtSeq: seq };
    }

    prev = event;
  }

  return { ok: true };
}
