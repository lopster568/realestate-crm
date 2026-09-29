import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authedCron } from "@/server/cron-auth";
import { runDailyDigest } from "@/server/services/automation";

// Daily manager digest — schedule once a day.
export async function GET(request: NextRequest) {
  if (!authedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDailyDigest();
  return NextResponse.json({ ok: true, ...result });
}
