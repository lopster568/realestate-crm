import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { can } from "@/server/auth/permissions";
import { resolveSessionUser } from "@/server/session";
import { leadScope } from "@/server/services/leads";

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Formula-injection defense: neutralize leading =, +, -, @, tab, CR
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const user = await resolveSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(user.role, "report", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
  const to = sp.get("to") ? new Date(sp.get("to")! + "T23:59:59") : undefined;

  const leads = await prisma.lead.findMany({
    where: {
      ...leadScope(user),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    include: { assignedTo: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "Name", "Email", "Phone", "Status", "Priority", "Source",
    "Budget", "Property Type", "Assigned To", "Follow-up Due", "Created",
  ];
  const rows = leads.map((l) =>
    [
      l.name, l.email, l.phone, l.status, l.priority, l.source,
      l.budget === null ? "" : Number(l.budget), l.propertyType,
      l.assignedTo?.name, l.followUpDueAt?.toISOString(), l.createdAt.toISOString(),
    ].map(csvCell).join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
