import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser, getOrgContext } from "@/server/session";
import { listVisits } from "@/server/services/visits";
import { listAssignees } from "@/server/services/team";
import { listLeadsForBoard } from "@/server/services/leads";
import { listProperties } from "@/server/services/properties";
import { can } from "@/server/auth/permissions";
import { ScheduleVisitButton } from "./schedule";
import { WeekCalendar } from "./calendar";
import { AgentFilter } from "./agent-filter";

export const metadata = { title: "Site Visits" };

function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); // Monday
  return s;
}

export default async function SiteVisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; agent?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const weekStart = startOfWeek(sp.week ? new Date(sp.week) : new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  const [ctx, visits, assignees, leads, properties] = await Promise.all([
    getOrgContext(user.orgId),
    listVisits(user, { from: weekStart, to: weekEnd, assignedToId: sp.agent }),
    listAssignees(user),
    listLeadsForBoard(user, {}),
    listProperties(user, {}),
  ]);
  const { locale } = ctx.org;
  const teamWide = can(user.role, "visit", "viewAll");

  const prevWeek = new Date(weekStart.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(weekStart.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const weekLabel = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).formatRange(
    weekStart,
    new Date(weekEnd.getTime() - 1)
  );

  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/site-visits?${s}` : "/site-visits";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Site Visits</h1>
          <p className="text-sm text-ink-faint mt-0.5">{visits.length} visits this week</p>
        </div>
        <ScheduleVisitButton
          leads={leads
            .filter((l) => !["converted", "lost"].includes(l.status))
            .map((l) => ({ value: l.id, label: l.name }))}
          properties={properties.map((p) => ({ value: p.id, label: p.title }))}
          agents={assignees.map((a) => ({ value: a.id, label: a.name }))}
          defaultAgent={user.id}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-full border border-line bg-surface">
          <Link href={qs({ week: prevWeek })} className="p-2 text-ink-soft hover:text-ink" aria-label="Previous week">
            <ChevronLeft size={16} />
          </Link>
          <span className="flex items-center gap-1.5 px-2 text-[13px] font-medium text-ink">
            <CalendarDays size={14} className="text-ink-faint" /> {weekLabel}
          </span>
          <Link href={qs({ week: nextWeek })} className="p-2 text-ink-soft hover:text-ink" aria-label="Next week">
            <ChevronRight size={16} />
          </Link>
        </div>
        <Link
          href={qs({ week: undefined })}
          className="text-[13px] font-medium text-primary hover:underline"
        >
          Today
        </Link>
        {teamWide && (
          <AgentFilter agents={assignees.map((a) => ({ value: a.id, label: a.name }))} />
        )}
      </div>

      <WeekCalendar
        weekStart={weekStart.toISOString()}
        visits={visits.map((v) => ({
          id: v.id,
          scheduledAt: v.scheduledAt,
          status: v.status,
          outcome: v.outcome,
          lead: v.lead,
          property: v.property,
          agent: v.assignedTo.name,
        }))}
        locale={locale}
      />
    </div>
  );
}
