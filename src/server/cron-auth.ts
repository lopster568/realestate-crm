import type { NextRequest } from "next/server";

/**
 * Cron/webhook routes bypass the session proxy and authenticate with a shared
 * secret instead (human = session, machine = secret). Accepts either the
 * Authorization: Bearer header or a ?secret= query param.
 */
export function authedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  if (request.nextUrl.searchParams.get("secret") === secret) return true;
  return false;
}
