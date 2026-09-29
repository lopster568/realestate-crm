"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/field";

export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5 text-[13px] text-ink-faint">
      <Input
        type="date"
        className="h-9 w-auto"
        defaultValue={sp.get("from") ?? ""}
        onChange={(e) => setParam("from", e.target.value)}
        aria-label="From date"
      />
      <span>–</span>
      <Input
        type="date"
        className="h-9 w-auto"
        defaultValue={sp.get("to") ?? ""}
        onChange={(e) => setParam("to", e.target.value)}
        aria-label="To date"
      />
    </div>
  );
}
