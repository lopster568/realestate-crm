import { redirect } from "next/navigation";
import { requireUser, getOrgContext } from "@/server/session";
import { listTeam, teamPerformance } from "@/server/services/team";
import { can } from "@/server/auth/permissions";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { MemberActions, MemberFormButton } from "./member-form";

export const metadata = { title: "Team" };

const roleColor: Record<string, string> = {
  ADMIN: "#4F46E5",
  MANAGER: "#8B5CF6",
  AGENT: "#14B8A6",
};

export default async function TeamPage() {
  const user = await requireUser();
  if (!can(user.role, "team", "viewAll")) redirect("/dashboard");
  const [ctx, members, perf] = await Promise.all([
    getOrgContext(user.orgId),
    listTeam(user),
    teamPerformance(user),
  ]);
  const { currency, locale } = ctx.org;
  const canManage = can(user.role, "team", "manage");
  const canDelete = can(user.role, "team", "delete");
  const perfById = new Map(perf.map((p) => [p.id, p]));
  const shifts = ctx.shifts.map((s) => ({ value: s.value, label: s.label }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Team Management</h1>
          <p className="text-sm text-ink-faint mt-0.5">
            {members.filter((m) => m.isActive).length} active of {members.length} members
          </p>
        </div>
        {canManage && <MemberFormButton shifts={shifts} />}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-ink-faint border-b border-line">
              <th className="px-5 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Shift</th>
              <th className="px-4 py-3 font-medium">Leads</th>
              <th className="px-4 py-3 font-medium">Converted</th>
              <th className="px-4 py-3 font-medium">Win rate</th>
              <th className="px-4 py-3 font-medium">Visits done</th>
              <th className="px-4 py-3 font-medium">Revenue</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const p = perfById.get(m.id);
              return (
                <tr key={m.id} className="border-b border-line/50 last:border-0 hover:bg-canvas/60">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={m.name} />
                      <span>
                        <span className="block font-medium text-ink">{m.name}</span>
                        <span className="block text-[12px] text-ink-faint">{m.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={roleColor[m.role]}>{m.role.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-soft capitalize">{m.shift ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{p?.assigned ?? 0}</td>
                  <td className="px-4 py-3 text-ink-soft">{p?.converted ?? 0}</td>
                  <td className="px-4 py-3 font-medium text-ink">{p?.winRate ?? 0}%</td>
                  <td className="px-4 py-3 text-ink-soft">{p?.completedVisits ?? 0}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {formatCurrency(p?.revenue ?? 0, currency, locale, { compact: true })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={m.isActive ? "#22C55E" : "#94A3B8"}>
                      {m.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <MemberActions
                        member={m}
                        shifts={shifts}
                        canDelete={canDelete && m.id !== user.id}
                        isSelf={m.id === user.id}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
