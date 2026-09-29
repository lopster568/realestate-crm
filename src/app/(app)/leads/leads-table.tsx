"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Tag, Trash2, UserRound, X } from "lucide-react";
import { Badge, PriorityBadge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { bulkDeleteLeadsAction, bulkUpdateLeadsAction } from "./views-actions";

export type LeadRow = {
  id: string;
  name: string;
  contact: string;
  statusLabel: string;
  statusColor: string | null;
  priority: string;
  sourceLabel: string;
  budgetLabel: string;
  agent: string | null;
  createdLabel: string;
  scoreBand: string | null;
  score: number | null;
  tags: string[];
};

type Option = { value: string; label: string };

export function LeadsTable({
  rows,
  statuses,
  agents,
  canAssign,
  canDelete,
}: {
  rows: LeadRow[];
  statuses: Option[];
  agents: Option[];
  canAssign: boolean;
  canDelete: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [tagInput, setTagInput] = useState("");

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const clear = () => setSelected(new Set());

  const ids = [...selected];
  const runBulk = (fn: () => Promise<unknown>) => startTransition(async () => { await fn(); clear(); });

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-primary/30 bg-primary-soft/50 px-4 py-2.5">
          <span className="text-[13px] font-medium text-primary">{selected.size} selected</span>
          <Select
            className="h-8 w-auto"
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              e.target.value = "";
              if (v) runBulk(() => bulkUpdateLeadsAction(ids, { status: v }));
            }}
          >
            <option value="">Set status…</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          {canAssign && (
            <Select
              className="h-8 w-auto"
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                const v = e.target.value;
                e.target.value = "";
                if (v) runBulk(() => bulkUpdateLeadsAction(ids, { assignedToId: v }));
              }}
            >
              <option value="">Assign to…</option>
              {agents.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </Select>
          )}
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (tagInput.trim()) {
                runBulk(() => bulkUpdateLeadsAction(ids, { addTags: [tagInput.trim()] }));
                setTagInput("");
              }
            }}
          >
            <div className="relative">
              <Tag size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint z-10" />
              <Input
                className="h-8 w-32 pl-7"
                placeholder="Add tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
              />
            </div>
          </form>
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => runBulk(() => bulkDeleteLeadsAction(ids))}
            >
              <Trash2 size={14} className="text-accent-rose" /> Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={clear} className="ml-auto">
            <X size={14} /> Clear
          </Button>
        </div>
      )}

      <div className="bg-surface rounded-card shadow-card border border-line/60 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-ink-faint border-b border-line">
              <th className="pl-5 pr-2 py-3 w-8">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[#4F46E5] cursor-pointer" aria-label="Select all" />
              </th>
              <th className="px-3 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Budget</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className={cn(pending && "opacity-60")}>
            {rows.map((l) => (
              <tr key={l.id} className={cn("border-b border-line/50 last:border-0 hover:bg-canvas/60", selected.has(l.id) && "bg-primary-soft/30")}>
                <td className="pl-5 pr-2 py-3">
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="accent-[#4F46E5] cursor-pointer" aria-label={`Select ${l.name}`} />
                </td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-2 flex-wrap">
                    <Link href={`/leads/${l.id}`} className="font-medium text-ink hover:text-primary">{l.name}</Link>
                    <ScoreBadge band={l.scoreBand} score={l.score} />
                    {l.tags.map((t) => (
                      <span key={t} className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-ink-soft">{t}</span>
                    ))}
                  </span>
                  <p className="text-[12px] text-ink-faint">{l.contact}</p>
                </td>
                <td className="px-4 py-3"><Badge color={l.statusColor}>{l.statusLabel}</Badge></td>
                <td className="px-4 py-3"><PriorityBadge priority={l.priority} /></td>
                <td className="px-4 py-3 text-ink-soft">{l.sourceLabel}</td>
                <td className="px-4 py-3 text-ink-soft">{l.budgetLabel}</td>
                <td className="px-4 py-3">
                  {l.agent ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={l.agent} size="sm" />
                      <span className="text-ink-soft">{l.agent}</span>
                    </span>
                  ) : (
                    <span className="text-ink-faint flex items-center gap-1"><UserRound size={13} /> Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-faint">{l.createdLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
