"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/field";

type Option = { value: string; label: string };

export function PropertyFiltersBar({ categories }: { categories: Option[] }) {
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
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint z-10" />
        <Input
          className="pl-8 h-9"
          placeholder="Search title or location…"
          defaultValue={sp.get("q") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
          }}
        />
      </div>
      <div className="w-[calc(50%-0.25rem)] sm:w-44">
        <Select className="h-9" value={sp.get("category") ?? ""} onChange={(e) => setParam("category", e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
      </div>
      <div className="w-[calc(50%-0.25rem)] sm:w-48">
        <Select className="h-9" value={sp.get("availability") ?? ""} onChange={(e) => setParam("availability", e.target.value)}>
          <option value="">Any Availability</option>
          <option value="AVAILABLE">Available</option>
          <option value="UNDER_CONSTRUCTION">Under Construction</option>
          <option value="RESERVED">Reserved</option>
          <option value="SOLD">Sold</option>
        </Select>
      </div>
      <div className="w-[calc(50%-0.25rem)] sm:w-32">
        <Select className="h-9" value={sp.get("beds") ?? ""} onChange={(e) => setParam("beds", e.target.value)}>
          <option value="">Any Beds</option>
          <option value="1">1+</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
        </Select>
      </div>
      <div className="w-[calc(50%-0.25rem)] sm:w-32">
        <Input
          className="h-9"
          type="number"
          placeholder="Min price"
          defaultValue={sp.get("minPrice") ?? ""}
          onBlur={(e) => setParam("minPrice", e.target.value)}
        />
      </div>
      <div className="w-[calc(50%-0.25rem)] sm:w-32">
        <Input
          className="h-9"
          type="number"
          placeholder="Max price"
          defaultValue={sp.get("maxPrice") ?? ""}
          onBlur={(e) => setParam("maxPrice", e.target.value)}
        />
      </div>
    </div>
  );
}
