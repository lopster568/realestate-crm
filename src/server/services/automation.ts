import { prisma } from "@/server/db";
import { notify } from "@/server/notifications";
import type { SessionUser } from "@/server/session";

const OPEN_STATUSES_EXCLUDED = ["converted", "lost"];

/**
 * Least-loaded assignment: pick the active AGENT in the org with the fewest
 * open (non-converted/lost) leads. Deterministic, needs no round-robin pointer.
 * Returns the chosen user id, or null if the org has no eligible agents.
 */
export async function pickAssignee(orgId: string): Promise<string | null> {
  const agents = await prisma.user.findMany({
    where: { orgId, role: "AGENT", isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (agents.length === 0) return null;

  const loads = await prisma.lead.groupBy({
    by: ["assignedToId"],
    where: {
      orgId,
      deletedAt: null,
      status: { notIn: OPEN_STATUSES_EXCLUDED },
      assignedToId: { in: agents.map((a) => a.id) },
    },
    _count: true,
  });
  const loadMap = new Map(loads.map((l) => [l.assignedToId, l._count]));
  return agents
    .map((a) => ({ id: a.id, load: loadMap.get(a.id) ?? 0 }))
    .sort((a, b) => a.load - b.load || a.id.localeCompare(b.id))[0]!.id;
}

/**
 * Build a least-loaded assigner that computes agent loads once and tracks them
 * in memory across a batch — avoids the per-lead pickAssignee query storm.
 * Shared by the automation tick and portal ingestion.
 */
export async function makeAssigner(orgId: string): Promise<() => string | null> {
  const agents = await prisma.user.findMany({
    where: { orgId, role: "AGENT", isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (agents.length === 0) return () => null;
  const loads = await prisma.lead.groupBy({
    by: ["assignedToId"],
    where: { orgId, deletedAt: null, status: { notIn: OPEN_STATUSES_EXCLUDED }, assignedToId: { in: agents.map((a) => a.id) } },
    _count: true,
  });
  const load = new Map(agents.map((a) => [a.id, 0]));
  for (const l of loads) if (l.assignedToId) load.set(l.assignedToId, l._count);
  return () => {
    let best = agents[0]!.id;
    for (const a of agents) if ((load.get(a.id) ?? 0) < (load.get(best) ?? 0)) best = a.id;
    load.set(best, (load.get(best) ?? 0) + 1);
    return best;
  };
}

/** Fire an in-app notification at most once per (lead, type) per calendar day. */
async function notifyOncePerDay(
  orgId: string,
  recipientId: string,
  type: string,
  leadId: string,
  payload: { title: string; body: string; href?: string }
): Promise<boolean> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const existing = await prisma.notification.findFirst({
    where: {
      orgId,
      recipientId,
      type,
      createdAt: { gte: since },
      payload: { path: ["leadId"], equals: leadId },
    },
    select: { id: true },
  });
  if (existing) return false;
  await notify(orgId, recipientId, type, { ...payload, leadId });
  return true;
}

export type AutomationResult = {
  followupReminders: number;
  staleFlagged: number;
  autoAssigned: number;
};

/**
 * One maintenance tick across all orgs. Idempotent — safe to run every few minutes.
 * 1) Overdue follow-ups  -> notify the assigned agent (once/day) + ensure a task exists.
 * 2) Stale leads (no activity in org.staleLeadDays) -> FOLLOW_UP activity + notify.
 * 3) Unassigned leads (when org.autoAssign) -> least-loaded agent + notify.
 */
export async function runAutomationTick(
  opts: { orgId?: string; trigger?: string; now?: Date } = {}
): Promise<AutomationResult> {
  const now = opts.now ?? new Date();
  const trigger = opts.trigger ?? "cron";
  const total: AutomationResult = { followupReminders: 0, staleFlagged: 0, autoAssigned: 0 };
  const orgs = await prisma.org.findMany({
    where: opts.orgId ? { id: opts.orgId } : {},
    select: { id: true, autoAssign: true, staleLeadDays: true },
  });

  for (const org of orgs) {
    const startedAt = Date.now();
    const result: AutomationResult = { followupReminders: 0, staleFlagged: 0, autoAssigned: 0 };
    // 1) Overdue follow-ups
    const overdue = await prisma.lead.findMany({
      where: {
        orgId: org.id,
        deletedAt: null,
        assignedToId: { not: null },
        followUpDueAt: { lte: now },
        status: { notIn: OPEN_STATUSES_EXCLUDED },
      },
      select: { id: true, name: true, assignedToId: true },
      take: 500,
    });
    for (const lead of overdue) {
      const fired = await notifyOncePerDay(org.id, lead.assignedToId!, "followup_due", lead.id, {
        title: "Follow-up overdue",
        body: `${lead.name} needs a follow-up`,
        href: `/leads/${lead.id}`,
      });
      if (!fired) continue;
      result.followupReminders++;
      // Ensure a follow-up task exists (dedupe by open FOLLOWUP task linked to this lead)
      const existingTask = await prisma.task.findFirst({
        where: { orgId: org.id, linkedType: "lead", linkedId: lead.id, status: "OPEN", title: { startsWith: "Follow up" } },
        select: { id: true },
      });
      if (!existingTask) {
        await prisma.task.create({
          data: {
            orgId: org.id,
            title: `Follow up with ${lead.name}`,
            dueAt: now,
            assignedToId: lead.assignedToId!,
            linkedType: "lead",
            linkedId: lead.id,
          },
        });
      }
    }

    // 2) Stale leads — no activity in N days
    const staleCutoff = new Date(now.getTime() - org.staleLeadDays * 86400000);
    const candidates = await prisma.lead.findMany({
      where: {
        orgId: org.id,
        deletedAt: null,
        assignedToId: { not: null },
        status: { notIn: OPEN_STATUSES_EXCLUDED },
        updatedAt: { lte: staleCutoff },
      },
      select: {
        id: true,
        name: true,
        assignedToId: true,
        activities: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
      take: 500,
    });
    for (const lead of candidates) {
      const lastActivity = lead.activities[0]?.createdAt;
      if (lastActivity && lastActivity > staleCutoff) continue; // touched recently
      const fired = await notifyOncePerDay(org.id, lead.assignedToId!, "lead_stale", lead.id, {
        title: "Lead going cold",
        body: `No activity on ${lead.name} in ${org.staleLeadDays}+ days`,
        href: `/leads/${lead.id}`,
      });
      if (!fired) continue;
      result.staleFlagged++;
      await prisma.activity.create({
        data: {
          orgId: org.id,
          leadId: lead.id,
          type: "FOLLOW_UP",
          payload: { text: `Flagged stale — no activity in ${org.staleLeadDays}+ days` },
        },
      });
    }

    // 3) Auto-assign unassigned leads — loads computed once, and the update is
    // conditional on assignedToId still being null so overlapping ticks (browser
    // loop + cron) can't double-assign the same lead.
    if (org.autoAssign) {
      const unassigned = await prisma.lead.findMany({
        where: { orgId: org.id, deletedAt: null, assignedToId: null, status: { notIn: OPEN_STATUSES_EXCLUDED } },
        select: { id: true, name: true },
        take: 200,
      });
      const assign = await makeAssigner(org.id);
      for (const lead of unassigned) {
        const assignee = assign();
        if (!assignee) break;
        const claimed = await prisma.lead.updateMany({
          where: { id: lead.id, assignedToId: null },
          data: { assignedToId: assignee },
        });
        if (claimed.count !== 1) continue; // another tick got there first
        await prisma.activity.create({
          data: { orgId: org.id, leadId: lead.id, type: "ASSIGNMENT", payload: { toUserId: assignee, auto: true } },
        });
        await notify(org.id, assignee, "lead_assigned", {
          title: "New lead assigned",
          body: `${lead.name} was auto-assigned to you`,
          href: `/leads/${lead.id}`,
        });
        result.autoAssigned++;
      }
    }

    // Record this org's tick for the monitor.
    await prisma.automationRun.create({
      data: {
        orgId: org.id,
        trigger,
        followupReminders: result.followupReminders,
        staleFlagged: result.staleFlagged,
        autoAssigned: result.autoAssigned,
        durationMs: Date.now() - startedAt,
      },
    });
    total.followupReminders += result.followupReminders;
    total.staleFlagged += result.staleFlagged;
    total.autoAssigned += result.autoAssigned;
  }

  // Retention: keep the monitor history bounded (14 days).
  await prisma.automationRun.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 14 * 86400000) } } });

  return total;
}

// ---------- Monitor read model ----------

export async function listAutomationRuns(user: SessionUser, limit = 30) {
  const rows = await prisma.automationRun.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    trigger: r.trigger,
    followupReminders: r.followupReminders,
    staleFlagged: r.staleFlagged,
    autoAssigned: r.autoAssigned,
    durationMs: r.durationMs,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getAutomationStats(user: SessionUser) {
  const dayAgo = new Date(Date.now() - 86400000);
  const [last, total24h, runs24h] = await Promise.all([
    prisma.automationRun.findFirst({ where: { orgId: user.orgId }, orderBy: { createdAt: "desc" } }),
    prisma.automationRun.aggregate({
      where: { orgId: user.orgId, createdAt: { gte: dayAgo } },
      _sum: { followupReminders: true, staleFlagged: true, autoAssigned: true },
    }),
    prisma.automationRun.count({ where: { orgId: user.orgId, createdAt: { gte: dayAgo } } }),
  ]);
  return {
    lastRunAt: last?.createdAt.toISOString() ?? null,
    runs24h,
    remindersToday: total24h._sum.followupReminders ?? 0,
    flaggedToday: total24h._sum.staleFlagged ?? 0,
    assignedToday: total24h._sum.autoAssigned ?? 0,
  };
}

export type DigestResult = { recipients: number };

/** Daily digest to managers/admins: today's activity snapshot. */
export async function runDailyDigest(now = new Date()): Promise<DigestResult> {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const orgs = await prisma.org.findMany({ select: { id: true } });
  let recipients = 0;

  for (const org of orgs) {
    const [newLeads, visitsToday, wonThisMonth, managers] = await Promise.all([
      prisma.lead.count({ where: { orgId: org.id, deletedAt: null, createdAt: { gte: dayStart } } }),
      prisma.siteVisit.count({
        where: { orgId: org.id, deletedAt: null, status: "SCHEDULED", scheduledAt: { gte: dayStart, lt: dayEnd } },
      }),
      prisma.lead.count({
        where: { orgId: org.id, deletedAt: null, status: "converted", updatedAt: { gte: monthStart } },
      }),
      prisma.user.findMany({
        where: { orgId: org.id, role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
        select: { id: true },
      }),
    ]);
    for (const m of managers) {
      // Idempotent — at most one digest per recipient per calendar day, so a
      // re-fired cron doesn't duplicate it.
      const already = await prisma.notification.findFirst({
        where: { orgId: org.id, recipientId: m.id, type: "daily_digest", createdAt: { gte: dayStart } },
        select: { id: true },
      });
      if (already) continue;
      await notify(org.id, m.id, "daily_digest", {
        title: "Daily digest",
        body: `${newLeads} new leads today · ${visitsToday} visits scheduled · ${wonThisMonth} conversions this month`,
        href: "/dashboard",
      });
      recipients++;
    }
  }
  return { recipients };
}
