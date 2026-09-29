import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-surface rounded-card shadow-card border border-line/60", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between px-5 pt-5 pb-3">
      <div>
        <h3 className="font-display font-semibold text-[15px] text-ink">{title}</h3>
        {subtitle && <p className="text-[13px] text-ink-faint mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
