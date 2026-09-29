import { prisma } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

export type NotificationPayload = {
  title: string;
  body: string;
  href?: string;
  // Extra keys (e.g. leadId) are persisted in the JSON column for dedupe/linking.
  [key: string]: unknown;
};

export interface NotificationProvider {
  channel: string;
  send(orgId: string, recipientId: string, type: string, payload: NotificationPayload): Promise<void>;
}

// v1 provider: in-app (DB-backed, surfaced in the topbar bell).
// Email / WhatsApp / SMS become additional providers behind this same interface,
// selected per-Org from Settings.
const inAppProvider: NotificationProvider = {
  channel: "in_app",
  async send(orgId, recipientId, type, payload) {
    await prisma.notification.create({
      data: { orgId, recipientId, type, channel: "in_app", payload: payload as Prisma.InputJsonValue },
    });
  },
};

const providers: NotificationProvider[] = [inAppProvider];

export async function notify(
  orgId: string,
  recipientId: string,
  type: string,
  payload: NotificationPayload
): Promise<void> {
  await Promise.all(providers.map((p) => p.send(orgId, recipientId, type, payload)));
}
