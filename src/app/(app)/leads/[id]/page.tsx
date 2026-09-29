import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Home,
  Mail,
  MessageSquare,
  Phone,
  PhoneCall,
  RefreshCw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { requireUser, getOrgContext } from "@/server/session";
import { getLead } from "@/server/services/leads";
import { matchPropertiesForLead } from "@/server/services/properties";
import { listAssignees } from "@/server/services/team";
import { can } from "@/server/auth/permissions";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { Avatar } from "@/components/ui/avatar";
import { formatCurrency, formatDate, formatDateTime, timeAgo } from "@/lib/format";
import { LeadControls, LeadComposer, LeadTags, DeleteLeadButton } from "./controls";

export const metadata = { title: "Lead" };

const activityIcon: Record<string, React.ReactNode> = {
  NOTE: <MessageSquare size={13} />,
  CALL: <PhoneCall size={13} />,
  STATUS_CHANGE: <RefreshCw size={13} />,
  ASSIGNMENT: <UserRound size={13} />,
  VISIT: <CalendarDays size={13} />,
  SYSTEM: <Sparkles size={13} />,
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [lead, ctx, assignees] = await Promise.all([
    getLead(user, id),
    getOrgContext(user.orgId),
    listAssignees(user),
  ]);
  if (!lead) notFound();

  const { currency, locale } = ctx.org;
  const statusMap = new Map(ctx.leadStatuses.map((s) => [s.value, s]));
  const status = statusMap.get(lead.status);
  const isLost = Boolean((status?.meta as { lost?: boolean } | null)?.lost);
  const matches = await matchPropertiesForLead(user, lead);
  const canDelete = can(user.role, "lead", "delete");
  const canAssign = can(user.role, "lead", "assign");

  return (
    <div className="space-y-4">
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-[13px] text-ink-faint hover:text-ink">
        <ArrowLeft size={14} /> All leads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={lead.name} size="lg" />
          <div>
            <h1 className="font-display text-xl font-bold text-ink">{lead.name}</h1>
            <p className="text-[13px] text-ink-faint">
              Added {formatDate(lead.createdAt, locale)} · {ctx.leadSources.find((s) => s.value === lead.source)?.label ?? "Unknown source"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && <Badge color={status.color} className="text-sm px-3 py-1">{status.label}</Badge>}
          {canDelete && <DeleteLeadButton id={lead.id} name={lead.name} />}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Left: profile + controls */}
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <h3 className="font-display font-semibold text-[15px]">Contact</h3>
            <p className="flex items-center gap-2 text-[13px] text-ink-soft">
              <Phone size={14} className="text-ink-faint" /> {lead.phone ?? "—"}
            </p>
            <p className="flex items-center gap-2 text-[13px] text-ink-soft">
              <Mail size={14} className="text-ink-faint" /> {lead.email ?? "—"}
            </p>
            <div className="border-t border-line pt-3 grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <p className="text-ink-faint text-[12px]">Budget</p>
                <p className="font-semibold text-ink">
                  {formatCurrency(lead.budget, currency, locale, { compact: true })}
                </p>
              </div>
              <div>
                <p className="text-ink-faint text-[12px]">Interested in</p>
                <p className="font-semibold text-ink capitalize">
                  {ctx.propertyCategories.find((c) => c.value === lead.propertyType)?.label ?? "Any"}
                </p>
              </div>
            </div>
            {lead.notes && (
              <div className="border-t border-line pt-3">
                <p className="text-ink-faint text-[12px] mb-1">Notes</p>
                <p className="text-[13px] text-ink-soft whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </Card>

          {lead.scoreBand && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-semibold text-[15px]">AI Insight</h3>
                <ScoreBadge band={lead.scoreBand} score={lead.score} />
              </div>
              {lead.scoreReason && <p className="text-[13px] text-ink-soft">{lead.scoreReason}</p>}
              <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className="text-ink-faint text-[12px]">Likely intent</p>
                  <p className="font-medium text-ink capitalize">{lead.intent ?? "—"}</p>
                </div>
                <div>
                  <p className="text-ink-faint text-[12px]">Next action</p>
                  <p className="font-medium text-ink">{lead.nextAction ?? "—"}</p>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="font-display font-semibold text-[15px] mb-3">Manage</h3>
            <LeadControls
              lead={{
                id: lead.id,
                status: lead.status,
                priority: lead.priority,
                assignedToId: lead.assignedTo?.id ?? "",
                followUpDueAt: lead.followUpDueAt,
                lostReason: lead.lostReason,
              }}
              statuses={ctx.leadStatuses.map((s) => ({ value: s.value, label: s.label }))}
              assignees={assignees.map((a) => ({ value: a.id, label: a.name }))}
              canAssign={canAssign}
              isLost={isLost}
            />
          </Card>

          <Card className="p-5">
            <h3 className="font-display font-semibold text-[15px] mb-3">Tags</h3>
            <LeadTags id={lead.id} tags={lead.tags} />
          </Card>

          {matches.length > 0 && (
            <Card>
              <CardHeader title="Matching properties" subtitle="Same category, within ±25% of budget" />
              <ul className="px-5 pb-4 space-y-2.5">
                {matches.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 text-[13px]">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary shrink-0">
                      <Home size={14} />
                    </span>
                    <div className="min-w-0">
                      <Link href={`/properties?q=${encodeURIComponent(p.title)}`} className="font-medium text-ink hover:text-primary block truncate">
                        {p.title}
                      </Link>
                      <p className="text-[12px] text-ink-faint">
                        {formatCurrency(p.price, currency, locale, { compact: true })} · {p.location}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Right: timeline (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <LeadComposer id={lead.id} />
          </Card>

          <Card>
            <CardHeader title="Activity Timeline" subtitle="Every touchpoint, newest first" />
            <ol className="px-5 pb-5 space-y-4">
              {lead.activities.map((a) => {
                const p = a.payload as Record<string, unknown>;
                return (
                  <li key={a.id} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary mt-0.5">
                      {activityIcon[a.type] ?? <Sparkles size={13} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ink">
                        <span className="font-medium">{a.actor?.name ?? "System"}</span>{" "}
                        <span className="text-ink-soft">{describeActivity(a.type, p, statusMap)}</span>
                      </p>
                      {(a.type === "NOTE" || a.type === "CALL") && typeof p.text === "string" && (
                        <p className="mt-1 text-[13px] text-ink-soft bg-canvas rounded-xl px-3 py-2 whitespace-pre-wrap">
                          {p.text}
                        </p>
                      )}
                      <p className="text-[11px] text-ink-faint mt-1">{timeAgo(a.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {lead.visits.length > 0 && (
            <Card>
              <CardHeader title="Site Visits" />
              <ul className="px-5 pb-4 space-y-2.5">
                {lead.visits.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="text-ink font-medium">{v.property.title}</span>
                    <span className="text-ink-faint">{formatDateTime(v.scheduledAt, locale)}</span>
                    <Badge
                      color={
                        v.status === "COMPLETED" ? "#22C55E" :
                        v.status === "SCHEDULED" ? "#0EA5E9" :
                        v.status === "NO_SHOW" ? "#F59E0B" : "#F43F5E"
                      }
                    >
                      {v.status.replace("_", " ").toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function describeActivity(
  type: string,
  p: Record<string, unknown>,
  statusMap: Map<string, { label: string }>
): string {
  switch (type) {
    case "STATUS_CHANGE":
      return `moved this lead from ${statusMap.get(String(p.from))?.label ?? p.from} to ${statusMap.get(String(p.to))?.label ?? p.to}`;
    case "NOTE":
      return "added a note";
    case "CALL":
      return "logged a call";
    case "ASSIGNMENT":
      return "reassigned this lead";
    case "VISIT":
      return `site visit at ${p.propertyTitle ?? "a property"}${p.status ? ` — ${String(p.status).toLowerCase()}` : ""}${p.outcome ? `: “${p.outcome}”` : ""}`;
    default:
      return typeof p.text === "string" ? p.text.toLowerCase() : "updated this lead";
  }
}
