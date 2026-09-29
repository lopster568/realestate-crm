"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/session";
import { createView, deleteView } from "@/server/services/views";
import { bulkDeleteLeads, bulkUpdateLeads, type BulkLeadPatch } from "@/server/services/bulk";
import { updateLead } from "@/server/services/leads";

export async function createViewAction(input: { name: string; query: string; shared: boolean }) {
  const user = await requireUser();
  await createView(user, { ...input, resource: "lead" });
  revalidatePath("/leads");
}

export async function deleteViewAction(id: string) {
  const user = await requireUser();
  await deleteView(user, id);
  revalidatePath("/leads");
}

export async function bulkUpdateLeadsAction(ids: string[], patch: BulkLeadPatch) {
  const user = await requireUser();
  const result = await bulkUpdateLeads(user, ids, patch);
  revalidatePath("/leads");
  return result;
}

export async function bulkDeleteLeadsAction(ids: string[]) {
  const user = await requireUser();
  const result = await bulkDeleteLeads(user, ids);
  revalidatePath("/leads");
  return result;
}

/** Set the full tag list on a single lead (used from the lead detail page). */
export async function setLeadTagsAction(id: string, tags: string[]) {
  const user = await requireUser();
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
  await updateLead(user, id, { tags: clean });
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}
