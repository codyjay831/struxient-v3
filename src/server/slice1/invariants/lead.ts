import type { LeadStatus } from "@prisma/client";

export const LEAD_DISPLAY_NAME_MAX = 300;
export const LEAD_SOURCE_MAX = 200;
export const LEAD_SUMMARY_MAX = 8000;
export const LEAD_PHONE_MAX = 64;
export const LEAD_EMAIL_MAX = 320;
export const LEAD_LOST_REASON_MAX = 2000;

/** Statuses that allow editing identity / summary / assignment fields. */
export const LEAD_EDITABLE_STATUSES: ReadonlySet<LeadStatus> = new Set(["OPEN", "ON_HOLD", "NURTURE"]);

/** Statuses that cannot be changed via `setLeadStatusForTenant` (CONVERTED only via convert mutation). */
export const LEAD_STATUS_TERMINAL_FOR_MANUAL_STATUS: ReadonlySet<LeadStatus> = new Set([
  "LOST",
  "ARCHIVED",
  "CONVERTED",
]);

/** CONVERTED is fully immutable in MVP slice. */
export function isLeadContentImmutable(status: LeadStatus): boolean {
  return status === "CONVERTED" || status === "LOST" || status === "ARCHIVED";
}

export function assertLeadStatusTransitionAllowed(params: {
  from: LeadStatus;
  to: LeadStatus;
}): { ok: true } | { ok: false; kind: "invalid_status_transition" | "cannot_set_converted_via_status" } {
  if (params.to === "CONVERTED") {
    return { ok: false, kind: "cannot_set_converted_via_status" };
  }
  if (LEAD_STATUS_TERMINAL_FOR_MANUAL_STATUS.has(params.from) && params.from !== params.to) {
    return { ok: false, kind: "invalid_status_transition" };
  }
  if (params.from === params.to) {
    return { ok: true };
  }
  if (LEAD_EDITABLE_STATUSES.has(params.from) && LEAD_EDITABLE_STATUSES.has(params.to)) {
    return { ok: true };
  }
  if (LEAD_EDITABLE_STATUSES.has(params.from) && (params.to === "LOST" || params.to === "ARCHIVED")) {
    return { ok: true };
  }
  return { ok: false, kind: "invalid_status_transition" };
}
