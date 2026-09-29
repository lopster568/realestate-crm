"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { createVisit, deleteVisit, findConflicts, updateVisit } from "@/server/services/visits";
import type { VisitStatus } from "@/generated/prisma/client";

const visitSchema = z.object({
  leadId: z.string().min(1, "Lead is required"),
  propertyId: z.string().min(1, "Property is required"),
  assignedToId: z.string().min(1, "Agent is required"),
  scheduledAt: z.string().min(1, "Date & time required"),
  notes: z.string().optional(),
});

export type VisitFormState =
  | { error: string }
  | { conflicts: Array<{ id: string; leadName: string; propertyTitle: string; scheduledAt: string }> }
  | undefined;

export async function createVisitAction(
  _prev: VisitFormState,
  formData: FormData
): Promise<VisitFormState> {
  const user = await requireUser();
  const parsed = visitSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;
  const scheduledAt = new Date(d.scheduledAt);

  if (!formData.get("force")) {
    const conflicts = await findConflicts(user, d.assignedToId, scheduledAt);
    if (conflicts.length > 0) {
      return {
        conflicts: conflicts.map((c) => ({
          id: c.id,
          leadName: c.lead.name,
          propertyTitle: c.property.title,
          scheduledAt: c.scheduledAt.toISOString(),
        })),
      };
    }
  }

  await createVisit(user, {
    leadId: d.leadId,
    propertyId: d.propertyId,
    assignedToId: d.assignedToId,
    scheduledAt,
    notes: d.notes || null,
  });
  revalidatePath("/site-visits");
  revalidatePath(`/leads/${d.leadId}`);
}

export async function updateVisitStatusAction(id: string, status: VisitStatus, outcome?: string) {
  const user = await requireUser();
  await updateVisit(user, id, { status, ...(outcome ? { outcome } : {}) });
  revalidatePath("/site-visits");
}

export async function deleteVisitAction(id: string) {
  const user = await requireUser();
  await deleteVisit(user, id);
  revalidatePath("/site-visits");
}
