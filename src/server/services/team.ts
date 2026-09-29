import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/session";
import type { Role } from "@/generated/prisma/client";

export async function listTeam(user: SessionUser) {
  assertCan(user.role, "team", "viewAll");
  const users = await prisma.user.findMany({
    where: { orgId: user.orgId, deletedAt: null },
    select: {
      id: true, name: true, email: true, role: true, phone: true,
      isActive: true, shift: true, targets: true, createdAt: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), targets: u.targets as Record<string, number> | null }));
}

/** Minimal list for assignment dropdowns — any role can read names of active teammates. */
export async function listAssignees(user: SessionUser) {
  const users = await prisma.user.findMany({
    where: { orgId: user.orgId, deletedAt: null, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return users;
}

export async function teamPerformance(user: SessionUser) {
  assertCan(user.role, "team", "viewAll");
  const members = await prisma.user.findMany({
    where: { orgId: user.orgId, deletedAt: null },
    select: { id: true, name: true, role: true, isActive: true },
  });
  const [assigned, converted, visits, revenue] = await Promise.all([
    prisma.lead.groupBy({
      by: ["assignedToId"],
      where: { orgId: user.orgId, deletedAt: null },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["assignedToId"],
      where: { orgId: user.orgId, deletedAt: null, status: "converted" },
      _count: true,
    }),
    prisma.siteVisit.groupBy({
      by: ["assignedToId"],
      where: { orgId: user.orgId, deletedAt: null, status: "COMPLETED" },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["assignedToId"],
      where: { orgId: user.orgId, deletedAt: null, status: "converted" },
      _sum: { budget: true },
    }),
  ]);
  const by = <T extends { assignedToId: string | null }>(rows: T[]) =>
    new Map(rows.map((r) => [r.assignedToId, r]));
  const a = by(assigned), c = by(converted), v = by(visits), r = by(revenue);

  return members.map((m) => {
    const total = a.get(m.id)?._count ?? 0;
    const won = c.get(m.id)?._count ?? 0;
    return {
      ...m,
      assigned: total,
      converted: won,
      winRate: total ? Math.round((won / total) * 100) : 0,
      completedVisits: v.get(m.id)?._count ?? 0,
      revenue: Number(r.get(m.id)?._sum.budget ?? 0),
    };
  });
}

export type TeamMemberInput = {
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  password?: string;
  shift?: string | null;
  targets?: Record<string, number> | null;
};

export async function createTeamMember(user: SessionUser, input: TeamMemberInput) {
  assertCan(user.role, "team", "manage");
  const { password, ...rest } = input;
  const member = await prisma.user.create({
    data: {
      ...rest,
      targets: rest.targets ?? undefined,
      orgId: user.orgId,
      passwordHash: bcrypt.hashSync(password || Math.random().toString(36).slice(2, 10), 10),
    },
  });
  await audit(user, "user.create", "user", member.id, { after: { email: member.email, role: member.role } });
  return member.id;
}

export async function updateTeamMember(
  user: SessionUser,
  id: string,
  input: Partial<TeamMemberInput> & { isActive?: boolean }
) {
  assertCan(user.role, "team", "manage");
  const existing = await prisma.user.findFirst({ where: { id, orgId: user.orgId, deletedAt: null } });
  if (!existing) throw new Error("Member not found");
  const { password, targets, ...rest } = input;
  await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(targets !== undefined ? { targets: targets ?? undefined } : {}),
      ...(password ? { passwordHash: bcrypt.hashSync(password, 10) } : {}),
    },
  });
  if (input.role && input.role !== existing.role) {
    await audit(user, "user.role_change", "user", id, {
      before: { role: existing.role },
      after: { role: input.role },
    });
  } else {
    await audit(user, "user.update", "user", id);
  }
}

export async function deleteTeamMember(user: SessionUser, id: string) {
  assertCan(user.role, "team", "delete");
  if (id === user.id) throw new Error("You cannot delete yourself");
  const existing = await prisma.user.findFirst({ where: { id, orgId: user.orgId, deletedAt: null } });
  if (!existing) throw new Error("Member not found");
  await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await audit(user, "user.delete", "user", id);
}
