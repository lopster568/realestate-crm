import { prisma } from "@/server/db";
import { assertCan, can } from "@/server/auth/permissions";
import { assertSameOrgUser } from "@/server/services/org-guards";
import { pickAssignee } from "@/server/services/automation";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";
import type { SessionUser } from "@/server/session";
import type { Prisma, Priority } from "@/generated/prisma/client";

// Agents see only their own leads; managers/admin see the whole org.
export function leadScope(user: SessionUser): Prisma.LeadWhereInput {
  return {
    orgId: user.orgId,
    deletedAt: null,
    ...(can(user.role, "lead", "viewAll") ? {} : { assignedToId: user.id }),
  };
}

export type LeadFilters = {
  status?: string;
  priority?: string;
  source?: string;
  assignedToId?: string;
  tag?: string;
  band?: string;
  q?: string;
};

function filterWhere(user: SessionUser, f: LeadFilters): Prisma.LeadWhereInput {
  // The agent filter must never widen an AGENT's own-records scope.
  const canFilterByAgent = can(user.role, "lead", "viewAll");
  return {
    ...(f.assignedToId && canFilterByAgent ? { assignedToId: f.assignedToId } : {}),
    ...(f.status ? { status: f.status } : {}),
    // Ignore an unknown priority value rather than passing it to Prisma (which 500s).
    ...(f.priority && ["HIGH", "MEDIUM", "LOW"].includes(f.priority) ? { priority: f.priority as Priority } : {}),
    ...(f.source ? { source: f.source } : {}),
    ...(f.tag ? { tags: { has: f.tag } } : {}),
    ...(f.band ? { scoreBand: f.band } : {}),
    ...leadScope(user),
    ...(f.q
      ? {
          OR: [
            { name: { contains: f.q, mode: "insensitive" } },
            { email: { contains: f.q, mode: "insensitive" } },
            { phone: { contains: f.q } },
          ],
        }
      : {}),
  };
}

export async function listLeads(user: SessionUser, filters: LeadFilters = {}, page = 1, pageSize = 25) {
  const where = filterWhere(user, filters);
  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { assignedTo: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);
  return { rows: rows.map(serializeLead), total, page, pageSize };
}

