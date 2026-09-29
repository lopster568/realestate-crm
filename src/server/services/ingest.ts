import { prisma } from "@/server/db";
import { makeAssigner } from "@/server/services/automation";
import { notify } from "@/server/notifications";
import type { Prisma } from "@/generated/prisma/client";

export type IngestLead = {
  dedupeKey?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  budget?: number | null;
  propertyType?: string | null;
  notes?: string | null;
  externalSource?: string | null;
  tags?: string[];
};

export type IngestResult = { created: number; updated: number; skipped: number; errors: string[] };

/**
 * Batch ingest from portals / website forms. Idempotent:
 * - Matches by (orgId, dedupeKey) — including soft-deleted rows so a re-import
 *   never collides with the unique index — else by phone/email among live leads.
 * - On UPDATE, writes ONLY fields the payload provides with a non-null value, and
 *   NEVER touches operator-owned state (status, priority, assignedToId, tags).
 *   A null in the payload means "no value supplied", not "erase the stored one".
 * - On CREATE, sets status "new", auto-assigns if the org opts in, logs activity.
 */
export async function ingestLeads(orgId: string, leads: IngestLead[]): Promise<IngestResult> {
  const result: IngestResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId }, select: { autoAssign: true } });
  const assign = org.autoAssign ? await makeAssigner(orgId) : () => null;

  for (const [i, raw] of leads.entries()) {
    if (!raw?.name?.trim()) {
      result.skipped++;
      result.errors.push(`row ${i}: missing name`);
      continue;
    }

    // Only non-null provided fields update an existing lead (additive, non-destructive).
    const provided: Prisma.LeadUpdateInput = {};
    if (raw.email != null && raw.email !== "") provided.email = raw.email;
    if (raw.phone != null && raw.phone !== "") provided.phone = raw.phone;
    if (raw.source != null) provided.source = raw.source;
    if (raw.budget != null) provided.budget = raw.budget;
    if (raw.propertyType != null) provided.propertyType = raw.propertyType;
    if (raw.notes != null) provided.notes = raw.notes;
    if (raw.externalSource != null) provided.externalSource = raw.externalSource;

    // dedupeKey is unique per (orgId, dedupeKey) INCLUDING soft-deleted rows —
    // look those up too, else a create would hit the unique index.
    const existing = raw.dedupeKey
      ? await prisma.lead.findFirst({ where: { orgId, dedupeKey: raw.dedupeKey }, select: { id: true, deletedAt: true } })
      : await prisma.lead.findFirst({
          where: {
            orgId,
            deletedAt: null,
            OR: [
              ...(raw.phone ? [{ phone: raw.phone }] : []),
              ...(raw.email ? [{ email: { equals: raw.email, mode: "insensitive" as const } }] : []),
            ],
          },
          select: { id: true, deletedAt: true },
        });

    if (existing) {
      // Revive a soft-deleted match so the re-import lands on the existing row.
      const data: Prisma.LeadUpdateInput = { ...provided };
      if (existing.deletedAt) data.deletedAt = null;
      await prisma.lead.update({ where: { id: existing.id }, data });
      await prisma.activity.create({
        data: {
          orgId,
          leadId: existing.id,
          type: "SYSTEM",
          payload: { text: `Updated from ${raw.externalSource ?? "external source"}` },
        },
      });
      result.updated++;
      continue;
    }

    const assignedToId = assign();
    const lead = await prisma.lead.create({
      data: {
        orgId,
        name: raw.name.trim(),
        email: raw.email ?? null,
        phone: raw.phone ?? null,
        source: raw.source ?? null,
        budget: raw.budget ?? null,
        propertyType: raw.propertyType ?? null,
        notes: raw.notes ?? null,
        externalSource: raw.externalSource ?? null,
        dedupeKey: raw.dedupeKey ?? null,
        tags: raw.tags ?? [],
        status: "new",
        assignedToId,
      },
    });
    await prisma.activity.create({
      data: { orgId, leadId: lead.id, type: "SYSTEM", payload: { text: `Imported from ${raw.externalSource ?? "external source"}` } },
    });
    if (assignedToId) {
      await notify(orgId, assignedToId, "lead_assigned", {
        title: "New lead assigned",
        body: `${lead.name} (imported) was assigned to you`,
        href: `/leads/${lead.id}`,
      });
    }
    result.created++;
  }

  return result;
}
