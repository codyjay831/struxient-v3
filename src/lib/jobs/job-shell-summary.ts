/**
 * Pure, surface-agnostic helpers for projecting `JobShellApiDto` into the
 * presentation shapes the job-anchor pages render.
 *
 * Originally lived under `src/app/dev/jobs/[jobId]/job-shell-page-state.ts`
 * because the dev surface was the only consumer. With the office job
 * surfaces now reading the same `getJobShellReadModel` + `toJobShellApiDto`
 * pipeline, the canon-safe location is `@/lib/jobs/...` so neither office
 * nor any future surface needs to import from `/dev/...`.
 *
 * Behaviour is unchanged: the dev module re-exports these symbols so the
 * existing tests in `src/app/dev/jobs/[jobId]/job-shell-page-state.test.ts`
 * keep covering the canonical helpers.
 */

import type { JobShellApiDto, JobShellFlowApiDto } from "@/lib/job-shell-dto";
import type { TaskStartBlockReason } from "@/server/slice1/eligibility/task-actionability";

/* ---------------- Timestamp formatting ---------------- */

/**
 * Render an ISO-8601 timestamp in a fixed, locale-independent UTC form.
 *
 * Contract:
 *   - Output is always either the formatted UTC string or, if the input is
 *     not a parseable date, the original input verbatim. We never throw and
 *     never substitute "Invalid Date" / silent placeholders, so a bad value
 *     surfaces visibly in the UI rather than being hidden.
 *   - Format is `YYYY-MM-DD HH:MM:SS UTC` (drop fractional seconds + tz id).
 */
export function formatJobTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\..+$/, " UTC");
}

/* ---------------- Per-flow execution rollup ---------------- */

/**
 * Subset of `JobShellFlowApiDto` we need to compute the rollup. Loose at the
 * boundary so the helper stays independent of unrelated DTO additions.
 */
export type FlowForRuntimeSummary = {
  activation: { id: string; activatedAt: string } | null;
  runtimeTasks: ReadonlyArray<{
    execution: { status: JobShellFlowApiDto["runtimeTasks"][number]["execution"]["status"] };
    actionability: {
      start: { canStart: boolean; reasons: ReadonlyArray<TaskStartBlockReason> };
      complete: { canComplete: boolean };
    };
  }>;
};

export type FlowRuntimeSummary = {
  /** Total runtime tasks on the flow (post-supersede filter applied upstream). */
  total: number;
  /** Tasks reviewed and accepted. */
  accepted: number;
  /** Tasks completed but not yet reviewed (or in correction-required state). */
  awaitingReview: number;
  /** Tasks STARTED but not COMPLETED. */
  inProgress: number;
  /** Tasks reviewed and bounced back for correction. */
  correctionRequired: number;
  /** Tasks that have not been started yet. */
  notStarted: number;
  /**
   * Distinct, sorted set of *start*-block reason codes across all not-yet-
   * acted-on tasks. Surfacing these at flow level lets an operator see at a
   * glance "this flow is stuck because PAYMENT_GATE_UNSATISFIED" without
   * having to open the work feed.
   *
   * `FLOW_NOT_ACTIVATED` is included when present and is canon-correct: a job
   * may carry a flow row that has not yet been activated, in which case every
   * task carries that reason.
   */
  blockingStartReasons: TaskStartBlockReason[];
  /**
   * Coarse health classification driving the per-flow status badge:
   *   - "not_activated"        → the flow row exists but has no Activation
   *   - "all_accepted"         → every task is accepted (flow effectively done)
   *   - "blocked"              → at least one task is start-blocked by a
   *                              non-`FLOW_NOT_ACTIVATED` / non-already-* reason
   *                              (today only PAYMENT_GATE_UNSATISFIED)
   *   - "in_progress"          → at least one task is in_progress / completed /
   *                              correction_required (work is moving)
   *   - "ready"                → flow is activated but no work has started yet
   *   - "empty"                → flow has zero runtime tasks (rare; likely a
   *                              read-model anomaly worth surfacing)
   */
  health:
    | "not_activated"
    | "all_accepted"
    | "blocked"
    | "in_progress"
    | "ready"
    | "empty";
};

const REAL_BLOCK_REASONS: ReadonlySet<TaskStartBlockReason> = new Set<TaskStartBlockReason>([
  "PAYMENT_GATE_UNSATISFIED",
  "HOLD_ACTIVE",
]);

/**
 * Pure rollup over a flow's `runtimeTasks`. Drives the per-flow status badge
 * and the inline counts shown on every job-shell page card. Locking this in a
 * tested helper means a future change to either side (DTO status enum or UI
 * badge) fails the tests rather than silently mis-summarising.
 */
export function summarizeFlowRuntimeTasks(flow: FlowForRuntimeSummary): FlowRuntimeSummary {
  const counts = {
    total: flow.runtimeTasks.length,
    accepted: 0,
    awaitingReview: 0,
    inProgress: 0,
    correctionRequired: 0,
    notStarted: 0,
  };
  const blockingReasons = new Set<TaskStartBlockReason>();

  for (const t of flow.runtimeTasks) {
    switch (t.execution.status) {
      case "accepted":
        counts.accepted += 1;
        break;
      case "completed":
        counts.awaitingReview += 1;
        break;
      case "in_progress":
        counts.inProgress += 1;
        break;
      case "correction_required":
        counts.correctionRequired += 1;
        break;
      case "not_started":
        counts.notStarted += 1;
        break;
    }
    if (!t.actionability.start.canStart) {
      for (const r of t.actionability.start.reasons) {
        if (REAL_BLOCK_REASONS.has(r)) blockingReasons.add(r);
      }
    }
  }

  const blockingStartReasons = [...blockingReasons].sort();

  const health: FlowRuntimeSummary["health"] = (() => {
    if (counts.total === 0) return "empty";
    if (!flow.activation) return "not_activated";
    if (counts.accepted === counts.total) return "all_accepted";
    if (blockingStartReasons.length > 0) return "blocked";
    const movement = counts.inProgress + counts.awaitingReview + counts.correctionRequired + counts.accepted;
    if (movement > 0) return "in_progress";
    return "ready";
  })();

  return { ...counts, blockingStartReasons, health };
}

/* ---------------- Job header context ---------------- */

export type JobHeaderContext = {
  customerName: string;
  customerId: string;
  flowGroupName: string;
  flowGroupId: string;
  flowCount: number;
  /** True when at least one flow on the job has an Activation row. */
  hasActivatedFlow: boolean;
};

/**
 * Lift the small amount of header context the page renders (customer name +
 * flow group name + activation banner) into a single typed shape. The page
 * previously hand-built these inline; centralising prevents drift if the
 * DTO grows new identity fields (e.g. customer email).
 */
export function deriveJobHeaderContext(dto: JobShellApiDto): JobHeaderContext {
  return {
    customerName: dto.customer.name,
    customerId: dto.customer.id,
    flowGroupName: dto.flowGroup.name,
    flowGroupId: dto.flowGroup.id,
    flowCount: dto.flows.length,
    hasActivatedFlow: dto.flows.some((f) => f.activation !== null),
  };
}
