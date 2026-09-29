import { cn } from "@/lib/cn";

/** Colored pill. Pass a hex `color` (from OrgList config) or rely on className. */
export function Badge({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        !color && "bg-canvas text-ink-soft",
        className
      )}
      style={color ? { backgroundColor: `${color}1A`, color } : undefined}
    >
      {children}
    </span>
  );
}

const priorityStyles: Record<string, string> = {
  HIGH: "bg-accent-rose/10 text-accent-rose",
  MEDIUM: "bg-accent-amber/10 text-accent-amber",
  LOW: "bg-accent-sky/10 text-accent-sky",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        priorityStyles[priority] ?? "bg-canvas text-ink-soft"
      )}
    >
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}
