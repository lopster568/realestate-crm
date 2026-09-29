import type { NextRequest } from "next/server";
import { createLead, listLeads, type LeadInput } from "@/server/services/leads";
import { withUser } from "../util";
import { leadBodySchema, toLeadInput } from "./schema";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  return withUser((user) =>
    listLeads(
      user,
      {
        status: sp.get("status") ?? undefined,
        priority: sp.get("priority") ?? undefined,
        source: sp.get("source") ?? undefined,
        assignedToId: sp.get("assignedToId") ?? undefined,
        q: sp.get("q") ?? undefined,
      },
      Math.max(1, Number(sp.get("page")) || 1),
      Math.min(100, Number(sp.get("pageSize")) || 25)
    )
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return withUser((user) => {
    const parsed = leadBodySchema.safeParse(body);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    return createLead(user, toLeadInput(parsed.data) as LeadInput);
  });
}
