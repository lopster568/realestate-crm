import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { requireUser, getOrgContext } from "@/server/session";
import { listTasks } from "@/server/services/tasks";
import { listAssignees } from "@/server/services/team";
import { can } from "@/server/auth/permissions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { NewTaskForm, TaskRow } from "./task-list";

export const metadata = { title: "Tasks" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const canViewAll = can(user.role, "task", "viewAll");
  const all = canViewAll && sp.scope === "team";

  const [ctx, tasks, assignees] = await Promise.all([
    getOrgContext(user.orgId),
    listTasks(user, { all }),
    listAssignees(user),
  ]);
  const { locale } = ctx.org;

  const open = tasks.filter((t) => t.status === "OPEN");
  const done = tasks.filter((t) => t.status === "DONE");

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Tasks</h1>
          <p className="text-sm text-ink-faint mt-0.5">
            {open.length} open · {done.length} done
          </p>
        </div>
        {canViewAll && (
          <div className="flex rounded-full border border-line bg-surface p-0.5">
            <Link
              href="/tasks"
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-medium",
                !all ? "bg-primary-soft text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              My tasks
            </Link>
            <Link
              href="/tasks?scope=team"
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-medium",
                all ? "bg-primary-soft text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              Team
            </Link>
          </div>
        )}
      </div>

      <Card className="p-4">
        <NewTaskForm
          assignees={canViewAll ? assignees.map((a) => ({ value: a.id, label: a.name })) : []}
        />
      </Card>

      {tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckSquare size={20} />}
            title="No tasks"
            hint="Add follow-ups and to-dos so nothing slips."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line/60">
          {[...open, ...done].map((t) => (
            <TaskRow key={t.id} task={t} locale={locale} showAssignee={all} />
          ))}
        </Card>
      )}
    </div>
  );
}
