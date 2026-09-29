import { prisma } from "@/server/db";
import { assertCan } from "@/server/auth/permissions";
import { assertSameOrgUser } from "@/server/services/org-guards";
import { leadScope } from "@/server/services/leads";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";
import type { SessionUser } from "@/server/session";

export type BulkLeadPatch = {
  status?: string;
  assignedToId?: string;
  addTags?: string[];
  removeTags?: string[];
};

/**
 * Apply a patch to many leads at once. Only affects leads inside the caller's
 * scope (agents can't bulk-edit leads they can't see). Reassignment and status
 * changes still write activity + notifications so the timeline stays truthful.
 */
export async function bulkUpdateLeads(
  user: SessionUser,
  ids: string[],
  patch: BulkLeadPatch
): Promise<{ updated: number }> {
  assertCan(user.role, "lead", "update");
  if (ids.length === 0) return { updated: 0 };

  if (patch.assignedToId !== undefined && patch.assignedToId) {
    assertCan(user.role, "lead", "assign");
    await assertSameOrgUser(user, patch.assignedToId);
  }

  // Restrict to leads the caller may actually touch.
  const scoped = await prisma.lead.findMany({
    where: { id: { in: ids }, ...leadScope(user) },
    select: { id: true, status: true, assignedToId: true, name: true },
  });
  if (scoped.length === 0) return { updated: 0 };
  const scopedIds = scoped.map((l) => l.id);

  await prisma.lead.updateMany({
    where: { id: { in: scopedIds } },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.assignedToId ? { assignedToId: patch.assignedToId } : {}),
    },
  });

  // Tag add/remove need per-row array ops via raw SQL (idempotent union / filter).
  if (patch.addTags?.length) {
    for (const tag of patch.addTags) {
      await prisma.$executeRaw`
        UPDATE "Lead" SET "tags" = array_append("tags", ${tag})
        WHERE "id" = ANY(${scopedIds}) AND NOT (${tag} = ANY("tags"))`;
    }
  }
  if (patch.removeTags?.length) {
    for (const tag of patch.removeTags) {
      await prisma.$executeRaw`
        UPDATE "Lead" SET "tags" = array_remove("tags", ${tag})
        WHERE "id" = ANY(${scopedIds})`;
    }
  }

  // Timeline + notifications for status / assignment changes.
  for (const lead of scoped) {
    if (patch.status && patch.status !== lead.status) {
      await prisma.activity.create({
        data: { orgId: user.orgId, leadId: lead.id, type: "STATUS_CHANGE", actorId: user.id, payload: { from: lead.status, to: patch.status } },
      });
    }
    if (patch.assignedToId && patch.assignedToId !== lead.assignedToId) {
      await prisma.activity.create({
        data: { orgId: user.orgId, leadId: lead.id, type: "ASSIGNMENT", actorId: user.id, payload: { toUserId: patch.assignedToId } },
      });
    }
  }
  if (patch.assignedToId && patch.assignedToId !== user.id) {
    const moved = scoped.filter((l) => l.assignedToId !== patch.assignedToId).length;
    if (moved > 0) {
      await notify(user.orgId, patch.assignedToId, "lead_assigned", {
        title: "Leads assigned to you",
        body: `${moved} lead${moved === 1 ? "" : "s"} were assigned to you`,
        href: "/leads",
      });
    }
  }

  await audit(user, "lead.bulk_update", "lead", undefined, { after: { ids: scopedIds, patch } });
  return { updated: scopedIds.length };
}

export async function bulkDeleteLeads(user: SessionUser, ids: string[]): Promise<{ deleted: number }> {
  assertCan(user.role, "lead", "delete");
  const scoped = await prisma.lead.findMany({
    where: { id: { in: ids }, orgId: user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (scoped.length === 0) return { deleted: 0 };
  await prisma.lead.updateMany({
    where: { id: { in: scoped.map((l) => l.id) } },
    data: { deletedAt: new Date() },
  });
  await audit(user, "lead.bulk_delete", "lead", undefined, { after: { ids: scoped.map((l) => l.id) } });
  return { deleted: scoped.length };
}

/** Distinct tags used across the org's leads, for filter dropdowns. */
export async function listLeadTags(user: SessionUser): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tag: string }[]>`
    SELECT DISTINCT unnest("tags") AS tag FROM "Lead"
    WHERE "orgId" = ${user.orgId} AND "deletedAt" IS NULL ORDER BY tag`;
  return rows.map((r) => r.tag);
}
