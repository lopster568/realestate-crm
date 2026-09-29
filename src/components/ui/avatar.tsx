import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const hues = ["#4F46E5", "#8B5CF6", "#14B8A6", "#F59E0B", "#0EA5E9", "#F43F5E"];

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hue = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length];
  const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-12 text-base" };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0",
        sizes[size],
        className
      )}
      style={{ backgroundColor: hue }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
