"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { markNotificationsReadAction, signOutAction } from "@/app/(app)/actions";

type Notifications = {
  unread: number;
  rows: Array<{
    id: string;
    read: boolean;
    payload: { title: string; body: string; href?: string };
    createdAt: string;
  }>;
};

export function Topbar({
  user,
  notifications,
}: {
  user: { name: string; role: string };
  notifications: Notifications;
}) {
  const [open, setOpen] = useState<"bell" | "user" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="h-16 border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-40">
      <div className="flex h-full items-center justify-end gap-2 px-6" ref={ref}>
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              const next = open === "bell" ? null : "bell";
              setOpen(next);
              if (next === "bell" && notifications.unread > 0) {
                markNotificationsReadAction();
              }
            }}
            className="relative flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-canvas cursor-pointer"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {notifications.unread > 0 && (
              <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-accent-rose text-white text-[10px] font-semibold">
                {notifications.unread > 9 ? "9+" : notifications.unread}
              </span>
            )}
          </button>
          {open === "bell" && (
            <div className="absolute right-0 mt-2 w-80 bg-surface rounded-card shadow-pop border border-line/60 overflow-hidden">
              <p className="px-4 py-3 text-sm font-display font-semibold border-b border-line">
                Notifications
              </p>
              <div className="max-h-96 overflow-y-auto">
                {notifications.rows.length === 0 && (
                  <p className="px-4 py-8 text-sm text-ink-faint text-center">All caught up!</p>
                )}
                {notifications.rows.map((n) => (
                  <Link
                    key={n.id}
                    href={n.payload.href ?? "#"}
                    onClick={() => setOpen(null)}
                    className={cn(
                      "block px-4 py-3 hover:bg-canvas border-b border-line/50 last:border-0",
                      !n.read && "bg-primary-soft/40"
                    )}
                  >
                    <p className="text-[13px] font-medium text-ink">{n.payload.title}</p>
                    <p className="text-[13px] text-ink-soft mt-0.5">{n.payload.body}</p>
                    <p className="text-[11px] text-ink-faint mt-1">{timeAgo(n.createdAt)}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setOpen(open === "user" ? null : "user")}
            className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-canvas cursor-pointer"
          >
            <Avatar name={user.name} />
            <span className="text-left hidden sm:block">
              <span className="block text-[13px] font-medium text-ink leading-tight">
                {user.name}
              </span>
              <span className="block text-[11px] text-ink-faint capitalize">
                {user.role.toLowerCase()}
              </span>
            </span>
          </button>
          {open === "user" && (
            <div className="absolute right-0 mt-2 w-44 bg-surface rounded-card shadow-pop border border-line/60 overflow-hidden py-1">
              <button
                onClick={() => signOutAction()}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink-soft hover:bg-canvas hover:text-ink cursor-pointer"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
