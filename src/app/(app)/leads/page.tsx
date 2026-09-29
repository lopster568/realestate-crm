import Link from "next/link";
import { LayoutGrid, List, UsersRound } from "lucide-react";
import { requireUser, getOrgContext } from "@/server/session";
import { listLeads, listLeadsForBoard, type LeadFilters } from "@/server/services/leads";
import { listAssignees } from "@/server/services/team";
import { listViews } from "@/server/services/views";
import { listLeadTags } from "@/server/services/bulk";
import { can } from "@/server/auth/permissions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LeadFiltersBar } from "./filters";
import { LeadBoard } from "./board";
import { LeadsTable, type LeadRow } from "./leads-table";
import { SavedViews } from "./saved-views";
import { NewLeadButton } from "./new-lead";
import { ScoreButton } from "./score-button";

export const metadata = { title: "Leads" };

type Search = {
  view?: string;
  status?: string;
  priority?: string;
  source?: string;
  agent?: string;
  tag?: string;
  band?: string;
  q?: string;
  page?: string;
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = sp.view === "board" ? "board" : "table";
  const filters: LeadFilters = {
    status: sp.status,
    priority: sp.priority,
    source: sp.source,
    assignedToId: sp.agent,
    tag: sp.tag,
    band: sp.band,
    q: sp.q,
  };
  const page = Math.max(1, Number(sp.page) || 1);

  const [ctx, assignees, views, tags] = await Promise.all([
    getOrgContext(user.orgId),
    listAssignees(user),
    listViews(user, "lead"),
    listLeadTags(user),
  ]);
  const { currency, locale } = ctx.org;
  const canAssign = can(user.role, "lead", "assign");
  const canDelete = can(user.role, "lead", "delete");

  const statusMap = new Map(ctx.leadStatuses.map((s) => [s.value, s]));
  const sourceMap = new Map(ctx.leadSources.map((s) => [s.value, s.label]));
  const statusOptions = ctx.leadStatuses.map((s) => ({ value: s.value, label: s.label }));
  const agentOptions = assignees.map((a) => ({ value: a.id, label: a.name }));

  const data =
    view === "table"
      ? await listLeads(user, filters, page)
      : { rows: await listLeadsForBoard(user, filters), total: 0, page: 1, pageSize: 0 };

  const rows: LeadRow[] = data.rows.map((l) => ({
    id: l.id,
    name: l.name,
    contact: l.phone ?? l.email ?? "—",
    statusLabel: statusMap.get(l.status)?.label ?? l.status,
    statusColor: statusMap.get(l.status)?.color ?? null,
    priority: l.priority,
    sourceLabel: sourceMap.get(l.source ?? "") ?? "—",
    budgetLabel: formatCurrency(l.budget, currency, locale, { compact: true }),
    agent: l.assignedTo?.name ?? null,
    createdLabel: formatDate(l.createdAt, locale),
    scoreBand: l.scoreBand,
    score: l.score,
    tags: l.tags,
  }));

  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) {
      if (v) params.set(k, v);
    }
    const s = params.toString();
    return s ? `/leads?${s}` : "/leads";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Leads</h1>
          <p className="text-sm text-ink-faint mt-0.5">
            {view === "table" ? `${data.total} leads` : `${data.rows.length} on the board`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-line bg-surface p-0.5">
            <Link
              href={qs({ view: undefined, page: undefined })}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium",
                view === "table" ? "bg-primary-soft text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              <List size={14} /> Table
            </Link>
            <Link
              href={qs({ view: "board", page: undefined })}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium",
                view === "board" ? "bg-primary-soft text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              <LayoutGrid size={14} /> Board
            </Link>
          </div>
          {can(user.role, "lead", "update") && <ScoreButton />}
          <NewLeadButton ctx={serializableCtx(ctx)} assignees={assignees} canAssign={canAssign} />
        </div>
      </div>

      <SavedViews views={views} />

      <LeadFiltersBar
        statuses={statusOptions}
        sources={ctx.leadSources.map((s) => ({ value: s.value, label: s.label }))}
        agents={canAssign ? agentOptions : []}
        tags={tags}
      />

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UsersRound size={20} />}
            title="No leads match"
            hint="Try clearing filters, or capture a new lead to get the pipeline moving."
          />
        </Card>
      ) : view === "board" ? (
        <LeadBoard
          leads={data.rows.map((l) => ({
            id: l.id,
            name: l.name,
            status: l.status,
            priority: l.priority,
            scoreBand: l.scoreBand,
            score: l.score,
            budgetLabel: formatCurrency(l.budget, currency, locale, { compact: true }),
            assignedTo: l.assignedTo?.name ?? null,
            source: sourceMap.get(l.source ?? "") ?? l.source,
          }))}
          statuses={ctx.leadStatuses.map((s) => ({
            value: s.value,
            label: s.label,
            color: s.color ?? "#4F46E5",
          }))}
        />
      ) : (
        <>
          <LeadsTable
            rows={rows}
            statuses={statusOptions}
            agents={agentOptions}
            canAssign={canAssign}
            canDelete={canDelete}
          />
          {data.total > data.pageSize && (
            <div className="flex items-center justify-between px-1 py-1 text-[13px] text-ink-soft">
              <span>
                Page {data.page} of {Math.ceil(data.total / data.pageSize)}
              </span>
              <span className="flex gap-3">
                {data.page > 1 && (
                  <Link className="text-primary font-medium" href={qs({ page: String(data.page - 1) })}>
                    ← Previous
                  </Link>
                )}
                {data.page * data.pageSize < data.total && (
                  <Link className="text-primary font-medium" href={qs({ page: String(data.page + 1) })}>
                    Next →
                  </Link>
                )}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function serializableCtx(ctx: Awaited<ReturnType<typeof getOrgContext>>) {
  return {
    statuses: ctx.leadStatuses.map((s) => ({ value: s.value, label: s.label })),
    sources: ctx.leadSources.map((s) => ({ value: s.value, label: s.label })),
    categories: ctx.propertyCategories.map((s) => ({ value: s.value, label: s.label })),
  };
}
