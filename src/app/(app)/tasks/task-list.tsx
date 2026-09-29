"use client";

import { useRef, useTransition } from "react";
import Link from "next/link";
import { AlarmClockPlus, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { SerializedTask } from "@/server/services/tasks";
import { createTaskAction, deleteTaskAction, snoozeTaskAction, toggleTaskAction } from "./actions";

export function NewTaskForm({ assignees }: { assignees: Array<{ value: string; label: string }> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(fd) =>
        startTransition(async () => {
          await createTaskAction(fd);
          formRef.current?.reset();
        })
      }
      className="flex flex-wrap items-center gap-2"
    >
      <Input name="title" required placeholder="Add a task…" className="flex-1 min-w-48" />
      <Input name="dueAt" type="datetime-local" className="w-auto" />
      {assignees.length > 0 && (
        <Select name="assignedToId" defaultValue="" className="w-auto">
          <option value="">Me</option>
          {assignees.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </Select>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        <Plus size={14} /> Add
      </Button>
    </form>
  );
}

export function TaskRow({
  task,
  locale,
  showAssignee,
}: {
  task: SerializedTask;
  locale: string;
  showAssignee: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const done = task.status === "DONE";
  const overdue = !done && task.dueAt && new Date(task.dueAt) < new Date();

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", pending && "opacity-50")}>
      <button
        onClick={() => startTransition(() => toggleTaskAction(task.id))}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border cursor-pointer transition",
          done ? "bg-primary border-primary text-white" : "border-ink-faint hover:border-primary"
        )}
        aria-label={done ? "Reopen task" : "Complete task"}
      >
        {done && <Check size={13} strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] font-medium", done ? "text-ink-faint line-through" : "text-ink")}>
          {task.linkedType === "lead" && task.linkedId ? (
            <Link href={`/leads/${task.linkedId}`} className="hover:text-primary">
              {task.title}
            </Link>
          ) : (
            task.title
          )}
        </p>
        {task.dueAt && (
          <p className={cn("text-[12px]", overdue ? "text-accent-rose font-medium" : "text-ink-faint")}>
            {overdue ? "Overdue · " : "Due "}
            {formatDateTime(task.dueAt, locale)}
          </p>
        )}
      </div>

      {showAssignee && (
        <span className="flex items-center gap-1.5 text-[12px] text-ink-faint">
          <Avatar name={task.assignedTo.name} size="sm" /> {task.assignedTo.name}
        </span>
      )}

      {!done && (
        <button
          onClick={() => startTransition(() => snoozeTaskAction(task.id, 1))}
          className="p-1.5 rounded-full text-ink-faint hover:bg-canvas hover:text-ink cursor-pointer"
          title="Snooze 1 day"
        >
          <AlarmClockPlus size={15} />
        </button>
      )}
      <button
        onClick={() => startTransition(() => deleteTaskAction(task.id))}
        className="p-1.5 rounded-full text-ink-faint hover:bg-canvas hover:text-accent-rose cursor-pointer"
        title="Delete task"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
