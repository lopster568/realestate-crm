import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/session";
import type { NotificationPayload } from "@/server/notifications";

export async function listNotifications(user: SessionUser) {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { orgId: user.orgId, recipientId: user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.notification.count({
      where: { orgId: user.orgId, recipientId: user.id, read: false },
    }),
  ]);
  return {
    unread,
    rows: rows.map((n) => ({
      id: n.id,
      type: n.type,
      read: n.read,
      payload: n.payload as unknown as NotificationPayload,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function markAllRead(user: SessionUser) {
  await prisma.notification.updateMany({
    where: { orgId: user.orgId, recipientId: user.id, read: false },
    data: { read: true },
  });
}
