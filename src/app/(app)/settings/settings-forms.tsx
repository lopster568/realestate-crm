"use client";

import { useActionState, useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { ListKind } from "@/generated/prisma/client";
import {
  addListItemAction,
  toggleListItemAction,
  updateOrgAction,
  type SettingsFormState,
} from "./actions";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD"];
const LOCALES = ["en-IN", "en-US", "en-GB", "hi-IN", "ar-AE"];
const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
];

export function OrgForm({
  org,
  readOnly,
}: {
  org: { name: string; currency: string; locale: string; timezone: string };
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateOrgAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      <fieldset disabled={readOnly} className="grid sm:grid-cols-2 gap-4">
        <Field label="Brokerage name">
          <Input name="name" defaultValue={org.name} required />
        </Field>
        <Field label="Currency">
          <Select name="currency" defaultValue={org.currency}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Locale">
          <Select name="locale" defaultValue={org.locale}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Timezone">
          <Select name="timezone" defaultValue={org.timezone}>
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </fieldset>

      {state && "error" in state && (
        <p className="text-sm text-accent-rose bg-accent-rose/10 rounded-xl px-3 py-2">{state.error}</p>
      )}
      {state && "saved" in state && (
        <p className="text-sm text-accent-green bg-accent-green/10 rounded-xl px-3 py-2">Saved.</p>
      )}

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}

export function ListManager({
  kind,
  items,
  withColor,
  readOnly,
}: {
  kind: ListKind;
  items: Array<{ id: string; label: string; value: string; color: string | null; isActive: boolean }>;
  withColor?: boolean;
  readOnly: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const addAction = addListItemAction.bind(null, kind);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            disabled={readOnly}
            onClick={() => startTransition(() => toggleListItemAction(item.id, !item.isActive))}
            className={cn("cursor-pointer disabled:cursor-default", pending && "opacity-60")}
            title={readOnly ? undefined : item.isActive ? "Click to deactivate" : "Click to activate"}
          >
            <Badge
              color={item.isActive ? (item.color ?? "#64748B") : null}
              className={cn(!item.isActive && "opacity-50 line-through")}
            >
              {item.label}
            </Badge>
          </button>
        ))}
      </div>

      {!readOnly && (
        <form
          ref={formRef}
          action={(fd) =>
            startTransition(async () => {
              await addAction(fd);
              formRef.current?.reset();
            })
          }
          className="flex items-center gap-2"
        >
          <Input name="label" placeholder="Add item…" className="h-9 w-48" required />
          {withColor && (
            <input
              type="color"
              name="color"
              defaultValue="#4F46E5"
              className="size-9 rounded-xl border border-line cursor-pointer bg-surface p-1"
              title="Stage color"
            />
          )}
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            <Plus size={14} /> Add
          </Button>
        </form>
      )}
    </div>
  );
}
