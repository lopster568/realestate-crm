import { Download } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser, getOrgContext } from "@/server/session";
import { can } from "@/server/auth/permissions";
import { getReports } from "@/server/services/reports";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/format";
import { RevenueChart } from "@/components/charts/charts";
import { DateRangeFilter } from "./date-range";

export const metadata = { title: "Reports" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireUser();
  if (!can(user.role, "report", "view")) redirect("/dashboard");
  const sp = await searchParams;
  const range = {
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
  };

  const [ctx, data] = await Promise.all([getOrgContext(user.orgId), getReports(user, range)]);
  const { currency, locale } = ctx.org;
  const sourceMap = new Map(ctx.leadSources.map((s) => [s.value, s.label]));
  const money = (v: number) => formatCurrency(v, currency, locale, { compact: true });

  // Funnel: pipeline stages in configured order, cumulative "reached this stage or beyond"
  const stages = ctx.leadStatuses.filter((s) => !(s.meta as { lost?: boolean } | null)?.lost);
  const stageIndex = new Map(stages.map((s, i) => [s.value, i]));
  const reached = stages.map((s, i) =>
    data.pipeline.reduce((sum, p) => {
      const idx = stageIndex.get(p.status);
      // lost leads count as having reached at least "new"
      return sum + ((idx === undefined ? 0 : idx) >= i ? p.count : 0);
    }, 0)
  );
  const totalLeads = data.pipeline.reduce((s, p) => s + p.count, 0);

  const exportQs = new URLSearchParams();
  if (sp.from) exportQs.set("from", sp.from);
  if (sp.to) exportQs.set("to", sp.to);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Reports</h1>
          <p className="text-sm text-ink-faint mt-0.5">{totalLeads} leads in range</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter />
          <a
            href={`/api/v1/reports/export?${exportQs.toString()}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium text-ink-soft hover:border-ink-faint"
          >
            <Download size={14} /> CSV
          </a>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Conversion Funnel" subtitle="Leads reaching each stage" />
          <div className="px-5 pb-5 space-y-2">
            {stages.map((s, i) => {
              const count = reached[i] ?? 0;
              const pct = totalLeads ? Math.round((count / totalLeads) * 100) : 0;
              const stepPct = i === 0 || !reached[i - 1] ? 100 : Math.round((count / reached[i - 1]!) * 100);
              return (
                <div key={s.value}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="font-medium text-ink">{s.label}</span>
                    <span className="text-ink-faint">
                      {count} · {pct}% of all{i > 0 && ` · ${stepPct}% of prev`}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-canvas overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: s.color ?? "#4F46E5" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Lead Source ROI" subtitle="Volume, conversion and revenue by channel" />
          <div className="px-5 pb-5 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-ink-faint border-b border-line">
                  <th className="py-2 font-medium">Source</th>
                  <th className="py-2 font-medium">Leads</th>
                  <th className="py-2 font-medium">Converted</th>
                  <th className="py-2 font-medium">Rate</th>
                  <th className="py-2 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.sourceRoi.map((s) => (
                  <tr key={s.source} className="border-b border-line/50 last:border-0">
                    <td className="py-2.5 font-medium text-ink">
                      {sourceMap.get(s.source) ?? s.source}
                    </td>
                    <td className="py-2.5 text-ink-soft">{s.leads}</td>
                    <td className="py-2.5 text-ink-soft">{s.converted}</td>
                    <td className="py-2.5 text-ink-soft">{s.conversionRate}%</td>
                    <td className="py-2.5 text-right font-medium text-ink">{money(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Revenue Trend" subtitle="Converted lead value · last 12 months" />
        <div className="px-3 pb-4">
          <RevenueChart data={data.revenueTrend} currency={currency} locale={locale} />
        </div>
      </Card>

      {data.leaderboard.length > 0 && (
        <Card>
          <CardHeader title="Agent Leaderboard" subtitle="Ranked by revenue" />
          <div className="px-5 pb-5 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-ink-faint border-b border-line">
                  <th className="py-2 font-medium">#</th>
                  <th className="py-2 font-medium">Agent</th>
                  <th className="py-2 font-medium">Assigned</th>
                  <th className="py-2 font-medium">Converted</th>
                  <th className="py-2 font-medium">Win rate</th>
                  <th className="py-2 font-medium">Visits</th>
                  <th className="py-2 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((m, i) => (
                  <tr key={m.id} className="border-b border-line/50 last:border-0">
                    <td className="py-2.5 text-ink-faint">{i + 1}</td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <Avatar name={m.name} size="sm" />
                        <span className="font-medium text-ink">{m.name}</span>
                      </span>
                    </td>
                    <td className="py-2.5 text-ink-soft">{m.assigned}</td>
                    <td className="py-2.5 text-ink-soft">{m.converted}</td>
                    <td className="py-2.5 text-ink-soft">{m.winRate}%</td>
                    <td className="py-2.5 text-ink-soft">{m.completedVisits}</td>
                    <td className="py-2.5 text-right font-medium text-ink">{money(m.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
