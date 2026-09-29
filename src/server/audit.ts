import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/session";
import type { Prisma } from "@/generated/prisma/client";

type Json = Prisma.InputJsonValue | null;

export async function audit(
  user: SessionUser,
  action: string,
  entity: string,
  entityId?: string,
  change?: { before?: Json; after?: Json }
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      orgId: user.orgId,
      actorId: user.id,
      action,
      entity,
      entityId,
      before: change?.before ?? undefined,
      after: change?.after ?? undefined,
    },
  });
}
