"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/session";
import {
  addNote,
  createLead,
  deleteLead,
  findDuplicates,
  logCall,
  updateLead,
  type LeadInput,
} from "@/server/services/leads";
import { scoreLeads, ScoringUnavailableError } from "@/server/services/scoring";

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  source: z.string().optional(),
  budget: z.coerce.number().positive().optional().or(z.literal("")),
  propertyType: z.string().optional(),
  assignedToId: z.string().optional(),
  notes: z.string().optional(),
  followUpDueAt: z.string().optional(),
});

function parseLeadForm(
  formData: FormData
): { ok: false; error: string } | { ok: true; data: LeadInput } {
  const raw = Object.fromEntries(formData.entries());
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  return {
    ok: true,
    data: {
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      status: d.status || undefined,
      priority: d.priority,
      source: d.source || null,
      budget: d.budget === "" || d.budget === undefined ? null : d.budget,
      propertyType: d.propertyType || null,
      assignedToId: d.assignedToId || null,
      notes: d.notes || null,
      followUpDueAt: d.followUpDueAt ? new Date(d.followUpDueAt) : null,
    },
  };
}

export type CreateLeadState =
  | { error: string }
  | { duplicates: Array<{ id: string; name: string; phone: string | null; email: string | null; status: string }> }
  | undefined;

export async function createLeadAction(
  _prev: CreateLeadState,
  formData: FormData
): Promise<CreateLeadState> {
  const user = await requireUser();
  const parsed = parseLeadForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  // Duplicate detection at capture — a second submit with force=1 overrides.
  if (!formData.get("force")) {
    const dupes = await findDuplicates(user, parsed.data.phone, parsed.data.email);
    if (dupes.length > 0) return { duplicates: dupes };
  }

  const lead = await createLead(user, parsed.data);
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function updateLeadAction(id: string, formData: FormData) {
  const user = await requireUser();
  const parsed = parseLeadForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  await updateLead(user, id, parsed.data);
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

const CHANGEABLE_FIELDS = ["status", "priority", "assignedToId", "followUpDueAt", "lostReason"] as const;

export async function changeLeadFieldAction(
  id: string,
  field: (typeof CHANGEABLE_FIELDS)[number],
  value: string
) {
  // Server actions are network endpoints — enforce the field whitelist at runtime too.
  if (!CHANGEABLE_FIELDS.includes(field)) throw new Error("Invalid field");
  const user = await requireUser();
  await updateLead(user, id, {
    [field]:
      field === "followUpDueAt" ? (value ? new Date(value) : null) : value || null,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function addNoteAction(id: string, formData: FormData) {
  const user = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  await addNote(user, id, text);
  revalidatePath(`/leads/${id}`);
}

export async function logCallAction(id: string, formData: FormData) {
  const user = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  await logCall(user, id, text);
  revalidatePath(`/leads/${id}`);
}

export async function deleteLeadAction(id: string) {
  const user = await requireUser();
  await deleteLead(user, id);
  revalidatePath("/leads");
  redirect("/leads");
}

export async function scoreLeadsAction(
  filters: { status?: string; assignedToId?: string } = {}
): Promise<{ scored: number; failed: number } | { error: string }> {
  const user = await requireUser();
  try {
    const result = await scoreLeads(user, filters);
    revalidatePath("/leads");
    return result;
  } catch (e) {
    if (e instanceof ScoringUnavailableError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "Scoring failed" };
  }
}
