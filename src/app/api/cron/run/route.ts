import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authedCron } from "@/server/cron-auth";
import { runAutomationTick } from "@/server/services/automation";

// Idempotent maintenance tick — call every few minutes from an external scheduler.
export async function GET(request: NextRequest) {
  if (!authedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runAutomationTick();
  return NextResponse.json({ ok: true, ...result });
}
