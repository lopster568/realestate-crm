import { prisma } from "@/server/db";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/session";
import type { ListKind } from "@/generated/prisma/client";

export async function updateOrg(
  user: SessionUser,
  input: { name?: string; currency?: string; locale?: string; timezone?: string }
) {
  assertCan(user.role, "settings", "manage");
  await prisma.org.update({ where: { id: user.orgId }, data: input });
  await audit(user, "org.update", "org", user.orgId, { after: input });
}

export async function addListItem(
  user: SessionUser,
  input: { kind: ListKind; value: string; label: string; color?: string | null }
) {
  assertCan(user.role, "settings", "manage");
  const max = await prisma.orgList.aggregate({
    where: { orgId: user.orgId, kind: input.kind },
    _max: { order: true },
  });
  await prisma.orgList.create({
    data: { ...input, orgId: user.orgId, order: (max._max.order ?? 0) + 1 },
  });
  await audit(user, "settings.list_add", "orgList", undefined, { after: { ...input } });
}

export async function updateListItem(
  user: SessionUser,
  id: string,
  input: { label?: string; color?: string | null; isActive?: boolean; order?: number }
) {
  assertCan(user.role, "settings", "manage");
  const item = await prisma.orgList.findFirst({ where: { id, orgId: user.orgId } });
  if (!item) throw new Error("List item not found");
  await prisma.orgList.update({ where: { id }, data: input });
  await audit(user, "settings.list_update", "orgList", id);
}
