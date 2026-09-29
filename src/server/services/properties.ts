import { prisma } from "@/server/db";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/session";
import type { Availability, Prisma } from "@/generated/prisma/client";

export type PropertyFilters = {
  category?: string;
  availability?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  q?: string;
};

function where(user: SessionUser, f: PropertyFilters): Prisma.PropertyWhereInput {
  return {
    orgId: user.orgId,
    deletedAt: null,
    ...(f.category ? { category: f.category } : {}),
    ...(f.availability ? { availability: f.availability as Availability } : {}),
    ...(f.minPrice || f.maxPrice
      ? { price: { ...(f.minPrice ? { gte: f.minPrice } : {}), ...(f.maxPrice ? { lte: f.maxPrice } : {}) } }
      : {}),
    ...(f.bedrooms ? { bedrooms: { gte: f.bedrooms } } : {}),
    ...(f.q
      ? {
          OR: [
            { title: { contains: f.q, mode: "insensitive" } },
            { location: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listProperties(user: SessionUser, filters: PropertyFilters = {}) {
  const rows = await prisma.property.findMany({
    where: where(user, filters),
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(serializeProperty);
}

export async function getProperty(user: SessionUser, id: string) {
  const property = await prisma.property.findFirst({
    where: { id, orgId: user.orgId, deletedAt: null },
    include: {
      visits: {
        where: { deletedAt: null },
        include: {
          lead: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { scheduledAt: "desc" },
        take: 20,
      },
    },
  });
  if (!property) return null;
  return {
    ...serializeProperty(property),
    visits: property.visits.map((v) => ({
      ...v,
      scheduledAt: v.scheduledAt.toISOString(),
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      deletedAt: null,
    })),
  };
}

export type PropertyInput = {
  title: string;
  description?: string | null;
  category: string;
  price: number;
  area?: number | null;
  location?: string | null;
  geoLat?: number | null;
  geoLng?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  amenities?: string[];
  availability?: Availability;
  images?: string[];
};

export async function createProperty(user: SessionUser, input: PropertyInput) {
  assertCan(user.role, "property", "create");
  const property = await prisma.property.create({ data: { ...input, orgId: user.orgId } });
  await audit(user, "property.create", "property", property.id, { after: { title: property.title } });
  return serializeProperty(property);
}

export async function updateProperty(user: SessionUser, id: string, input: Partial<PropertyInput>) {
  assertCan(user.role, "property", "update");
  const existing = await prisma.property.findFirst({ where: { id, orgId: user.orgId, deletedAt: null } });
  if (!existing) throw new Error("Property not found");
  const property = await prisma.property.update({ where: { id }, data: input });
  await audit(user, "property.update", "property", id, {
    before: { availability: existing.availability, price: Number(existing.price) },
    after: { availability: property.availability, price: Number(property.price) },
  });
  return serializeProperty(property);
}

export async function deleteProperty(user: SessionUser, id: string) {
  assertCan(user.role, "property", "delete");
  const existing = await prisma.property.findFirst({ where: { id, orgId: user.orgId } });
  if (!existing) throw new Error("Property not found");
  await prisma.property.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(user, "property.delete", "property", id, { before: { title: existing.title } });
}

/** Match inventory to a lead: same category, price within ±25% of budget, available. */
export async function matchPropertiesForLead(
  user: SessionUser,
  lead: { budget: number | null; propertyType: string | null }
) {
  if (!lead.budget && !lead.propertyType) return [];
  const rows = await prisma.property.findMany({
    where: {
      orgId: user.orgId,
      deletedAt: null,
      availability: "AVAILABLE",
      ...(lead.propertyType ? { category: lead.propertyType } : {}),
      ...(lead.budget ? { price: { gte: lead.budget * 0.75, lte: lead.budget * 1.25 } } : {}),
    },
    orderBy: { price: "asc" },
    take: 6,
  });
  return rows.map(serializeProperty);
}

export function serializeProperty<
  T extends { price: Prisma.Decimal; createdAt: Date; updatedAt: Date; deletedAt: Date | null },
>(p: T) {
  return {
    ...p,
    price: Number(p.price),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    deletedAt: null,
  };
}

export type SerializedProperty = Awaited<ReturnType<typeof listProperties>>[number];
