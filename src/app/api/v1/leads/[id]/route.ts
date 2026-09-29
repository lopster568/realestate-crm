import type { NextRequest } from "next/server";
import { deleteLead, getLead, updateLead } from "@/server/services/leads";
import { withUser } from "../../util";
import { leadPatchSchema, toLeadInput } from "../schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  return withUser(async (user) => {
    const lead = await getLead(user, id);
    if (!lead) throw new Error("Lead not found");
    return lead;
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  return withUser((user) => {
    const parsed = leadPatchSchema.safeParse(body);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    return updateLead(user, id, toLeadInput(parsed.data));
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  return withUser(async (user) => {
    await deleteLead(user, id);
    return { ok: true };
  });
}
