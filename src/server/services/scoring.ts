import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/server/db";
import { assertCan, can } from "@/server/auth/permissions";
import { leadScope } from "@/server/services/leads";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/server/session";

// Claude-powered lead scoring. Model per the claude-api skill default (Opus 4.8).
const MODEL = "claude-opus-4-8";
const BATCH = 20;

const SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          score: { type: "integer" },
          band: { type: "string", enum: ["HOT", "WARM", "COLD"] },
          intent: { type: "string", enum: ["buyer", "investor", "renter", "unknown"] },
          nextAction: { type: "string" },
          reason: { type: "string" },
        },
        required: ["id", "score", "band", "intent", "nextAction", "reason"],
      },
    },
  },
  required: ["scores"],
} as const;

type ScoreRow = {
  id: string;
  score: number;
  band: string;
  intent: string;
  nextAction: string;
  reason: string;
};

export class ScoringUnavailableError extends Error {}

/**
 * Score the leads currently in the caller's filtered scope. Returns the number
 * scored. Throws ScoringUnavailableError if ANTHROPIC_API_KEY isn't configured.
 */
export async function scoreLeads(
  user: SessionUser,
  filters: { status?: string; assignedToId?: string } = {}
): Promise<{ scored: number; failed: number }> {
  assertCan(user.role, "lead", "update");
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ScoringUnavailableError("AI scoring is not configured (ANTHROPIC_API_KEY missing).");
  }

  // Build the scope carefully: leadScope (which pins agents to their own leads)
  // must win, the converted/lost exclusion is unconditional, and the agent filter
  // only applies for roles allowed to view all leads — mirrors listLeads.
  const where: Prisma.LeadWhereInput = { ...leadScope(user) };
  where.status =
    filters.status && !["converted", "lost"].includes(filters.status)
      ? filters.status
      : { notIn: ["converted", "lost"] };
  if (filters.assignedToId && can(user.role, "lead", "viewAll")) {
    where.assignedToId = filters.assignedToId;
  }

  const leads = await prisma.lead.findMany({
    where,
    select: {
      id: true, name: true, budget: true, source: true, propertyType: true,
      status: true, priority: true, notes: true, createdAt: true,
      _count: { select: { activities: true, visits: true } },
    },
    take: 100,
  });
  if (leads.length === 0) return { scored: 0, failed: 0 };

  const client = new Anthropic();
  let scored = 0;
  let failed = 0;

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);
    const payload = batch.map((l) => ({
      id: l.id,
      name: l.name,
      budget: l.budget === null ? null : Number(l.budget),
      source: l.source,
      propertyType: l.propertyType,
      status: l.status,
      priority: l.priority,
      notes: l.notes?.slice(0, 500) ?? null,
      daysOld: Math.floor((Date.now() - l.createdAt.getTime()) / 86400000),
      touchpoints: l._count.activities,
      visits: l._count.visits,
    }));

    let response;
    try {
      response = await client.messages.create({
        // ~600 output tokens/lead of headroom so a full batch can't truncate.
        model: MODEL,
        max_tokens: 12000,
        output_config: { effort: "low", format: { type: "json_schema", schema: SCORE_SCHEMA } },
        system:
          "You are a real-estate sales analyst. Score each lead 0-100 on likelihood to convert soon, " +
          "using budget fit, engagement (touchpoints/visits), recency, priority, and source quality. " +
          "Band: HOT (>=70), WARM (40-69), COLD (<40). Infer intent from notes/budget/property type. " +
          "nextAction: one short imperative step (<=8 words). reason: one concise sentence. " +
          "Return a score object for every lead id provided.",
        messages: [{ role: "user", content: JSON.stringify(payload) }],
      });
    } catch {
      failed += batch.length;
      continue;
    }

    // Truncated / refused / unparseable → count the whole batch as failed so the
    // caller can report it, rather than silently claiming success.
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      failed += batch.length;
      continue;
    }
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      failed += batch.length;
      continue;
    }
    let parsed: { scores: ScoreRow[] };
    try {
      parsed = JSON.parse(text.text);
    } catch {
      failed += batch.length;
      continue;
    }

    const validIds = new Set(batch.map((b) => b.id));
    const now = new Date();
    await prisma.$transaction(
      parsed.scores
        .filter((s) => validIds.has(s.id))
        .map((s) =>
          prisma.lead.update({
            where: { id: s.id },
            data: {
              score: Math.max(0, Math.min(100, s.score)),
              scoreBand: s.band,
              intent: s.intent,
              nextAction: s.nextAction.slice(0, 120),
              scoreReason: s.reason.slice(0, 300),
              scoredAt: now,
            },
          })
        )
    );
    const matched = parsed.scores.filter((s) => validIds.has(s.id)).length;
    scored += matched;
    failed += batch.length - matched;
  }

  return { scored, failed };
}
