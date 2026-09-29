import { prisma } from "@/server/db";
import { assertCan, can } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/session";

export async function listTasks(user: SessionUser, opts: { all?: boolean } = {}) {
  const teamWide = opts.all && can(user.role, "task", "viewAll");
  const rows = await prisma.task.findMany({
    where: {
      orgId: user.orgId,
      ...(teamWide ? {} : { assignedToId: user.id }),
    },
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 200,
  });
  return rows.map((t) => ({
    ...t,
    dueAt: t.dueAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export async function createTask(
  user: SessionUser,
  input: { title: string; dueAt?: Date | null; assignedToId?: string; linkedType?: string; linkedId?: string }
) {
  assertCan(user.role, "task", "create");
  await prisma.task.create({
    data: {
      orgId: user.orgId,
      title: input.title,
      dueAt: input.dueAt,
      assignedToId: input.assignedToId ?? user.id,
      linkedType: input.linkedType,
      linkedId: input.linkedId,
    },
  });
}

export async function toggleTask(user: SessionUser, id: string) {
  const task = await prisma.task.findFirst({ where: { id, orgId: user.orgId } });
  if (!task) throw new Error("Task not found");
  if (task.assignedToId !== user.id) assertCan(user.role, "task", "viewAll");
  await prisma.task.update({
    where: { id },
    data: { status: task.status === "OPEN" ? "DONE" : "OPEN" },
  });
}

/** Snooze: push the due date forward by N days. */
export async function snoozeTask(user: SessionUser, id: string, days: number) {
  const task = await prisma.task.findFirst({ where: { id, orgId: user.orgId } });
  if (!task) throw new Error("Task not found");
  if (task.assignedToId !== user.id) assertCan(user.role, "task", "viewAll");
  const base = task.dueAt && task.dueAt > new Date() ? task.dueAt : new Date();
  await prisma.task.update({
    where: { id },
    data: { dueAt: new Date(base.getTime() + days * 86400000) },
  });
}

export async function deleteTask(user: SessionUser, id: string) {
  const task = await prisma.task.findFirst({ where: { id, orgId: user.orgId } });
  if (!task) throw new Error("Task not found");
  if (task.assignedToId !== user.id) assertCan(user.role, "task", "delete");
  await prisma.task.delete({ where: { id } });
}

export type SerializedTask = Awaited<ReturnType<typeof listTasks>>[number];
