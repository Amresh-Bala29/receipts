import type { ProcessEvent } from "./events";

export type ChainedEvent = ProcessEvent & {
  seq: number;
  prevHash: string;
  hash: string;
};

const encoder = new TextEncoder();

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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      encoder.encode(input),
    );
    return bytesToHex(new Uint8Array(digest));
  }

  throw new Error("SHA-256 Web Crypto support is unavailable.");
}

export async function appendToChain(
  prev: ChainedEvent | null,
  next: ProcessEvent,
): Promise<ChainedEvent> {
  const seq = prev ? prev.seq + 1 : 1;
  const prevHash = prev?.hash ?? "genesis";
  const hash = await sha256Hex(stableJson({ event: next, seq, prevHash }));
  return { ...next, seq, prevHash, hash };
}

export async function verifyChain(
  events: ChainedEvent[],
): Promise<{ ok: boolean; brokenAtSeq?: number }> {
  const orderedEvents = [...events].sort((left, right) => left.seq - right.seq);
  let prev: ChainedEvent | null = null;

  for (const event of orderedEvents) {
    const { seq, prevHash, hash, ...processEvent } = event;
    const expectedPrevHash = prev?.hash ?? "genesis";
    const expectedSeq = prev ? prev.seq + 1 : 1;
    const expectedHash = await sha256Hex(
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
