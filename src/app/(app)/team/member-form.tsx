"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
  createMemberAction,
  deleteMemberAction,
  toggleMemberActiveAction,
  updateMemberAction,
  type MemberFormState,
} from "./actions";

type Option = { value: string; label: string };

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  shift: string | null;
  isActive: boolean;
  targets: Record<string, number> | null;
};

export function MemberFormButton({
  shifts,
  member,
  trigger,
  onDone,
}: {
  shifts: Option[];
  member?: Member;
  trigger?: React.ReactNode;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const action = member ? updateMemberAction.bind(null, member.id) : createMemberAction;
  const [state, formAction, pending] = useActionState<MemberFormState, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (!result) {
        setOpen(false);
        onDone?.();
      }
      return result;
    },
    undefined
  );

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus size={15} /> Add Team Member
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={member ? `Edit ${member.name}` : "Add Team Member"}
        wide
      >
        <form action={formAction} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name *">
              <Input name="name" required defaultValue={member?.name} />
            </Field>
            <Field label="Work email *">
              <Input name="email" type="email" required defaultValue={member?.email} />
            </Field>
            <Field label="Phone">
              <Input name="phone" defaultValue={member?.phone ?? ""} />
            </Field>
            <Field label="Role *">
              <Select name="role" required defaultValue={member?.role ?? "AGENT"}>
                <option value="AGENT">Sales Executive</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </Field>
            <Field label="Shift">
              <Select name="shift" defaultValue={member?.shift ?? ""}>
                <option value="">—</option>
                {shifts.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label={member ? "Reset password (leave blank to keep)" : "Initial password *"}>
              <Input name="password" type="password" placeholder="Min 6 characters" />
            </Field>
            <Field label="Target · conversions / month">
              <Input
                name="monthlyConversions"
                type="number"
                min="0"
                defaultValue={member?.targets?.monthlyConversions ?? ""}
              />
            </Field>
            <Field label="Target · revenue / month">
              <Input
                name="monthlyRevenue"
                type="number"
                min="0"
                defaultValue={member?.targets?.monthlyRevenue ?? ""}
              />
            </Field>
          </div>

          {state?.error && (
            <p className="text-sm text-accent-rose bg-accent-rose/10 rounded-xl px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : member ? "Save changes" : "Add member"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function MemberActions({
  member,
  shifts,
  canDelete,
  isSelf,
}: {
  member: Member;
  shifts: Option[];
  canDelete: boolean;
  isSelf: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex items-center gap-1">
      <MemberFormButton
        shifts={shifts}
        member={member}
        trigger={
          <button className="p-1.5 rounded-full text-ink-faint hover:bg-canvas hover:text-ink cursor-pointer" title="Edit">
            <Pencil size={14} />
          </button>
        }
      />
      {!isSelf && (
        <button
          onClick={() => startTransition(() => toggleMemberActiveAction(member.id, !member.isActive))}
          disabled={pending}
          className="p-1.5 rounded-full text-ink-faint hover:bg-canvas hover:text-ink cursor-pointer"
          title={member.isActive ? "Deactivate" : "Activate"}
        >
          <Power size={14} className={member.isActive ? "" : "text-accent-green"} />
        </button>
      )}
      {canDelete && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-1.5 rounded-full text-ink-faint hover:bg-canvas hover:text-accent-rose cursor-pointer"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      )}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Remove team member?">
        <p className="text-sm text-ink-soft">
          <span className="font-medium text-ink">{member.name}</span> will be deactivated and removed
          from lists (soft delete). Their leads stay assigned until you reassign them.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteMemberAction(member.id);
                setConfirmDelete(false);
              })
            }
          >
            Remove
          </Button>
        </div>
      </Modal>
    </span>
  );
}
