"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CheckSquare,
  Filter,
  Home,
  LayoutDashboard,
  LineChart,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/cn";

const icons = {
  dashboard: LayoutDashboard,
  leads: UsersRound,
  funnel: Filter,
  properties: Home,
  visits: CalendarDays,
  tasks: CheckSquare,
  team: Users,
  reports: LineChart,
  settings: Settings,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof icons };

export function Sidebar({ items, orgName }: { items: NavItem[]; orgName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2.5 px-5 h-16">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
          <Building2 size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-display font-bold text-[15px] leading-tight text-ink">EstateCRM</p>
          <p className="text-[11px] text-ink-faint truncate">{orgName}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-ink-soft hover:bg-canvas hover:text-ink"
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-[11px] text-ink-faint border-t border-line">
        EstateCRM v0.1 · P2 prototype
      </div>
    </aside>
  );
}
