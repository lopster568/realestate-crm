import { z } from "zod";
import type { LeadInput } from "@/server/services/leads";

// Strict whitelist — API bodies must never reach Prisma unfiltered (mass assignment).
export const leadBodySchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email().nullish(),
    phone: z.string().nullish(),
    status: z.string().optional(),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    source: z.string().nullish(),
    budget: z.number().positive().nullish(),
    propertyType: z.string().nullish(),
    assignedToId: z.string().nullish(),
    followUpDueAt: z.string().datetime({ offset: true }).nullish(),
    lostReason: z.string().nullish(),
    notes: z.string().nullish(),
  })
  .strict();

export const leadPatchSchema = leadBodySchema.partial();

export function toLeadInput(
  body: z.infer<typeof leadPatchSchema>
): Partial<LeadInput> & { lostReason?: string | null } {
  const { followUpDueAt, ...rest } = body;
  return {
    ...rest,
    ...(followUpDueAt !== undefined
      ? { followUpDueAt: followUpDueAt ? new Date(followUpDueAt) : null }
      : {}),
  };
}
