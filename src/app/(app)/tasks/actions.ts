"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/session";
import { createTask, deleteTask, snoozeTask, toggleTask } from "@/server/services/tasks";

export async function createTaskAction(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const dueAt = String(formData.get("dueAt") ?? "");
  const assignedToId = String(formData.get("assignedToId") ?? "");
  await createTask(user, {
    title,
    dueAt: dueAt ? new Date(dueAt) : null,
    assignedToId: assignedToId || undefined,
  });
  revalidatePath("/tasks");
}

export async function toggleTaskAction(id: string) {
  const user = await requireUser();
  await toggleTask(user, id);
  revalidatePath("/tasks");
}

export async function snoozeTaskAction(id: string, days: number) {
  const user = await requireUser();
  await snoozeTask(user, id, days);
  revalidatePath("/tasks");
}

export async function deleteTaskAction(id: string) {
  const user = await requireUser();
  await deleteTask(user, id);
  revalidatePath("/tasks");
}
