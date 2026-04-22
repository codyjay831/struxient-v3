import type { RuntimeTaskExecutionSummary } from "../reads/derive-runtime-execution-summary";

/** Bump when eligibility rules, reason codes, or start `blockerDetails` shape changes (Epic 30 / 48). */
export const TASK_ACTIONABILITY_SCHEMA_VERSION = 3 as const;

/** Blocking reasons for **starting** work (UI + read APIs). */
export type TaskStartBlockReason =
  | "FLOW_NOT_ACTIVATED"
  | "TASK_ALREADY_COMPLETED"
  | "TASK_ALREADY_ACCEPTED"
  | "TASK_ALREADY_STARTED"
  | "PAYMENT_GATE_UNSATISFIED"
  | "HOLD_ACTIVE";

/** Blocking reasons for **completing** work. */
export type TaskCompleteBlockReason =
  | "FLOW_NOT_ACTIVATED"
  | "TASK_NOT_STARTED"
  | "TASK_ALREADY_COMPLETED"
  | "TASK_ALREADY_ACCEPTED";

/**
 * Read-model bridge (Epic 48): structured blockers when start is blocked by payment gates and/or
 * operational holds. **No duplicated DB truth** — ids/titles come from the same rows as the booleans.
 */
export type TaskStartPaymentGateBlocker = {
  kind: "payment_gate";
  gateId: string;
  title: string;
};

export type TaskStartOperationalHoldBlocker = {
  kind: "operational_hold";
  holdId: string;
  scope: "JOB" | "RUNTIME_TASK";
  reason: string;
};

export type TaskStartBlockerDetail = TaskStartPaymentGateBlocker | TaskStartOperationalHoldBlocker;

/** Payment gate row shape for optional bridge context (matches flow/job-shell read models). */
export type PaymentGateForActionabilityBridge = {
  id: string;
  status: "UNSATISFIED" | "SATISFIED";
  title: string;
  targets: { taskId: string; taskKind: "RUNTIME" | "SKELETON" }[];
};

/** Active hold row shape for optional bridge context. */
export type ActiveHoldForActionabilityBridge = {
  id: string;
  runtimeTaskId: string | null;
  reason: string;
};

export type RuntimeTaskActionabilityBridgeContext = {
  runtimeTaskId: string;
  paymentGates: PaymentGateForActionabilityBridge[];
  activeHolds: ActiveHoldForActionabilityBridge[];
};

export type SkeletonTaskActionabilityBridgeContext = {
  skeletonTaskId: string;
  paymentGates: PaymentGateForActionabilityBridge[];
  activeHolds: ActiveHoldForActionabilityBridge[];
};

