"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, PhoneCall, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { addNoteAction, changeLeadFieldAction, deleteLeadAction, logCallAction } from "../actions";
import { setLeadTagsAction } from "../views-actions";

type Option = { value: string; label: string };

export function LeadControls({
  lead,
  statuses,
  assignees,
  canAssign,
  isLost,
}: {
  lead: {
    id: string;
    status: string;
    priority: string;
    assignedToId: string;
    followUpDueAt: string | null;
    lostReason: string | null;
  };
  statuses: Option[];
  assignees: Option[];
  canAssign: boolean;
  isLost: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const change = (field: Parameters<typeof changeLeadFieldAction>[1]) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      const value = e.target.value;
      startTransition(() => changeLeadFieldAction(lead.id, field, value));
    };

  return (
    <div className={cn("space-y-3", pending && "opacity-60 pointer-events-none")}>
      <Field label="Status">
        <Select defaultValue={lead.status} onChange={change("status")}>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Priority">
        <Select defaultValue={lead.priority} onChange={change("priority")}>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </Select>
      </Field>
      {canAssign && (
        <Field label="Assigned agent">
          <Select defaultValue={lead.assignedToId} onChange={change("assignedToId")}>
            <option value="">Unassigned</option>
            {assignees.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Follow-up due">
        <Input
          type="datetime-local"
          defaultValue={lead.followUpDueAt ? lead.followUpDueAt.slice(0, 16) : ""}
          onBlur={change("followUpDueAt")}
        />
      </Field>
      {isLost && (
        <Field label="Lost reason">
          <Input
            defaultValue={lead.lostReason ?? ""}
            placeholder="Why was this lead lost?"
            onBlur={change("lostReason")}
          />
        </Field>
      )}
    </div>
  );
}

export function LeadTags({ id, tags }: { id: string; tags: string[] }) {
  const [pending, startTransition] = useTransition();
  const [input, setInput] = useState("");

  const commit = (next: string[]) => startTransition(() => setLeadTagsAction(id, next));

  return (
    <div className={cn(pending && "opacity-60")}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.length === 0 && <span className="text-[13px] text-ink-faint">No tags yet</span>}
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-0.5 text-[12px] text-ink-soft">
            {t}
            <button
              onClick={() => commit(tags.filter((x) => x !== t))}
              className="text-ink-faint hover:text-accent-rose cursor-pointer"
              aria-label={`Remove tag ${t}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = input.trim();
          if (t && !tags.includes(t)) commit([...tags, t]);
          setInput("");
        }}
      >
        <Input
          className="h-8"
          placeholder="Add a tag…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </form>
    </div>
  );
}

export function LeadComposer({ id }: { id: string }) {
  const [mode, setMode] = useState<"note" | "call">("note");
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          if (mode === "note") await addNoteAction(id, formData);
          else await logCallAction(id, formData);
        });
      }}
      key={mode}
    >
      <div className="flex gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => setMode("note")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium cursor-pointer",
            mode === "note" ? "bg-primary-soft text-primary" : "text-ink-soft hover:bg-canvas"
          )}
        >
          <MessageSquare size={13} /> Add note
        </button>
        <button
          type="button"
          onClick={() => setMode("call")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium cursor-pointer",
            mode === "call" ? "bg-primary-soft text-primary" : "text-ink-soft hover:bg-canvas"
          )}
        >
          <PhoneCall size={13} /> Log call
        </button>
      </div>
      <Textarea
        name="text"
        required
        placeholder={mode === "note" ? "Write a note…" : "Call summary — who said what, next step…"}
      />
      <div className="flex justify-end mt-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : mode === "note" ? "Save note" : "Log call"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteLeadButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Delete lead">
        <Trash2 size={15} className="text-accent-rose" />
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete lead?">
        <p className="text-sm text-ink-soft">
          <span className="font-medium text-ink">{name}</span> will be removed from all lists.
          This is a soft delete — an admin can restore it from the database.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteLeadAction(id);
                router.push("/leads");
              })
            }
          >
            {pending ? "Deleting…" : "Delete lead"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
