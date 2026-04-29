import { NextResponse } from "next/server";
import { createSession, listSessions } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ sessions: listSessions() });
}

export async function POST() {
  const session = createSession();
  return NextResponse.json({ session }, { status: 201 });
}
