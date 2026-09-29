"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/field";

export function AgentFilter({ agents }: { agents: Array<{ value: string; label: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  return (
    <Select
      className="h-9 w-auto"
      value={sp.get("agent") ?? ""}
      onChange={(e) => {
        const params = new URLSearchParams(sp.toString());
        if (e.target.value) params.set("agent", e.target.value);
        else params.delete("agent");
        router.replace(`${pathname}?${params.toString()}`);
      }}
    >
      <option value="">All Agents</option>
      {agents.map((a) => (
        <option key={a.value} value={a.value}>{a.label}</option>
      ))}
    </Select>
  );
}