export type TaskStartEligibility = {
  schemaVersion: typeof TASK_ACTIONABILITY_SCHEMA_VERSION;
  canStart: boolean;
  reasons: TaskStartBlockReason[];
  /** Non-empty only when optional bridge context was supplied at evaluation time. */
  blockerDetails: TaskStartBlockerDetail[];
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

/** JSON shape for `GET /api/flows/[flowId]` (and work feeds). */
export type TaskActionabilityApiDto = {
  start: TaskStartEligibility;
  complete: TaskCompleteEligibility;
};

export function toTaskActionabilityApiDto(a: TaskActionability): TaskActionabilityApiDto {
  return {
    start: {
      ...a.start,
      reasons: [...a.start.reasons],
      blockerDetails: a.start.blockerDetails.map((d) => ({ ...d })),
    },
    complete: { ...a.complete, reasons: [...a.complete.reasons] },
  };
}

function computeStartReasons(
  hasActivation: boolean,
  execution: RuntimeTaskExecutionSummary,
  hasUnsatisfiedPaymentGate: boolean,
  hasActiveOperationalHold: boolean,
): TaskStartBlockReason[] {
  const reasons: TaskStartBlockReason[] = [];
  if (!hasActivation) {
    reasons.push("FLOW_NOT_ACTIVATED");
  }
  if (execution.status === "accepted") {
    reasons.push("TASK_ALREADY_ACCEPTED");
  }
  if (execution.status === "completed") {
    reasons.push("TASK_ALREADY_COMPLETED");
  }
  if (execution.status === "in_progress") {
    reasons.push("TASK_ALREADY_STARTED");
  }
  if (hasUnsatisfiedPaymentGate) {
    reasons.push("PAYMENT_GATE_UNSATISFIED");
  }
  if (hasActiveOperationalHold) {
    reasons.push("HOLD_ACTIVE");
  }
  return reasons;
}

function buildRuntimeStartBlockerDetails(
  reasons: TaskStartBlockReason[],
  ctx: RuntimeTaskActionabilityBridgeContext,
): TaskStartBlockerDetail[] {
  const out: TaskStartBlockerDetail[] = [];
  if (reasons.includes("PAYMENT_GATE_UNSATISFIED")) {
    const gates: TaskStartPaymentGateBlocker[] = [];
    for (const g of ctx.paymentGates) {
      if (g.status !== "UNSATISFIED") continue;
      const hits = g.targets.some((t) => t.taskKind === "RUNTIME" && t.taskId === ctx.runtimeTaskId);
      if (!hits) continue;
      gates.push({ kind: "payment_gate", gateId: g.id, title: g.title });
    }
    gates.sort((a, b) => a.gateId.localeCompare(b.gateId));
    out.push(...gates);
  }
  if (reasons.includes("HOLD_ACTIVE")) {
    const holds: TaskStartOperationalHoldBlocker[] = [];
    for (const h of ctx.activeHolds) {
      if (h.runtimeTaskId != null && h.runtimeTaskId !== ctx.runtimeTaskId) continue;
      holds.push({
        kind: "operational_hold",
        holdId: h.id,
        scope: h.runtimeTaskId == null ? "JOB" : "RUNTIME_TASK",
        reason: h.reason,
      });
    }
    holds.sort((a, b) => a.holdId.localeCompare(b.holdId));
    out.push(...holds);
  }
  return out;
}

function buildSkeletonStartBlockerDetails(
  reasons: TaskStartBlockReason[],
  ctx: SkeletonTaskActionabilityBridgeContext,
): TaskStartBlockerDetail[] {
  const out: TaskStartBlockerDetail[] = [];
  if (reasons.includes("PAYMENT_GATE_UNSATISFIED")) {
    const gates: TaskStartPaymentGateBlocker[] = [];
    for (const g of ctx.paymentGates) {
      if (g.status !== "UNSATISFIED") continue;
      const hits = g.targets.some((t) => t.taskKind === "SKELETON" && t.taskId === ctx.skeletonTaskId);
      if (!hits) continue;
      gates.push({ kind: "payment_gate", gateId: g.id, title: g.title });
    }
    gates.sort((a, b) => a.gateId.localeCompare(b.gateId));
    out.push(...gates);
  }
  if (reasons.includes("HOLD_ACTIVE")) {
    const holds: TaskStartOperationalHoldBlocker[] = [];
    for (const h of ctx.activeHolds) {
      if (h.runtimeTaskId != null) continue;
      holds.push({
        kind: "operational_hold",
        holdId: h.id,
        scope: "JOB",
        reason: h.reason,
      });
    }
    holds.sort((a, b) => a.holdId.localeCompare(b.holdId));
    out.push(...holds);
  }
  return out;
}

function finalizeStartEligibility(
  reasons: TaskStartBlockReason[],
  blockerDetails: TaskStartBlockerDetail[],
): TaskStartEligibility {
  return {
    schemaVersion: TASK_ACTIONABILITY_SCHEMA_VERSION,
    canStart: reasons.length === 0,
    reasons,
    blockerDetails,
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
  if (execution.status === "accepted") {
    reasons.push("TASK_ALREADY_ACCEPTED");
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
 * Central actionability for manifest runtime tasks.
 * Payment gates and operational holds are **separate** systems; both can block start.
 * Pass `bridge` from read models so `start.blockerDetails` lists concrete gate/hold rows (Epic 48).
 */
export function evaluateRuntimeTaskActionability(
  hasActivation: boolean,
  execution: RuntimeTaskExecutionSummary,
  hasUnsatisfiedPaymentGate: boolean,
  hasActiveOperationalHold: boolean,
  bridge?: RuntimeTaskActionabilityBridgeContext,
): TaskActionability {
  const reasons = computeStartReasons(
    hasActivation,
    execution,
    hasUnsatisfiedPaymentGate,
    hasActiveOperationalHold,
  );
  const blockerDetails =
    bridge != null ? buildRuntimeStartBlockerDetails(reasons, bridge) : [];
  return {
    start: finalizeStartEligibility(reasons, blockerDetails),
    complete: completeEligibility(hasActivation, execution),
  };
}

/** Skeleton tasks: same start rules; holds apply only when job-wide (`runtimeTaskId` null on hold). */
export function evaluateSkeletonTaskActionability(
  hasActivation: boolean,
  execution: RuntimeTaskExecutionSummary,
  hasUnsatisfiedPaymentGate: boolean,
  hasActiveOperationalHold: boolean,
  bridge?: SkeletonTaskActionabilityBridgeContext,
): TaskActionability {
  const reasons = computeStartReasons(
    hasActivation,
    execution,
    hasUnsatisfiedPaymentGate,
    hasActiveOperationalHold,
  );
  const blockerDetails =
    bridge != null ? buildSkeletonStartBlockerDetails(reasons, bridge) : [];
  return {
    start: finalizeStartEligibility(reasons, blockerDetails),
    complete: completeEligibility(hasActivation, execution),
  };
}
