import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/session";

/** Referenced users must be active members of the caller's org. */
export async function assertSameOrgUser(user: SessionUser, targetUserId: string): Promise<void> {
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, orgId: user.orgId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!target) throw new Error("Assignee not found");
}

/** Referenced properties must belong to the caller's org. */
export async function assertSameOrgProperty(user: SessionUser, propertyId: string): Promise<void> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId: user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!property) throw new Error("Property not found");
}
