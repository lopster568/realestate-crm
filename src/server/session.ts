import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import type { Role } from "@/generated/prisma/client";

export type SessionUser = {
  id: string;
  orgId: string;
  role: Role;
  name: string;
  email: string;
};

/**
 * Re-validate the JWT's user against the DB so deactivation, deletion, and role
 * changes take effect immediately instead of at token expiry. Request-cached.
 */
export const resolveSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const dbUser = await prisma.user.findFirst({
    where: { id: session.user.id, isActive: true, deletedAt: null },
    select: { id: true, orgId: true, role: true, name: true, email: true },
  });
  return dbUser;
});

/** Current authenticated + still-active user, or redirect to /login. */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const user = await resolveSessionUser();
  if (!user) redirect("/login");
  return user;
});

/** Org settings (currency/locale/timezone + configurable lists). Request-cached. */
export const getOrgContext = cache(async (orgId: string) => {
  const [org, lists] = await Promise.all([
    prisma.org.findUniqueOrThrow({ where: { id: orgId } }),
    prisma.orgList.findMany({
      where: { orgId, isActive: true },
      orderBy: { order: "asc" },
    }),
  ]);
  return {
    org,
    leadStatuses: lists.filter((l) => l.kind === "LEAD_STATUS"),
    leadSources: lists.filter((l) => l.kind === "LEAD_SOURCE"),
    propertyCategories: lists.filter((l) => l.kind === "PROPERTY_CATEGORY"),
    shifts: lists.filter((l) => l.kind === "SHIFT"),
  };
});

export type OrgContext = Awaited<ReturnType<typeof getOrgContext>>;
