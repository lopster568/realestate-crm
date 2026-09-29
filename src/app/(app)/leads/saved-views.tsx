"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { createViewAction, deleteViewAction } from "./views-actions";

type View = { id: string; name: string; query: string; shared: boolean; mine: boolean; owner: string };

export function SavedViews({ views }: { views: View[] }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [pending, startTransition] = useTransition();

  // The current filter query, minus view-agnostic keys (view mode, pagination).
  const current = new URLSearchParams(sp.toString());
  current.delete("view");
  current.delete("page");
  const currentQuery = current.toString();
  const activeQuery = currentQuery;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Bookmark size={14} className="text-ink-faint" />
      <Link
        href={pathname}
        className={cn(
          "rounded-full px-3 py-1 text-[13px] font-medium border",
          activeQuery === "" ? "border-primary/40 bg-primary-soft text-primary" : "border-line bg-surface text-ink-soft hover:text-ink"
        )}
      >
        All
      </Link>
      {views.map((v) => (
        <span
          key={v.id}
          className={cn(
            "group inline-flex items-center gap-1 rounded-full border pl-3 pr-1 py-1 text-[13px] font-medium",
            activeQuery === v.query ? "border-primary/40 bg-primary-soft text-primary" : "border-line bg-surface text-ink-soft hover:text-ink"
          )}
        >
          <Link href={`${pathname}?${v.query}`} title={v.shared ? `Shared by ${v.owner}` : undefined}>
            {v.name}
          </Link>
          {v.mine ? (
            <button
              onClick={() => startTransition(() => deleteViewAction(v.id))}
              disabled={pending}
              className="rounded-full p-0.5 text-ink-faint hover:text-accent-rose cursor-pointer opacity-0 group-hover:opacity-100"
              aria-label={`Delete view ${v.name}`}
            >
              <X size={12} />
            </button>
          ) : (
            <span className="w-1" />
          )}
        </span>
      ))}

      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1 text-[13px] text-ink-faint hover:text-ink hover:border-ink-faint cursor-pointer"
      >
        <Plus size={13} /> Save view
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Save current view">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              await createViewAction({ name, query: currentQuery, shared });
              setName("");
              setShared(false);
              setOpen(false);
            });
          }}
          className="space-y-4"
        >
          <p className="text-[13px] text-ink-faint">
            Saves the current filters
            {currentQuery ? (
              <span className="text-ink-soft"> ({currentQuery.replaceAll("&", " · ")})</span>
            ) : (
              " (no filters — this captures the full list)"
            )}
            .
          </p>
          <div>
            <Label htmlFor="view-name">View name</Label>
            <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. My hot leads this week" />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="accent-[#4F46E5]" />
            Share with the whole team
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save view"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
