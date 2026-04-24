import type { LeadStatus } from "@prisma/client";
import { assertLeadStatusTransitionAllowed } from "@/server/slice1/invariants/lead";

/** Status values the office UI may offer for a manual POST to `/api/leads/.../status` (excludes CONVERTED). */
/** Convert API is OPEN-only; office UI should match. */
export function officeLeadConvertAllowed(status: LeadStatus, canMutate: boolean): boolean {
  return canMutate && status === "OPEN";
}

export function manualLeadStatusTargets(from: LeadStatus): LeadStatus[] {
  if (from === "CONVERTED") return [];
  if (from === "LOST" || from === "ARCHIVED") return [];
  const candidates: LeadStatus[] = ["OPEN", "ON_HOLD", "NURTURE", "LOST", "ARCHIVED"];
  return candidates.filter((to) => {
    if (to === from) return false;
    return assertLeadStatusTransitionAllowed({ from, to }).ok;
  });
}
