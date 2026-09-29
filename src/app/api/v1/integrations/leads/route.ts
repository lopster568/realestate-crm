import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { ingestLeads } from "@/server/services/ingest";

const ingestSchema = z.object({
  leads: z
    .array(
      z
        .object({
          dedupeKey: z.string().optional(),
          name: z.string().min(1),
          email: z.string().email().nullish(),
          phone: z.string().nullish(),
          source: z.string().nullish(),
          budget: z.number().positive().nullish(),
          propertyType: z.string().nullish(),
          notes: z.string().nullish(),
          externalSource: z.string().nullish(),
          tags: z.array(z.string()).optional(),
        })
        .strict()
    )
    .min(1)
    .max(500),
});

/**
 * Portal / website lead ingestion. Authenticated by a per-org API key
 * (X-API-Key: <org.ingestKey>). No session — this is a machine endpoint.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing X-API-Key" }, { status: 401 });
  }
  const org = await prisma.org.findUnique({ where: { ingestKey: apiKey }, select: { id: true } });
  if (!org) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const result = await ingestLeads(org.id, parsed.data.leads);
  return NextResponse.json({ ok: true, ...result });
}
