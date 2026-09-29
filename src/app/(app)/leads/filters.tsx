"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/field";

type Option = { value: string; label: string };

export function LeadFiltersBar({
  statuses,
  sources,
  agents,
  tags,
}: {
  statuses: Option[];
  sources: Option[];
  agents: Option[];
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint z-10" />
        <Input
          className="pl-8 h-9"
          placeholder="Search name, phone, email…"
          defaultValue={sp.get("q") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
          }}
        />
      </div>
      <div className="w-[calc(50%-0.25rem)] sm:w-40">
        <Select className="h-9" value={sp.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
      </div>
      <div className="w-[calc(50%-0.25rem)] sm:w-40">
        <Select className="h-9" value={sp.get("priority") ?? ""} onChange={(e) => setParam("priority", e.target.value)}>
          <option value="">All Priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </Select>
      </div>
      <div className="w-[calc(50%-0.25rem)] sm:w-40">
        <Select className="h-9" value={sp.get("source") ?? ""} onChange={(e) => setParam("source", e.target.value)}>
          <option value="">All Sources</option>
          {sources.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
      </div>
      {agents.length > 0 && (
        <div className="w-[calc(50%-0.25rem)] sm:w-40">
          <Select className="h-9" value={sp.get("agent") ?? ""} onChange={(e) => setParam("agent", e.target.value)}>
            <option value="">All Agents</option>
            {agents.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </Select>
        </div>
      )}
      <div className="w-[calc(50%-0.25rem)] sm:w-36">
        <Select className="h-9" value={sp.get("band") ?? ""} onChange={(e) => setParam("band", e.target.value)}>
          <option value="">Any Score</option>
          <option value="HOT">Hot</option>
          <option value="WARM">Warm</option>
          <option value="COLD">Cold</option>
        </Select>
      </div>
      {tags.length > 0 && (
        <div className="w-[calc(50%-0.25rem)] sm:w-40">
          <Select className="h-9" value={sp.get("tag") ?? ""} onChange={(e) => setParam("tag", e.target.value)}>
            <option value="">All Tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
