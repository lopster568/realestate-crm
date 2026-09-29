"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Trash2, UserX, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { deleteVisitAction, updateVisitStatusAction } from "./actions";

type CalVisit = {
  id: string;
  scheduledAt: string;
  status: string;
  outcome: string | null;
  lead: { id: string; name: string; phone: string | null };
  property: { id: string; title: string; location: string | null };
  agent: string;
};

const statusColor: Record<string, string> = {
  SCHEDULED: "#0EA5E9",
  COMPLETED: "#22C55E",
  CANCELLED: "#F43F5E",
  NO_SHOW: "#F59E0B",
};

export function WeekCalendar({
  weekStart,
  visits,
  locale,
}: {
  weekStart: string;
  visits: CalVisit[];
  locale: string;
}) {
  const [selected, setSelected] = useState<CalVisit | null>(null);
  const start = new Date(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000));
  const today = new Date().toDateString();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days.map((day) => {
          const dayVisits = visits
            .filter((v) => new Date(v.scheduledAt).toDateString() === day.toDateString())
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
          const isToday = day.toDateString() === today;
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "rounded-card border bg-surface min-h-36 flex flex-col",
                isToday ? "border-primary/40 ring-1 ring-primary/20" : "border-line/60"
              )}
            >
              <p
                className={cn(
                  "px-3 pt-2.5 pb-1.5 text-[12px] font-semibold",
                  isToday ? "text-primary" : "text-ink-soft"
                )}
              >
                {day.toLocaleDateString(locale, { weekday: "short", day: "numeric" })}
              </p>
              <div className="px-2 pb-2 space-y-1.5">
                {dayVisits.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelected(v)}
                    className="w-full text-left rounded-lg px-2 py-1.5 cursor-pointer hover:opacity-80 transition"
                    style={{ backgroundColor: `${statusColor[v.status]}14` }}
                  >
                    <p className="text-[11px] font-semibold" style={{ color: statusColor[v.status] }}>
                      {new Date(v.scheduledAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
                    </p>
                    <p className="text-[12px] font-medium text-ink leading-tight truncate">{v.lead.name}</p>
                    <p className="text-[11px] text-ink-faint truncate">{v.property.title}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <VisitModal visit={selected} locale={locale} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function VisitModal({
  visit,
  locale,
  onClose,
}: {
  visit: CalVisit;
  locale: string;
  onClose: () => void;
}) {
  const [outcomeFor, setOutcomeFor] = useState<"COMPLETED" | "CANCELLED" | "NO_SHOW" | null>(null);
  const [pending, setPending] = useState(false);

  async function finalize(formData?: FormData) {
    if (!outcomeFor) return;
    setPending(true);
    await updateVisitStatusAction(
      visit.id,
      outcomeFor,
      formData ? String(formData.get("outcome") ?? "") : undefined
    );
    setPending(false);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Site Visit">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge color={statusColor[visit.status]}>{visit.status.replace("_", " ").toLowerCase()}</Badge>
          <span className="text-[13px] text-ink-faint">
            {new Date(visit.scheduledAt).toLocaleString(locale, {
              weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
            })}
          </span>
        </div>
        <p className="text-sm">
          <Link href={`/leads/${visit.lead.id}`} className="font-semibold text-ink hover:text-primary">
            {visit.lead.name}
          </Link>
          {visit.lead.phone && <span className="text-ink-faint"> · {visit.lead.phone}</span>}
        </p>
        <p className="text-sm text-ink-soft">
          {visit.property.title}
          {visit.property.location && <span className="text-ink-faint"> · {visit.property.location}</span>}
        </p>
        <p className="text-[13px] text-ink-faint">Agent: {visit.agent}</p>
        {visit.outcome && (
          <p className="text-[13px] text-ink-soft bg-canvas rounded-xl px-3 py-2">“{visit.outcome}”</p>
        )}

        {visit.status === "SCHEDULED" && !outcomeFor && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={() => setOutcomeFor("COMPLETED")}>
              <CheckCircle2 size={14} /> Complete
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOutcomeFor("NO_SHOW")}>
              <UserX size={14} /> No-show
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOutcomeFor("CANCELLED")}>
              <XCircle size={14} /> Cancel visit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                await deleteVisitAction(visit.id);
                onClose();
              }}
            >
              <Trash2 size={14} className="text-accent-rose" />
            </Button>
          </div>
        )}

        {outcomeFor && (
          <form action={finalize} className="space-y-3 pt-1">
            <Field label={outcomeFor === "COMPLETED" ? "Outcome — how did it go?" : "Reason (optional)"}>
              <Textarea
                name="outcome"
                placeholder={
                  outcomeFor === "COMPLETED"
                    ? "e.g. Very interested, wants price discussion"
                    : "e.g. Lead rescheduled for next week"
                }
                autoFocus
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOutcomeFor(null)}>
                Back
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : `Mark ${outcomeFor.replace("_", " ").toLowerCase()}`}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
