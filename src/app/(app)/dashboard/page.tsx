import Link from "next/link";
import {
  AlarmClock,
  Building2,
  CalendarCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { requireUser, getOrgContext } from "@/server/session";
import { getDashboard } from "@/server/services/dashboard";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/format";
import {
  DailyLeadsChart,
  PipelineChart,
  RevenueChart,
  SourcesChart,
} from "@/components/charts/charts";

export const metadata = { title: "Dashboard" };

const activityLabel: Record<string, string> = {
  NOTE: "added a note on",
  CALL: "logged a call with",
  STATUS_CHANGE: "moved",
  ASSIGNMENT: "assigned",
  VISIT: "visit update for",
  MESSAGE: "messaged",
  FOLLOW_UP: "set a follow-up for",
  SYSTEM: "created",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, ctx] = await Promise.all([getDashboard(user), getOrgContext(user.orgId)]);
  const { currency, locale } = ctx.org;
  const money = (v: number) => formatCurrency(v, currency, locale, { compact: true });

  const statusMap = new Map(ctx.leadStatuses.map((s) => [s.value, s]));
  const sourceMap = new Map(ctx.leadSources.map((s) => [s.value, s.label]));

  const pipelineData = ctx.leadStatuses.map((s) => ({
    label: s.label,
    color: s.color ?? "#4F46E5",
    count: data.pipeline.find((p) => p.status === s.value)?.count ?? 0,
  }));
  const sourcesData = data.sources
    .map((s) => ({ label: sourceMap.get(s.source) ?? s.source, count: s.count }))
    .sort((a, b) => b.count - a.count);

  const kpis = [
    { label: "Total Leads", value: String(data.kpis.totalLeads), icon: Users, color: "text-primary bg-primary-soft" },
    { label: "New This Month", value: String(data.kpis.newThisMonth), icon: Sparkles, color: "text-accent-violet bg-accent-violet/10" },
    { label: "Follow-ups Due", value: String(data.kpis.followUpsDue), icon: AlarmClock, color: "text-accent-amber bg-accent-amber/10" },
    { label: "Upcoming Visits", value: String(data.kpis.upcomingVisits), icon: CalendarCheck, color: "text-accent-sky bg-accent-sky/10" },
    { label: "Conversions", value: String(data.kpis.conversions), icon: Target, color: "text-accent-green bg-accent-green/10" },
    { label: "Revenue", value: money(data.kpis.revenue), icon: Wallet, color: "text-accent-teal bg-accent-teal/10" },
    { label: "Properties", value: String(data.kpis.propertyCount), icon: Building2, color: "text-accent-rose bg-accent-rose/10" },
    { label: "Win Rate", value: `${data.kpis.winRate}%`, icon: TrendingUp, color: "text-primary bg-primary-soft" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">
          {data.teamWide ? "Team Dashboard" : "My Dashboard"}
        </h1>
        <p className="text-sm text-ink-faint mt-0.5">
          Welcome back, {user.name.split(" ")[0]} — here&apos;s what&apos;s moving.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center gap-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${k.color}`}>
                <k.icon size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] text-ink-faint truncate">{k.label}</p>
                <p className="font-display text-lg font-bold text-ink leading-tight">{k.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* My Day */}
      <Card>
        <CardHeader title="My Day" subtitle="Today's visits, overdue follow-ups and fresh assignments" />
        <div className="grid md:grid-cols-3 gap-4 px-5 pb-5">
          <div className="rounded-xl bg-canvas p-4">
            <p className="text-[12px] font-semibold text-ink-soft mb-2 flex items-center gap-1.5">
              <CalendarCheck size={13} /> Today&apos;s visits
            </p>
            {data.myDay.visits.length === 0 && <p className="text-[13px] text-ink-faint">No visits today.</p>}
            <ul className="space-y-2">
              {data.myDay.visits.map((v) => (
                <li key={v.id} className="text-[13px]">
                  <Link href={`/leads/${v.lead.id}`} className="font-medium text-ink hover:text-primary">
                    {v.lead.name}
                  </Link>
                  <span className="text-ink-faint"> · {v.property.title} · {formatDateTime(v.time, locale)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-canvas p-4">
            <p className="text-[12px] font-semibold text-ink-soft mb-2 flex items-center gap-1.5">
              <AlarmClock size={13} /> Overdue follow-ups
            </p>
            {data.myDay.overdueFollowUps.length === 0 && <p className="text-[13px] text-ink-faint">Nothing overdue. 🎉</p>}
            <ul className="space-y-2">
              {data.myDay.overdueFollowUps.map((l) => (
                <li key={l.id} className="text-[13px] flex items-center justify-between gap-2">
                  <Link href={`/leads/${l.id}`} className="font-medium text-ink hover:text-primary truncate">
                    {l.name}
                  </Link>
                  <span className="text-accent-rose text-[12px] whitespace-nowrap">{timeAgo(l.followUpDueAt)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-canvas p-4">
            <p className="text-[12px] font-semibold text-ink-soft mb-2 flex items-center gap-1.5">
              <UserPlus size={13} /> New assignments
            </p>
            {data.myDay.newAssignments.length === 0 && <p className="text-[13px] text-ink-faint">No new leads in the last 48h.</p>}
            <ul className="space-y-2">
              {data.myDay.newAssignments.map((l) => (
                <li key={l.id} className="text-[13px] flex items-center justify-between gap-2">
                  <Link href={`/leads/${l.id}`} className="font-medium text-ink hover:text-primary truncate">
                    {l.name}
                  </Link>
                  <span className="text-ink-faint text-[12px]">{sourceMap.get(l.source ?? "") ?? l.source}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Daily Lead Acquisition" subtitle="New leads · last 30 days" />
          <div className="px-3 pb-4">
            <DailyLeadsChart data={data.dailyLeads} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Monthly Revenue" subtitle="Converted lead value · last 6 months" />
          <div className="px-3 pb-4">
            <RevenueChart data={data.monthlyRevenue} currency={currency} locale={locale} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Lead Pipeline" subtitle="Leads by stage" />
          <div className="px-3 pb-4">
            <PipelineChart data={pipelineData} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Lead Sources" subtitle="Where leads come from" />
          <div className="px-3 pb-4">
            <SourcesChart data={sourcesData} />
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader title="Recent Activity" />
        <ul className="px-5 pb-5 space-y-3">
          {data.recentActivities.length === 0 && (
            <li className="text-sm text-ink-faint">No activity yet.</li>
          )}
          {data.recentActivities.map((a) => {
            const status = a.payload?.to ? statusMap.get(String(a.payload.to)) : undefined;
            return (
              <li key={a.id} className="flex items-center gap-3 text-[13px]">
                <Avatar name={a.actor} size="sm" />
                <span className="text-ink-soft min-w-0 truncate">
                  <span className="font-medium text-ink">{a.actor}</span>{" "}
                  {activityLabel[a.type] ?? "updated"}{" "}
                  {a.lead ? (
                    <Link href={`/leads/${a.lead.id}`} className="font-medium text-ink hover:text-primary">
                      {a.lead.name}
                    </Link>
                  ) : (
                    "a lead"
                  )}
                  {status && (
                    <>
                      {" "}to <Badge color={status.color}>{status.label}</Badge>
                    </>
                  )}
                </span>
                <span className="ml-auto text-[12px] text-ink-faint whitespace-nowrap">
                  {timeAgo(a.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
