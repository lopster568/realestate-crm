"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { createTeamMember, deleteTeamMember, updateTeamMember } from "@/server/services/team";

const memberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid work email required"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "AGENT"]),
  shift: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  monthlyConversions: z.coerce.number().int().min(0).optional().or(z.literal("")),
  monthlyRevenue: z.coerce.number().min(0).optional().or(z.literal("")),
});

export type MemberFormState = { error: string } | undefined;

function parseMember(formData: FormData) {
  const parsed = memberSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  const targets: Record<string, number> = {};
  if (d.monthlyConversions !== "" && d.monthlyConversions !== undefined)
    targets.monthlyConversions = d.monthlyConversions;
  if (d.monthlyRevenue !== "" && d.monthlyRevenue !== undefined)
    targets.monthlyRevenue = d.monthlyRevenue;
  return {
    ok: true as const,
    data: {
      name: d.name,
      email: d.email,
      phone: d.phone || null,
      role: d.role,
      shift: d.shift || null,
      password: d.password || undefined,
      targets: Object.keys(targets).length ? targets : null,
    },
  };
}

export async function createMemberAction(
  _prev: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const user = await requireUser();
  const parsed = parseMember(formData);
  if (!parsed.ok) return { error: parsed.error };
  if (!parsed.data.password) return { error: "Initial password is required" };
  try {
    await createTeamMember(user, parsed.data);
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: "A user with that email already exists" };
    }
    throw e;
  }
  revalidatePath("/team");
}

export async function updateMemberAction(
  id: string,
  _prev: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const user = await requireUser();
  const parsed = parseMember(formData);
  if (!parsed.ok) return { error: parsed.error };
  await updateTeamMember(user, id, parsed.data);
  revalidatePath("/team");
}

export async function toggleMemberActiveAction(id: string, isActive: boolean) {
  const user = await requireUser();
  await updateTeamMember(user, id, { isActive });
  revalidatePath("/team");
}

export async function deleteMemberAction(id: string) {
  const user = await requireUser();
  await deleteTeamMember(user, id);
  revalidatePath("/team");
}