/** All leads grouped for the kanban board (no pagination — board shows the working set). */
export async function listLeadsForBoard(user: SessionUser, filters: LeadFilters = {}) {
  const rows = await prisma.lead.findMany({
    where: filterWhere(user, filters),
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return rows.map(serializeLead);
}

export async function getLead(user: SessionUser, id: string) {
  const lead = await prisma.lead.findFirst({
    where: { id, ...leadScope(user) },
    include: {
      assignedTo: { select: { id: true, name: true } },
      visits: {
        where: { deletedAt: null },
        include: { property: { select: { id: true, title: true, location: true } } },
        orderBy: { scheduledAt: "desc" },
      },
      activities: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });
  if (!lead) return null;
  return {
    ...serializeLead(lead),
    visits: lead.visits.map((v) => ({ ...v, createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(), scheduledAt: v.scheduledAt.toISOString(), deletedAt: null })),
    activities: lead.activities.map((a) => ({ ...a, payload: a.payload as Record<string, unknown>, createdAt: a.createdAt.toISOString() })),
  };
}

export type LeadInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  priority?: Priority;
  source?: string | null;
  budget?: number | null;
  propertyType?: string | null;
  assignedToId?: string | null;
  followUpDueAt?: Date | null;
  notes?: string | null;
  tags?: string[];
};

/** Duplicate detection at capture: exact phone or email match among non-deleted org leads. */
export async function findDuplicates(user: SessionUser, phone?: string | null, email?: string | null, excludeId?: string) {
  if (!phone && !email) return [];
  const dupes = await prisma.lead.findMany({
    where: {
      orgId: user.orgId,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true, name: true, phone: true, email: true, status: true },
    take: 5,
  });
  return dupes;
}

export async function createLead(user: SessionUser, input: LeadInput) {
  assertCan(user.role, "lead", "create");
  if (input.assignedToId && input.assignedToId !== user.id) {
    assertCan(user.role, "lead", "assign");
    await assertSameOrgUser(user, input.assignedToId);
  }
  let assignedToId = input.assignedToId ?? (user.role === "AGENT" ? user.id : null);
  // Auto-assign at capture when the org opts in and no assignee was chosen.
  if (!assignedToId) {
    const org = await prisma.org.findUniqueOrThrow({ where: { id: user.orgId }, select: { autoAssign: true } });
    if (org.autoAssign) assignedToId = await pickAssignee(user.orgId);
  }
  const lead = await prisma.lead.create({
    data: {
      ...input,
      assignedToId,
      status: input.status ?? "new",
      orgId: user.orgId,
    },
  });
  await prisma.activity.create({
    data: {
      orgId: user.orgId,
      leadId: lead.id,
      type: "SYSTEM",
      actorId: user.id,
      payload: { text: "Lead created" },
    },
  });
  await audit(user, "lead.create", "lead", lead.id, { after: { name: lead.name } });
  if (assignedToId && assignedToId !== user.id) {
    await notify(user.orgId, assignedToId, "lead_assigned", {
      title: "New lead assigned",
      body: `${lead.name} was assigned to you`,
      href: `/leads/${lead.id}`,
    });
  }
  return serializeLead(lead);
}

export async function updateLead(user: SessionUser, id: string, input: Partial<LeadInput> & { lostReason?: string | null }) {
  assertCan(user.role, "lead", "update");
  const existing = await prisma.lead.findFirst({ where: { id, ...leadScope(user) } });
  if (!existing) throw new Error("Lead not found");

  // Authorization must precede persistence — reject reassignment before writing.
  const reassigning = input.assignedToId !== undefined && input.assignedToId !== existing.assignedToId;
  if (reassigning) {
    assertCan(user.role, "lead", "assign");
    if (input.assignedToId) await assertSameOrgUser(user, input.assignedToId);
  }

  const lead = await prisma.lead.update({ where: { id }, data: input });

  if (input.status && input.status !== existing.status) {
    await prisma.activity.create({
      data: {
        orgId: user.orgId,
        leadId: id,
        type: "STATUS_CHANGE",
        actorId: user.id,
        payload: { from: existing.status, to: input.status },
      },
    });
  }
  if (reassigning && input.assignedToId) {
    await prisma.activity.create({
      data: {
        orgId: user.orgId,
        leadId: id,
        type: "ASSIGNMENT",
        actorId: user.id,
        payload: { toUserId: input.assignedToId },
      },
    });
    await notify(user.orgId, input.assignedToId, "lead_assigned", {
      title: "Lead assigned to you",
      body: `${lead.name} was assigned to you`,
      href: `/leads/${id}`,
    });
  }
  await audit(user, "lead.update", "lead", id, {
    before: { status: existing.status, assignedToId: existing.assignedToId },
    after: { status: lead.status, assignedToId: lead.assignedToId },
  });
  return serializeLead(lead);
}

export async function addNote(user: SessionUser, leadId: string, text: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...leadScope(user) } });
  if (!lead) throw new Error("Lead not found");
  await prisma.activity.create({
    data: { orgId: user.orgId, leadId, type: "NOTE", actorId: user.id, payload: { text } },
  });
}

export async function logCall(user: SessionUser, leadId: string, summary: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...leadScope(user) } });
  if (!lead) throw new Error("Lead not found");
  await prisma.activity.create({
    data: { orgId: user.orgId, leadId, type: "CALL", actorId: user.id, payload: { text: summary } },
  });
}

export async function deleteLead(user: SessionUser, id: string) {
  assertCan(user.role, "lead", "delete");
  const existing = await prisma.lead.findFirst({ where: { id, orgId: user.orgId } });
  if (!existing) throw new Error("Lead not found");
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(user, "lead.delete", "lead", id, { before: { name: existing.name } });
}

// Decimal + Date fields don't cross the server/client boundary — normalize here.
export function serializeLead<T extends { budget: Prisma.Decimal | null; createdAt: Date; updatedAt: Date; followUpDueAt: Date | null; deletedAt: Date | null }>(lead: T) {
  return {
    ...lead,
    budget: lead.budget === null ? null : Number(lead.budget),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    followUpDueAt: lead.followUpDueAt?.toISOString() ?? null,
    deletedAt: null,
  };
}

export type SerializedLead = Awaited<ReturnType<typeof listLeads>>["rows"][number];
