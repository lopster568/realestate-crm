import { NextResponse } from "next/server";
import { resolveSessionUser, type SessionUser } from "@/server/session";

/**
 * REST handlers for API clients (mobile app in P4). Cookie-session authed for now;
 * token auth becomes an additional strategy here without touching the services.
 */
export async function withUser<T>(
  handler: (user: SessionUser) => Promise<T>
): Promise<NextResponse> {
  const user = await resolveSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await handler(user);
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    const status = message.startsWith("Forbidden") ? 403 : message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
