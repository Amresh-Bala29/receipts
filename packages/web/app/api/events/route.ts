import { NextResponse } from "next/server";
import { z } from "zod";
import { processEventBatchSchema } from "@receipts/shared";
import { appendEvents } from "@/lib/store";

export const dynamic = "force-dynamic";

const appendEventsSchema = z.object({
  sessionId: z.string().min(1),
  events: processEventBatchSchema,
});

export async function POST(request: Request) {
  const parsed = appendEventsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const appended = appendEvents(parsed.data.sessionId, parsed.data.events);
    return NextResponse.json({ appended });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to append" },
      { status: 404 },
    );
  }
}
