"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

const INK_FAINT = "#94a3b8";
const GRID = "#eef0f5";
const PRIMARY = "#4F46E5";

const axisProps = {
  stroke: "transparent",
  tick: { fill: INK_FAINT, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function TooltipBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-xl shadow-pop border border-line px-3 py-2">
      <p className="text-[11px] text-ink-faint">{label}</p>
      <p className="text-[13px] font-semibold text-ink">{value}</p>
    </div>
  );
}

export function DailyLeadsChart({ data }: { data: Array<{ date: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.18} />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          {...axisProps}
          interval={6}
          tickFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        />
        <YAxis {...axisProps} allowDecimals={false} width={40} />
        <Tooltip
          cursor={{ stroke: INK_FAINT, strokeDasharray: "4 4" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox
                label={new Date(label as string).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                value={`${payload[0].value} lead${payload[0].value === 1 ? "" : "s"}`}
              />
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={PRIMARY}
          strokeWidth={2}
          fill="url(#leadFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PipelineChart({
  data,
}: {
  data: Array<{ label: string; count: number; color: string }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" {...axisProps} width={82} />
        <Tooltip
          cursor={{ fill: "rgba(15,23,42,0.03)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                label={(payload[0].payload as { label: string }).label}
                value={`${payload[0].value} leads`}
              />
            ) : null
          }
        />
        <Bar
          dataKey="count"
          radius={[4, 4, 4, 4]}
          barSize={14}
          label={{ position: "right", fill: "#475569", fontSize: 11, fontWeight: 600 }}
        >
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SourcesChart({ data }: { data: Array<{ label: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" {...axisProps} width={82} />
        <Tooltip
          cursor={{ fill: "rgba(15,23,42,0.03)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                label={(payload[0].payload as { label: string }).label}
                value={`${payload[0].value} leads`}
              />
            ) : null
          }
        />
        <Bar
          dataKey="count"
          fill={PRIMARY}
          radius={[4, 4, 4, 4]}
          barSize={14}
          label={{ position: "right", fill: "#475569", fontSize: 11, fontWeight: 600 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({
  data,
  currency,
  locale,
}: {
  data: Array<{ month: string; revenue: number }>;
  currency: string;
  locale: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="month"
          {...axisProps}
          tickFormatter={(m: string) =>
            new Date(m + "-01").toLocaleDateString(undefined, { month: "short" })
          }
        />
        <YAxis
          {...axisProps}
          width={52}
          tickFormatter={(v: number) => formatCurrency(v, currency, locale, { compact: true })}
        />
        <Tooltip
          cursor={{ fill: "rgba(15,23,42,0.03)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox
                label={new Date((label as string) + "-01").toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
                value={formatCurrency(payload[0].value as number, currency, locale, { compact: true })}
              />
            ) : null
          }
        />
        <Bar dataKey="revenue" fill={PRIMARY} radius={[4, 4, 0, 0]} barSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
