import type { NextRequest } from "next/server";
import { z } from "zod";
import { createVisit, listVisits } from "@/server/services/visits";
import { withUser } from "../util";

// Strict whitelist — API bodies must never reach Prisma unfiltered.
const visitBodySchema = z
  .object({
    leadId: z.string().min(1),
    propertyId: z.string().min(1),
    assignedToId: z.string().min(1),
    scheduledAt: z.string().datetime({ offset: true }),
    notes: z.string().nullish(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  return withUser((user) =>
    listVisits(user, {
      from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
      to: sp.get("to") ? new Date(sp.get("to")!) : undefined,
      assignedToId: sp.get("assignedToId") ?? undefined,
      status: sp.get("status") ?? undefined,
    })
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return withUser((user) => {
    const parsed = visitBodySchema.safeParse(body);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    return createVisit(user, { ...parsed.data, scheduledAt: new Date(parsed.data.scheduledAt) });
  });
}
