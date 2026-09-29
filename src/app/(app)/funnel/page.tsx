import { redirect } from "next/navigation";
import { requireUser, getOrgContext } from "@/server/session";
import { can } from "@/server/auth/permissions";
import { getFunnel } from "@/server/services/funnel";
import { getAutomationStats, listAutomationRuns } from "@/server/services/automation";
import { Card, CardHeader } from "@/components/ui/card";
import { AutomationMonitor } from "./monitor";

export const metadata = { title: "Funnel" };

export default async function FunnelPage() {
  const user = await requireUser();
  if (!can(user.role, "dashboard", "viewAll")) redirect("/dashboard");

  const [ctx, funnel, stats, runs] = await Promise.all([
    getOrgContext(user.orgId),
    getFunnel(user),
    getAutomationStats(user),
    listAutomationRuns(user),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Funnel &amp; Automation</h1>
        <p className="text-sm text-ink-faint mt-0.5">
          Pipeline health and the automation loop that keeps it moving.
        </p>
      </div>

      <Card>
        <CardHeader title="Conversion Funnel" subtitle={`${funnel.total} active leads in the pipeline`} />
        <div className="px-5 pb-5 space-y-2">
          {funnel.stages.map((s, i) => (
            <div key={s.value}>
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="font-medium text-ink">
                  {s.label} <span className="text-ink-faint font-normal">· {s.here} here</span>
                </span>
                <span className="text-ink-faint">
                  {s.reached} reached · {s.pct}%{i > 0 && ` · ${s.stepPct}% of prev`}
                </span>
              </div>
              <div className="h-3 rounded-full bg-canvas overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(s.pct, 2)}%`, backgroundColor: s.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <AutomationMonitor
        autoAssign={ctx.org.autoAssign}
        staleLeadDays={ctx.org.staleLeadDays}
        initialStats={stats}
        initialRuns={runs}
      />
    </div>
  );
}
