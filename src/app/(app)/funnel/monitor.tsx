"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, Bot, Play, Repeat, UserRoundPlus, Zap } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { runAutomationNowAction } from "./actions";

type Stats = {
  lastRunAt: string | null;
  runs24h: number;
  remindersToday: number;
  flaggedToday: number;
  assignedToday: number;
};
type Run = {
  id: string;
  trigger: string;
  followupReminders: number;
  staleFlagged: number;
  autoAssigned: number;
  durationMs: number;
  createdAt: string;
};

const INTERVALS = [
  { label: "15s", ms: 15000 },
  { label: "30s", ms: 30000 },
  { label: "60s", ms: 60000 },
];

const triggerStyle: Record<string, string> = {
  cron: "bg-accent-sky/10 text-accent-sky",
  manual: "bg-accent-violet/10 text-accent-violet",
  loop: "bg-primary-soft text-primary",
};

export function AutomationMonitor({
  autoAssign,
  staleLeadDays,
  initialStats,
  initialRuns,
}: {
  autoAssign: boolean;
  staleLeadDays: number;
  initialStats: Stats;
  initialRuns: Run[];
}) {
  const router = useRouter();
  const [looping, setLooping] = useState(false);
  const [intervalMs, setIntervalMs] = useState(30000);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function tick(trigger: "manual" | "loop") {
    setRunning(true);
    try {
      const result = await runAutomationNowAction(trigger);
      if ("error" in result) {
        setLastResult(result.error);
        setLooping(false);
        return;
      }
      setLastResult(
        `${result.followupReminders} reminders · ${result.staleFlagged} flagged · ${result.autoAssigned} assigned`
      );
      startTransition(() => router.refresh());
    } catch {
      // A transient failure must not freeze the monitor or wedge the loop.
      setLastResult("Run failed — loop stopped. Try again.");
      setLooping(false);
    } finally {
      setRunning(false);
    }
  }

  // In-browser loop: fire on the chosen interval while the toggle is on and the
  // tab is open. (The always-on path is the external cron hitting /api/cron/run.)
  useEffect(() => {
    if (!looping) return;
    let cancelled = false;
    const schedule = () => {
      timer.current = setTimeout(async () => {
        if (cancelled) return;
        await tick("loop");
        if (!cancelled) schedule();
      }, intervalMs);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looping, intervalMs]);

  const tiles = [
    { label: "Runs (24h)", value: initialStats.runs24h, icon: Repeat, color: "text-primary bg-primary-soft" },
    { label: "Reminders (24h)", value: initialStats.remindersToday, icon: AlarmClock, color: "text-accent-amber bg-accent-amber/10" },
    { label: "Flagged stale (24h)", value: initialStats.flaggedToday, icon: Zap, color: "text-accent-rose bg-accent-rose/10" },
    { label: "Auto-assigned (24h)", value: initialStats.assignedToday, icon: UserRoundPlus, color: "text-accent-teal bg-accent-teal/10" },
  ];

  return (
    <Card>
      <CardHeader
        title="Automation Loop"
        subtitle="Follow-up reminders, stale-lead flagging, and round-robin assignment"
        action={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
              running ? "bg-accent-green/10 text-accent-green" : looping ? "bg-primary-soft text-primary" : "bg-canvas text-ink-faint"
            )}
          >
            <span className={cn("size-1.5 rounded-full", running ? "bg-accent-green animate-pulse" : looping ? "bg-primary" : "bg-ink-faint")} />
            {running ? "Running…" : looping ? "Looping" : "Idle"}
          </span>
        }
      />

      <div className="px-5 pb-5 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => tick("manual")} disabled={running || looping}>
            <Play size={14} /> Run once
          </Button>
          <Button
            size="sm"
            variant={looping ? "danger" : "secondary"}
            onClick={() => setLooping((v) => !v)}
          >
            <Repeat size={14} /> {looping ? "Stop loop" : "Start loop"}
          </Button>
          <div className="flex items-center rounded-full border border-line bg-surface p-0.5">
            {INTERVALS.map((iv) => (
              <button
                key={iv.ms}
                disabled={looping}
                onClick={() => setIntervalMs(iv.ms)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[12px] font-medium cursor-pointer disabled:cursor-not-allowed",
                  intervalMs === iv.ms ? "bg-primary-soft text-primary" : "text-ink-soft hover:text-ink"
                )}
              >
                {iv.label}
              </button>
            ))}
          </div>
          {lastResult && <span className="text-[12px] text-ink-faint">{lastResult}</span>}
        </div>

        {!autoAssign && (
          <p className="text-[12px] text-ink-faint rounded-xl bg-canvas px-3 py-2">
            Auto-assign is off for this org — the loop still fires reminders and flags stale leads. Enable it in Settings to round-robin new leads. Stale threshold: {staleLeadDays} days.
          </p>
        )}

        {/* 24h stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-canvas p-3 flex items-center gap-2.5">
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", t.color)}>
                <t.icon size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-ink-faint truncate">{t.label}</p>
                <p className="font-display text-base font-bold text-ink leading-tight">{t.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Live run feed */}
        <div>
          <p className="text-[12px] font-semibold text-ink-soft mb-2 flex items-center gap-1.5">
            <Bot size={13} /> Recent runs
          </p>
          {initialRuns.length === 0 ? (
            <p className="text-[13px] text-ink-faint">No runs yet — hit “Run once” or start the loop.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[12px] text-ink-faint border-b border-line">
                    <th className="py-2 font-medium">When</th>
                    <th className="py-2 font-medium">Trigger</th>
                    <th className="py-2 font-medium">Reminders</th>
                    <th className="py-2 font-medium">Flagged</th>
                    <th className="py-2 font-medium">Assigned</th>
                    <th className="py-2 font-medium text-right">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {initialRuns.map((r) => (
                    <tr key={r.id} className="border-b border-line/50 last:border-0">
                      <td className="py-2 text-ink-soft">{timeAgo(r.createdAt)}</td>
                      <td className="py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", triggerStyle[r.trigger] ?? "bg-canvas text-ink-soft")}>
                          {r.trigger}
                        </span>
                      </td>
                      <td className="py-2 text-ink-soft">{r.followupReminders}</td>
                      <td className="py-2 text-ink-soft">{r.staleFlagged}</td>
                      <td className="py-2 text-ink-soft">{r.autoAssigned}</td>
                      <td className="py-2 text-right text-ink-faint">{r.durationMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
