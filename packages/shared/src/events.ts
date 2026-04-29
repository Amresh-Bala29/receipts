import { z } from "zod";

const baseEventSchema = z.object({
  eventId: z.string().min(1),
  sessionId: z.string().min(1),
  at: z.string().datetime(),
});

export const editEventSchema = baseEventSchema.extend({
  kind: z.literal("edit"),
  file: z.string().min(1),
  rangeStart: z.number().int().nonnegative(),
  rangeEnd: z.number().int().nonnegative(),
  textInserted: z.string(),
  textRemoved: z.string(),
});

export const pasteEventSchema = baseEventSchema.extend({
  kind: z.literal("paste"),
  file: z.string().min(1),
  length: z.number().int().nonnegative(),
  source: z.enum(["external", "internal"]),
});

export const runEventSchema = baseEventSchema.extend({
  kind: z.literal("run"),
  command: z.string().min(1),
  exitCode: z.number().int(),
  stdoutPreview: z.string(),
  stderrPreview: z.string(),
  durationMs: z.number().int().nonnegative(),
});

export const idleEventSchema = baseEventSchema.extend({
  kind: z.literal("idle"),
  file: z.string().min(1),
  idleMs: z.number().int().nonnegative(),
});

export const focusEventSchema = baseEventSchema.extend({
  kind: z.literal("focus"),
  file: z.string().min(1),
  gained: z.boolean(),
});

export const snapshotEventSchema = baseEventSchema.extend({
  kind: z.literal("snapshot"),
  file: z.string().min(1),
  contentHash: z.string().min(1),
});

// Privacy property: paste events intentionally store only length and source.
// Receipts must never capture, transmit, or persist clipboard contents.
export const processEventSchema = z.discriminatedUnion("kind", [
  editEventSchema,
  pasteEventSchema,
  runEventSchema,
  idleEventSchema,
  focusEventSchema,
  snapshotEventSchema,
]);

export const processEventBatchSchema = z.array(processEventSchema);

export type ProcessEvent = z.infer<typeof processEventSchema>;

// Visible filler used in `textInserted` for paste-origin edits. The actual
// pasted characters are forbidden by the privacy contract (receipts are
// public), but storing nothing breaks replay reconstruction: the edit's
// rangeStart/rangeEnd are still applied, so a paste over a selection wipes
// content and a paste outside selection desyncs every later edit's offsets.
// A same-length filler keeps reconstruction faithful while leaking nothing
// beyond the length already published in the paste event.
export const PASTE_REDACTION_CHAR = "█"; // FULL BLOCK

export function redactPasteText(text: string): string {
  // Preserve newlines so replay shows the paste's line structure (and so
  // line-number descriptions for later edits stay correct). Everything else
  // becomes the redaction block.
  return text.replace(/[^\n]/g, PASTE_REDACTION_CHAR);
}

export function isRedactedPasteText(text: string): boolean {
  if (text.length === 0) return false;
  for (const ch of text) {
    if (ch !== PASTE_REDACTION_CHAR && ch !== "\n") return false;
  }
  return true;
}
