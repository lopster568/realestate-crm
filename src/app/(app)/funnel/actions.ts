"use server";

import { requireUser } from "@/server/session";
import { can } from "@/server/auth/permissions";
import { runAutomationTick } from "@/server/services/automation";

/**
 * Manually fire one automation tick for the caller's org (manual or loop-driven).
 * The client calls router.refresh() after this resolves, so there's no
 * revalidatePath here — that would refetch the route a second time.
 */
export async function runAutomationNowAction(
  trigger: "manual" | "loop"
): Promise<{ followupReminders: number; staleFlagged: number; autoAssigned: number } | { error: string }> {
  const user = await requireUser();
  // Org-wide automation is a manager/admin control.
  if (!can(user.role, "dashboard", "viewAll")) return { error: "Not authorized" };
  return runAutomationTick({ orgId: user.orgId, trigger });
}
