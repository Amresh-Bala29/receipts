import { NextResponse } from "next/server";
import { z } from "zod";
import { listReceipts, mintReceipt } from "@/lib/store";

const mintReceiptSchema = z.object({
  sessionId: z.string().min(1),
  handle: z.string().min(1).optional(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle") || "maya.codes";
  return NextResponse.json({ receipts: listReceipts(handle) });
}

export async function POST(request: Request) {
  const parsed = mintReceiptSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid receipt payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const receipt = mintReceipt(
      parsed.data.sessionId,
      parsed.data.handle ?? "anonymous",
    );
    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to mint" },
      { status: 404 },
    );
  }
}
