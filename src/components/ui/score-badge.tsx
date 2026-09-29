import { Flame, Snowflake, ThermometerSun } from "lucide-react";
import { cn } from "@/lib/cn";

const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  HOT: { label: "Hot", className: "bg-accent-rose/10 text-accent-rose", icon: <Flame size={11} /> },
  WARM: { label: "Warm", className: "bg-accent-amber/10 text-accent-amber", icon: <ThermometerSun size={11} /> },
  COLD: { label: "Cold", className: "bg-accent-sky/10 text-accent-sky", icon: <Snowflake size={11} /> },
};

export function ScoreBadge({ band, score }: { band: string | null; score?: number | null }) {
  if (!band || !config[band]) return null;
  const c = config[band];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        c.className
      )}
      title={score != null ? `Score ${score}/100` : undefined}
    >
      {c.icon}
      {c.label}
      {score != null && <span className="opacity-70">{score}</span>}
    </span>
  );
}
