import type { NextRequest } from "next/server";
import { z } from "zod";
import { createProperty, listProperties } from "@/server/services/properties";
import { withUser } from "../util";

// Strict whitelist — API bodies must never reach Prisma unfiltered.
const propertyBodySchema = z
  .object({
    title: z.string().min(1),
    description: z.string().nullish(),
    category: z.string().min(1),
    price: z.number().positive(),
    area: z.number().positive().nullish(),
    location: z.string().nullish(),
    geoLat: z.number().nullish(),
    geoLng: z.number().nullish(),
    bedrooms: z.number().int().min(0).nullish(),
    bathrooms: z.number().int().min(0).nullish(),
    amenities: z.array(z.string()).optional(),
    availability: z.enum(["AVAILABLE", "UNDER_CONSTRUCTION", "SOLD", "RESERVED"]).optional(),
    images: z.array(z.string()).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  return withUser((user) =>
    listProperties(user, {
      category: sp.get("category") ?? undefined,
      availability: sp.get("availability") ?? undefined,
      minPrice: sp.get("minPrice") ? Number(sp.get("minPrice")) : undefined,
      maxPrice: sp.get("maxPrice") ? Number(sp.get("maxPrice")) : undefined,
      bedrooms: sp.get("bedrooms") ? Number(sp.get("bedrooms")) : undefined,
      q: sp.get("q") ?? undefined,
    })
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return withUser((user) => {
    const parsed = propertyBodySchema.safeParse(body);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    return createProperty(user, parsed.data);
  });
}
