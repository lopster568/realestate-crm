"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { addListItem, updateListItem, updateOrg } from "@/server/services/settings";
import type { ListKind } from "@/generated/prisma/client";

const orgSchema = z.object({
  name: z.string().min(1),
  currency: z.string().length(3),
  locale: z.string().min(2),
  timezone: z.string().min(1),
});

export type SettingsFormState = { error: string } | { saved: true } | undefined;

export async function updateOrgAction(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const user = await requireUser();
  const parsed = orgSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await updateOrg(user, parsed.data);
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function addListItemAction(kind: ListKind, formData: FormData) {
  const user = await requireUser();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  const color = String(formData.get("color") ?? "");
  const value = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  await addListItem(user, { kind, value, label, color: color || null });
  revalidatePath("/settings");
}

export async function toggleListItemAction(id: string, isActive: boolean) {
  const user = await requireUser();
  await updateListItem(user, id, { isActive });
  revalidatePath("/settings");
}

export async function renameListItemAction(id: string, label: string) {
  const user = await requireUser();
  if (!label.trim()) return;
  await updateListItem(user, id, { label: label.trim() });
  revalidatePath("/settings");
}
