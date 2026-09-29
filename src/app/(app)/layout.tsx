import { requireUser, getOrgContext } from "@/server/session";
import { can, type Resource } from "@/server/auth/permissions";
import { listNotifications } from "@/server/services/notifications";
import { Sidebar, type NavItem } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

const NAV: Array<NavItem & { resource: Resource }> = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", resource: "dashboard" },
  { href: "/leads", label: "Leads", icon: "leads", resource: "lead" },
  { href: "/funnel", label: "Funnel", icon: "funnel", resource: "report" },
  { href: "/properties", label: "Properties", icon: "properties", resource: "property" },
  { href: "/site-visits", label: "Site Visits", icon: "visits", resource: "visit" },
  { href: "/tasks", label: "Tasks", icon: "tasks", resource: "task" },
  { href: "/team", label: "Team", icon: "team", resource: "team" },
  { href: "/reports", label: "Reports", icon: "reports", resource: "report" },
  { href: "/settings", label: "Settings", icon: "settings", resource: "settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [{ org }, notifications] = await Promise.all([
    getOrgContext(user.orgId),
    listNotifications(user),
  ]);

  const items = NAV.filter((n) => can(user.role, n.resource, "view")).map(
    ({ href, label, icon }) => ({ href, label, icon })
  );

  return (
    <div className="flex min-h-dvh">
      <Sidebar items={items} orgName={org.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={{ name: user.name, role: user.role }} notifications={notifications} />
        <main className="flex-1 px-6 py-6 lg:px-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
