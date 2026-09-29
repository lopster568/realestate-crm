import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/session";

export type FunnelStage = {
  value: string;
  label: string;
  color: string;
  here: number; // leads currently at this stage
  reached: number; // leads at this stage or beyond
  pct: number; // reached as % of pipeline total
  stepPct: number; // reached as % of the previous stage
};

/**
 * Conversion funnel over the ACTIVE pipeline only. Lost (and any non-stage)
 * leads are excluded from both the numerator and the denominator — folding them
 * into stage 0 would inflate the top of the funnel and skew every ratio.
 */
export async function getFunnel(user: SessionUser): Promise<{ total: number; stages: FunnelStage[] }> {
  const [counts, statuses] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: { orgId: user.orgId, deletedAt: null },
      _count: true,
    }),
    prisma.orgList.findMany({
      where: { orgId: user.orgId, kind: "LEAD_STATUS", isActive: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status, c._count]));
  const pipeline = statuses.filter((s) => !(s.meta as { lost?: boolean } | null)?.lost);
  const total = pipeline.reduce((sum, s) => sum + (countByStatus.get(s.value) ?? 0), 0);

  const stages: FunnelStage[] = pipeline.map((s, i) => {
    const reached = pipeline.slice(i).reduce((sum, st) => sum + (countByStatus.get(st.value) ?? 0), 0);
    const prevReached = i === 0 ? reached : pipeline.slice(i - 1).reduce((sum, st) => sum + (countByStatus.get(st.value) ?? 0), 0);
    return {
      value: s.value,
      label: s.label,
      color: s.color ?? "#4F46E5",
      here: countByStatus.get(s.value) ?? 0,
      reached,
      pct: total ? Math.round((reached / total) * 100) : 0,
      stepPct: i === 0 || !prevReached ? 100 : Math.round((reached / prevReached) * 100),
    };
  });

  return { total, stages };
}
