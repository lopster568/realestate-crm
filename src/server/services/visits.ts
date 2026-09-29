import { prisma } from "@/server/db";
import { assertCan, can } from "@/server/auth/permissions";
import { leadScope } from "@/server/services/leads";
import { assertSameOrgProperty, assertSameOrgUser } from "@/server/services/org-guards";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";
import type { SessionUser } from "@/server/session";
import type { Prisma, VisitStatus } from "@/generated/prisma/client";

function visitScope(user: SessionUser): Prisma.SiteVisitWhereInput {
  return {
    orgId: user.orgId,
    deletedAt: null,
    ...(can(user.role, "visit", "viewAll") ? {} : { assignedToId: user.id }),
  };
}

const includeRefs = {
  lead: { select: { id: true, name: true, phone: true } },
  property: { select: { id: true, title: true, location: true } },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.SiteVisitInclude;

export async function listVisits(
  user: SessionUser,
  opts: { from?: Date; to?: Date; assignedToId?: string; status?: string } = {}
) {
  // The agent filter must never widen an AGENT's own-records scope.
  const canFilterByAgent = can(user.role, "visit", "viewAll");
  const rows = await prisma.siteVisit.findMany({
    where: {
      ...(opts.assignedToId && canFilterByAgent ? { assignedToId: opts.assignedToId } : {}),
      ...visitScope(user),
      ...(opts.status ? { status: opts.status as VisitStatus } : {}),
      ...(opts.from || opts.to
        ? { scheduledAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
        : {}),
    },
    include: includeRefs,
    orderBy: { scheduledAt: "asc" },
    take: 500,
  });
  return rows.map(serializeVisit);
}

export type VisitInput = {
  leadId: string;
  propertyId: string;
  assignedToId: string;
  scheduledAt: Date;
  notes?: string | null;
};

/** Double-booking check: another SCHEDULED visit for the same agent within ±1 hour. */
export async function findConflicts(user: SessionUser, assignedToId: string, scheduledAt: Date, excludeId?: string) {
  const hour = 60 * 60 * 1000;
  return prisma.siteVisit.findMany({
    where: {
      orgId: user.orgId,
      deletedAt: null,
      assignedToId,
      status: "SCHEDULED",
      ...(excludeId ? { id: { not: excludeId } } : {}),
      scheduledAt: {
        gte: new Date(scheduledAt.getTime() - hour),
        lte: new Date(scheduledAt.getTime() + hour),
      },
    },
    include: { lead: { select: { name: true } }, property: { select: { title: true } } },
  });
}

export async function createVisit(user: SessionUser, input: VisitInput) {
  assertCan(user.role, "visit", "create");
  // Every referenced record must be in the caller's org — and the lead within
  // the caller's visibility scope (agents can't attach visits to others' leads).
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, ...leadScope(user) },
    select: { id: true },
  });
  if (!lead) throw new Error("Lead not found");
  await Promise.all([
    assertSameOrgProperty(user, input.propertyId),
    assertSameOrgUser(user, input.assignedToId),
  ]);

  const visit = await prisma.siteVisit.create({
    data: { ...input, orgId: user.orgId },
    include: includeRefs,
  });
  await prisma.activity.create({
    data: {
      orgId: user.orgId,
      leadId: input.leadId,
      type: "VISIT",
      actorId: user.id,
      payload: {
        propertyTitle: visit.property.title,
        scheduledAt: visit.scheduledAt.toISOString(),
        status: "SCHEDULED",
      },
    },
  });
  if (input.assignedToId !== user.id) {
    await notify(user.orgId, input.assignedToId, "visit_assigned", {
      title: "Site visit scheduled",
      body: `${visit.lead.name} — ${visit.property.title}`,
      href: "/site-visits",
    });
  }
  await audit(user, "visit.create", "visit", visit.id);
  return serializeVisit(visit);
}

export async function updateVisit(
  user: SessionUser,
  id: string,
  input: Partial<VisitInput> & { status?: VisitStatus; outcome?: string | null }
) {
  assertCan(user.role, "visit", "update");
  const existing = await prisma.siteVisit.findFirst({ where: { id, ...visitScope(user) } });
  if (!existing) throw new Error("Visit not found");

  if (input.leadId && input.leadId !== existing.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: input.leadId, ...leadScope(user) }, select: { id: true } });
    if (!lead) throw new Error("Lead not found");
  }
  if (input.propertyId && input.propertyId !== existing.propertyId) {
    await assertSameOrgProperty(user, input.propertyId);
  }
  if (input.assignedToId && input.assignedToId !== existing.assignedToId) {
    await assertSameOrgUser(user, input.assignedToId);
  }

  const visit = await prisma.siteVisit.update({ where: { id }, data: input, include: includeRefs });

  // Post-visit outcome feeds back into the lead timeline.
  if (input.status && input.status !== existing.status) {
    await prisma.activity.create({
      data: {
        orgId: user.orgId,
        leadId: visit.leadId,
        type: "VISIT",
        actorId: user.id,
        payload: {
          propertyTitle: visit.property.title,
          scheduledAt: visit.scheduledAt.toISOString(),
          status: input.status,
          ...(input.outcome ? { outcome: input.outcome } : {}),
        },
      },
    });
  }
  await audit(user, "visit.update", "visit", id, {
    before: { status: existing.status },
    after: { status: visit.status },
  });
  return serializeVisit(visit);
}

export async function deleteVisit(user: SessionUser, id: string) {
  assertCan(user.role, "visit", "delete");
  const existing = await prisma.siteVisit.findFirst({ where: { id, orgId: user.orgId } });
  if (!existing) throw new Error("Visit not found");
  await prisma.siteVisit.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(user, "visit.delete", "visit", id);
}

function serializeVisit<T extends { scheduledAt: Date; createdAt: Date; updatedAt: Date; deletedAt: Date | null }>(v: T) {
  return {
    ...v,
    scheduledAt: v.scheduledAt.toISOString(),
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    deletedAt: null,
  };
}

export type SerializedVisit = Awaited<ReturnType<typeof listVisits>>[number];
