import { prisma } from "@/server/db";
import { can } from "@/server/auth/permissions";
import { leadScope } from "@/server/services/leads";
import type { SessionUser } from "@/server/session";

function startOfDay(d = new Date()): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

export async function getDashboard(user: SessionUser) {
  const scope = leadScope(user); // agents automatically see own numbers only
  const teamWide = can(user.role, "dashboard", "viewAll");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const m6 = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const visitScope = {
    orgId: user.orgId,
    deletedAt: null,
    ...(teamWide ? {} : { assignedToId: user.id }),
  };

  const [
    totalLeads,
    newThisMonth,
    followUpsDue,
    upcomingVisits,
    conversions,
    revenueAgg,
    propertyCount,
    activeAgents,
    leads30d,
    pipeline,
    sources,
    convertedLeads,
    recentActivities,
    todayVisits,
    overdueFollowUps,
    newAssignments,
  ] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: { ...scope, createdAt: { gte: monthStart } } }),
    prisma.lead.count({ where: { ...scope, followUpDueAt: { lte: now }, status: { notIn: ["converted", "lost"] } } }),
    prisma.siteVisit.count({ where: { ...visitScope, status: "SCHEDULED", scheduledAt: { gte: now } } }),
    prisma.lead.count({ where: { ...scope, status: "converted" } }),
    prisma.lead.aggregate({ where: { ...scope, status: "converted" }, _sum: { budget: true } }),
    prisma.property.count({ where: { orgId: user.orgId, deletedAt: null } }),
    prisma.user.count({ where: { orgId: user.orgId, deletedAt: null, isActive: true } }),
    prisma.lead.findMany({ where: { ...scope, createdAt: { gte: d30 } }, select: { createdAt: true } }),
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.lead.groupBy({ by: ["source"], where: scope, _count: true }),
    prisma.lead.findMany({
      where: { ...scope, status: "converted", updatedAt: { gte: m6 } },
      select: { budget: true, updatedAt: true },
    }),
    prisma.activity.findMany({
      where: {
        orgId: user.orgId,
        ...(teamWide ? {} : { lead: { assignedToId: user.id } }),
      },
      include: {
        actor: { select: { name: true } },
        lead: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.siteVisit.findMany({
      where: {
        ...visitScope,
        status: "SCHEDULED",
        scheduledAt: { gte: startOfDay(), lt: new Date(startOfDay().getTime() + 86400000) },
      },
      include: {
        lead: { select: { id: true, name: true } },
        property: { select: { title: true, location: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.lead.findMany({
      where: { ...scope, followUpDueAt: { lt: now }, status: { notIn: ["converted", "lost"] } },
      select: { id: true, name: true, followUpDueAt: true, status: true },
      orderBy: { followUpDueAt: "asc" },
      take: 6,
    }),
    prisma.lead.findMany({
      where: { ...scope, createdAt: { gte: new Date(now.getTime() - 2 * 86400000) } },
      select: { id: true, name: true, source: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  // Daily lead acquisition (30d)
  const dailyMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    dailyMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const l of leads30d) {
    const key = l.createdAt.toISOString().slice(0, 10);
    if (dailyMap.has(key)) dailyMap.set(key, dailyMap.get(key)! + 1);
  }

  // Monthly revenue (6m, from converted lead budgets by conversion month)
  const monthly = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthly.set(d.toISOString().slice(0, 7), 0);
  }
  for (const l of convertedLeads) {
    const key = l.updatedAt.toISOString().slice(0, 7);
    if (monthly.has(key)) monthly.set(key, monthly.get(key)! + Number(l.budget ?? 0));
  }

  const winRate = totalLeads ? Math.round((conversions / totalLeads) * 100) : 0;

  return {
    teamWide,
    kpis: {
      totalLeads,
      newThisMonth,
      followUpsDue,
      upcomingVisits,
      conversions,
      revenue: Number(revenueAgg._sum.budget ?? 0),
      propertyCount,
      activeAgents,
      winRate,
    },
    dailyLeads: [...dailyMap.entries()].map(([date, count]) => ({ date, count })),
    pipeline: pipeline.map((p) => ({ status: p.status, count: p._count })),
    sources: sources.map((s) => ({ source: s.source ?? "unknown", count: s._count })),
    monthlyRevenue: [...monthly.entries()].map(([month, revenue]) => ({ month, revenue })),
    recentActivities: recentActivities.map((a) => ({
      id: a.id,
      type: a.type,
      actor: a.actor?.name ?? "System",
      lead: a.lead,
      payload: a.payload as Record<string, unknown>,
      createdAt: a.createdAt.toISOString(),
    })),
    myDay: {
      visits: todayVisits.map((v) => ({
        id: v.id,
        time: v.scheduledAt.toISOString(),
        lead: v.lead,
        property: v.property,
        agent: v.assignedTo.name,
      })),
      overdueFollowUps: overdueFollowUps.map((l) => ({
        ...l,
        followUpDueAt: l.followUpDueAt!.toISOString(),
      })),
      newAssignments: newAssignments.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
    },
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
