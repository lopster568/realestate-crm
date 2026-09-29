import type { Role } from "@/generated/prisma/client";

export type Resource =
  | "dashboard"
  | "lead"
  | "property"
  | "visit"
  | "team"
  | "task"
  | "report"
  | "settings";

export type Action = "view" | "viewAll" | "create" | "update" | "delete" | "assign" | "manage";

// Permission matrix (resource × action × role). Config, not code — tune here without
// touching call sites. "viewAll" = across the whole team; plain "view" = own records.
const MATRIX: Record<Role, Partial<Record<Resource, Action[]>>> = {
  ADMIN: {
    dashboard: ["view", "viewAll"],
    lead: ["view", "viewAll", "create", "update", "delete", "assign"],
    property: ["view", "viewAll", "create", "update", "delete"],
    visit: ["view", "viewAll", "create", "update", "delete"],
    team: ["view", "viewAll", "create", "update", "delete", "manage"],
    task: ["view", "viewAll", "create", "update", "delete"],
    report: ["view", "viewAll"],
    settings: ["view", "manage"],
  },
  MANAGER: {
    dashboard: ["view", "viewAll"],
    lead: ["view", "viewAll", "create", "update", "delete", "assign"],
    property: ["view", "viewAll", "create", "update"],
    visit: ["view", "viewAll", "create", "update", "delete"],
    team: ["view", "viewAll"],
    task: ["view", "viewAll", "create", "update"],
    report: ["view", "viewAll"],
    settings: ["view"],
  },
  AGENT: {
    dashboard: ["view"],
    lead: ["view", "create", "update"],
    property: ["view", "viewAll", "create", "update"],
    visit: ["view", "create", "update"],
    task: ["view", "create", "update"],
  },
};

export function can(role: Role, resource: Resource, action: Action): boolean {
  return MATRIX[role]?.[resource]?.includes(action) ?? false;
}

/** Throws if the role lacks the permission — use at the top of every service mutation. */
export function assertCan(role: Role, resource: Resource, action: Action): void {
  if (!can(role, resource, action)) {
    throw new Error(`Forbidden: ${role} cannot ${action} ${resource}`);
  }
}
