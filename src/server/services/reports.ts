import { prisma } from "@/server/db";
import { assertCan } from "@/server/auth/permissions";
import { leadScope } from "@/server/services/leads";
import { teamPerformance } from "@/server/services/team";
import type { SessionUser } from "@/server/session";

export type ReportRange = { from?: Date; to?: Date };

function rangeWhere(range: ReportRange) {
  return range.from || range.to
    ? { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
    : {};
}

export async function getReports(user: SessionUser, range: ReportRange = {}) {
  assertCan(user.role, "report", "view");
  const scope = { ...leadScope(user), ...rangeWhere(range) };

  const [pipeline, bySource, converted, monthly, leaderboard] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.lead.groupBy({ by: ["source"], where: scope, _count: true }),
    prisma.lead.findMany({
      where: { ...scope, status: "converted" },
      select: { source: true, budget: true },
    }),
    prisma.lead.findMany({
      where: { ...leadScope(user), status: "converted", updatedAt: { gte: new Date(Date.now() - 365 * 86400000) } },
      select: { budget: true, updatedAt: true },
    }),
    teamPerformance(user).catch(() => []), // agents lack team.viewAll — leaderboard hidden for them
  ]);

  // Source ROI: leads per source + conversions + revenue
  const revenueBySource = new Map<string, { converted: number; revenue: number }>();
  for (const l of converted) {
    const key = l.source ?? "unknown";
    const cur = revenueBySource.get(key) ?? { converted: 0, revenue: 0 };
    cur.converted += 1;
    cur.revenue += Number(l.budget ?? 0);
    revenueBySource.set(key, cur);
  }
  const sourceRoi = bySource.map((s) => {
    const key = s.source ?? "unknown";
    const conv = revenueBySource.get(key) ?? { converted: 0, revenue: 0 };
    return {
      source: key,
      leads: s._count,
      converted: conv.converted,
      conversionRate: s._count ? Math.round((conv.converted / s._count) * 100) : 0,
      revenue: conv.revenue,
    };
  });

  // Revenue trend (12 months)
  const trend = new Map<string, number>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    trend.set(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7), 0);
  }
  for (const l of monthly) {
    const key = l.updatedAt.toISOString().slice(0, 7);
    if (trend.has(key)) trend.set(key, trend.get(key)! + Number(l.budget ?? 0));
  }

  return {
    pipeline: pipeline.map((p) => ({ status: p.status, count: p._count })),
    sourceRoi: sourceRoi.sort((a, b) => b.leads - a.leads),
    revenueTrend: [...trend.entries()].map(([month, revenue]) => ({ month, revenue })),
    leaderboard: leaderboard
      .filter((m) => m.role === "AGENT" || m.assigned > 0)
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export type ReportsData = Awaited<ReturnType<typeof getReports>>;
