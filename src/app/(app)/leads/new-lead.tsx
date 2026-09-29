"use client";

import { useActionState, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { createLeadAction, type CreateLeadState } from "./actions";

type Option = { value: string; label: string };

export function NewLeadButton({
  ctx,
  assignees,
  canAssign,
}: {
  ctx: { statuses: Option[]; sources: Option[]; categories: Option[] };
  assignees: Array<{ id: string; name: string }>;
  canAssign: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CreateLeadState, FormData>(
    createLeadAction,
    undefined
  );

  const duplicates = state && "duplicates" in state ? state.duplicates : null;
  const error = state && "error" in state ? state.error : null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={15} /> New Lead
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create New Lead" wide>
        <form action={formAction} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name *">
              <Input name="name" required placeholder="e.g. Rohit Sharma" />
            </Field>
            <Field label="Phone">
              <Input name="phone" placeholder="+91 …" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" placeholder="name@email.com" />
            </Field>
            <Field label="Source">
              <Select name="source" defaultValue="">
                <option value="">Select source</option>
                {ctx.sources.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue="MEDIUM">
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </Select>
            </Field>
            <Field label="Budget">
              <Input name="budget" type="number" min="0" placeholder="e.g. 15000000" />
            </Field>
            <Field label="Property interest">
              <Select name="propertyType" defaultValue="">
                <option value="">Any</option>
                {ctx.categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </Field>
            {canAssign && (
              <Field label="Assign to">
                <Select name="assignedToId" defaultValue="">
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Follow-up due">
              <Input name="followUpDueAt" type="datetime-local" />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" placeholder="Context, requirements, anything useful…" />
          </Field>

          {error && (
            <p className="text-sm text-accent-rose bg-accent-rose/10 rounded-xl px-3 py-2">{error}</p>
          )}

          {duplicates && (
            <div className="rounded-xl border border-accent-amber/40 bg-accent-amber/10 p-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-amber">
                <TriangleAlert size={14} /> Possible duplicate{duplicates.length > 1 ? "s" : ""} found
              </p>
              <ul className="mt-1.5 space-y-1 text-[13px] text-ink-soft">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <a href={`/leads/${d.id}`} className="font-medium text-primary hover:underline">
                      {d.name}
                    </a>{" "}
                    — {d.phone ?? d.email} · {d.status}
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" name="force" value="1" className="accent-[#4F46E5]" />
                Create anyway
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create Lead"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
