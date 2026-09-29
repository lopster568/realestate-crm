import { prisma } from "@/server/db";
import { assertCan } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/session";

export async function listViews(user: SessionUser, resource: string) {
  const rows = await prisma.savedView.findMany({
    where: {
      orgId: user.orgId,
      resource,
      OR: [{ ownerId: user.id }, { shared: true }],
    },
    orderBy: { createdAt: "asc" },
    include: { owner: { select: { name: true } } },
  });
  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    query: v.query,
    shared: v.shared,
    mine: v.ownerId === user.id,
    owner: v.owner.name,
  }));
}

export async function createView(
  user: SessionUser,
  input: { name: string; resource: string; query: string; shared?: boolean }
) {
  // You can save a view of a resource only if you can view it.
  assertCan(user.role, input.resource === "property" ? "property" : "lead", "view");
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  await prisma.savedView.create({
    data: {
      orgId: user.orgId,
      ownerId: user.id,
      name,
      resource: input.resource,
      query: input.query,
      shared: input.shared ?? false,
    },
  });
}

export async function deleteView(user: SessionUser, id: string) {
  assertCan(user.role, "lead", "view");
  const view = await prisma.savedView.findFirst({ where: { id, orgId: user.orgId } });
  if (!view) throw new Error("View not found");
  // Only the owner may delete their view.
  if (view.ownerId !== user.id) throw new Error("You can only delete your own views");
  await prisma.savedView.delete({ where: { id } });
}
