import type { RuntimeTaskExecutionSummary } from "../reads/derive-runtime-execution-summary";

/** Bump when eligibility rules or reason codes change (epic 30). */
export const TASK_ACTIONABILITY_SCHEMA_VERSION = 1 as const;

/** Blocking reasons for **starting** work (UI + read APIs; MVP excludes holds/payment/scheduling). */
export type TaskStartBlockReason =
  | "FLOW_NOT_ACTIVATED"
  | "TASK_ALREADY_COMPLETED"
  | "TASK_ALREADY_STARTED";

/** Blocking reasons for **completing** work. */
export type TaskCompleteBlockReason =
  | "FLOW_NOT_ACTIVATED"
  | "TASK_NOT_STARTED"
  | "TASK_ALREADY_COMPLETED";

export type TaskStartEligibility = {
  schemaVersion: typeof TASK_ACTIONABILITY_SCHEMA_VERSION;
  canStart: boolean;
  reasons: TaskStartBlockReason[];
};

export type TaskCompleteEligibility = {
  schemaVersion: typeof TASK_ACTIONABILITY_SCHEMA_VERSION;
  canComplete: boolean;
  reasons: TaskCompleteBlockReason[];
};

export type TaskActionability = {
  start: TaskStartEligibility;
  complete: TaskCompleteEligibility;
};

/** JSON shape for `GET /api/flows/[flowId]` (and future work feeds). */
export type TaskActionabilityApiDto = {
  start: TaskStartEligibility;
  complete: TaskCompleteEligibility;
};

export function toTaskActionabilityApiDto(a: TaskActionability): TaskActionabilityApiDto {
  return {
    start: { ...a.start, reasons: [...a.start.reasons] },
    complete: { ...a.complete, reasons: [...a.complete.reasons] },
  };
}

function startEligibility(
  hasActivation: boolean,
  execution: RuntimeTaskExecutionSummary,
): TaskStartEligibility {
  const reasons: TaskStartBlockReason[] = [];
  if (!hasActivation) {
    reasons.push("FLOW_NOT_ACTIVATED");
  }
  if (execution.status === "completed") {
    reasons.push("TASK_ALREADY_COMPLETED");
  }
  if (execution.status === "in_progress") {
    reasons.push("TASK_ALREADY_STARTED");
  }
  return {
    schemaVersion: TASK_ACTIONABILITY_SCHEMA_VERSION,
    canStart: reasons.length === 0,
    reasons,
  };
}

function completeEligibility(
  hasActivation: boolean,
  execution: RuntimeTaskExecutionSummary,
): TaskCompleteEligibility {
  const reasons: TaskCompleteBlockReason[] = [];
  if (!hasActivation) {
    reasons.push("FLOW_NOT_ACTIVATED");
  }
  if (execution.status === "not_started") {
    reasons.push("TASK_NOT_STARTED");
  }
  if (execution.status === "completed") {
    reasons.push("TASK_ALREADY_COMPLETED");
  }
  return {
    schemaVersion: TASK_ACTIONABILITY_SCHEMA_VERSION,
    canComplete: reasons.length === 0,
    reasons,
  };
}

/**
 * Central MVP actionability for manifest runtime tasks (`epic 30` shell).
 * Scheduling, holds, payment gates, and node ordering are out of scope until modeled.
 */
export function evaluateRuntimeTaskActionability(
  hasActivation: boolean,
  execution: RuntimeTaskExecutionSummary,
): TaskActionability {
  return {
    start: startEligibility(hasActivation, execution),
    complete: completeEligibility(hasActivation, execution),
  };
}

/** Same rules for workflow skeleton tasks keyed by template id on the snapshot. */
export function evaluateSkeletonTaskActionability(
  hasActivation: boolean,
  execution: RuntimeTaskExecutionSummary,
): TaskActionability {
  return {
    start: startEligibility(hasActivation, execution),
    complete: completeEligibility(hasActivation, execution),
  };
}
