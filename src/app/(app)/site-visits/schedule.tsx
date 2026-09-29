"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { createVisitAction, type VisitFormState } from "./actions";

type Option = { value: string; label: string };

export function ScheduleVisitButton({
  leads,
  properties,
  agents,
  defaultAgent,
}: {
  leads: Option[];
  properties: Option[];
  agents: Option[];
  defaultAgent: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<VisitFormState, FormData>(
    async (prev, formData) => {
      const result = await createVisitAction(prev, formData);
      if (!result) setOpen(false);
      return result;
    },
    undefined
  );

  const conflicts = state && "conflicts" in state ? state.conflicts : null;
  const error = state && "error" in state ? state.error : null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus size={15} /> Schedule Visit
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Schedule Site Visit">
        <form action={formAction} className="space-y-4">
          <Field label="Lead *">
            <Select name="leadId" required defaultValue="">
              <option value="" disabled>Select lead</option>
              {leads.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Property *">
            <Select name="propertyId" required defaultValue="">
              <option value="" disabled>Select property</option>
              {properties.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Agent *">
              <Select name="assignedToId" required defaultValue={defaultAgent}>
                {agents.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date & time *">
              <Input name="scheduledAt" type="datetime-local" required />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" placeholder="Meeting point, documents to carry…" />
          </Field>

          {error && (
            <p className="text-sm text-accent-rose bg-accent-rose/10 rounded-xl px-3 py-2">{error}</p>
          )}

          {conflicts && (
            <div className="rounded-xl border border-accent-amber/40 bg-accent-amber/10 p-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-amber">
                <TriangleAlert size={14} /> Agent is double-booked
              </p>
              <ul className="mt-1.5 space-y-1 text-[13px] text-ink-soft">
                {conflicts.map((c) => (
                  <li key={c.id}>
                    {c.leadName} — {c.propertyTitle} at{" "}
                    {new Date(c.scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" name="force" value="1" className="accent-[#4F46E5]" />
                Schedule anyway
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Scheduling…" : "Confirm Schedule"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
