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
