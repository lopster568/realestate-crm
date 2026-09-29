import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { requireUser, getOrgContext } from "@/server/session";
import { can } from "@/server/auth/permissions";
import { Card, CardHeader } from "@/components/ui/card";
import { OrgForm, ListManager } from "./settings-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user.role, "settings", "view")) redirect("/dashboard");
  const ctx = await getOrgContext(user.orgId);
  const canManage = can(user.role, "settings", "manage");

  // include inactive items so admins can re-enable them
  const allLists = await prisma.orgList.findMany({
    where: { orgId: user.orgId },
    orderBy: { order: "asc" },
  });
  const byKind = (kind: string) =>
    allLists
      .filter((l) => l.kind === kind)
      .map((l) => ({ id: l.id, label: l.label, value: l.value, color: l.color, isActive: l.isActive }));

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Settings</h1>
        <p className="text-sm text-ink-faint mt-0.5">
          {canManage
            ? "Organization profile and configurable lists"
            : "Read-only view — ask an admin to change these"}
        </p>
      </div>

      <Card>
        <CardHeader title="Organization" subtitle="Currency, locale and timezone apply everywhere" />
        <div className="px-5 pb-5">
          <OrgForm
            org={{
              name: ctx.org.name,
              currency: ctx.org.currency,
              locale: ctx.org.locale,
              timezone: ctx.org.timezone,
            }}
            readOnly={!canManage}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Pipeline stages"
          subtitle="Lead statuses shown on the board — deactivate instead of deleting to keep history intact"
        />
        <div className="px-5 pb-5">
          <ListManager kind="LEAD_STATUS" items={byKind("LEAD_STATUS")} withColor readOnly={!canManage} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Lead sources" />
        <div className="px-5 pb-5">
          <ListManager kind="LEAD_SOURCE" items={byKind("LEAD_SOURCE")} readOnly={!canManage} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Property categories" />
        <div className="px-5 pb-5">
          <ListManager kind="PROPERTY_CATEGORY" items={byKind("PROPERTY_CATEGORY")} readOnly={!canManage} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Shifts" />
        <div className="px-5 pb-5">
          <ListManager kind="SHIFT" items={byKind("SHIFT")} readOnly={!canManage} />
        </div>
      </Card>
    </div>
  );
}
