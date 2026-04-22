import { describe, expect, it } from "vitest";
import {
  evaluateRuntimeTaskActionability,
  evaluateSkeletonTaskActionability,
  TASK_ACTIONABILITY_SCHEMA_VERSION,
} from "./task-actionability";
import type { RuntimeTaskExecutionSummary } from "../reads/derive-runtime-execution-summary";

function summary(over: Partial<RuntimeTaskExecutionSummary> = {}): RuntimeTaskExecutionSummary {
  return {
    status: "not_started",
    startedAt: null,
    completedAt: null,
    reviewedAt: null,
    correctionFeedback: null,
    ...over,
  };
}

describe("task-actionability bridge (Epic 48)", () => {
  it("bumps schema version for blockerDetails", () => {
    expect(TASK_ACTIONABILITY_SCHEMA_VERSION).toBe(3);
  });

  it("leaves blockerDetails empty when bridge context is omitted", () => {
    const a = evaluateRuntimeTaskActionability(true, summary(), true, true);
    expect(a.start.blockerDetails).toEqual([]);
  });

  it("lists payment gates and holds for runtime when bridge is supplied", () => {
    const a = evaluateRuntimeTaskActionability(true, summary(), true, true, {
      runtimeTaskId: "rt-1",
      paymentGates: [
        {
          id: "g-b",
          status: "UNSATISFIED",
          title: "Second",
          targets: [{ taskId: "rt-1", taskKind: "RUNTIME" }],
        },
        {
          id: "g-a",
          status: "UNSATISFIED",
          title: "First",
          targets: [{ taskId: "rt-1", taskKind: "RUNTIME" }],
        },
      ],
      activeHolds: [
        { id: "h-b", runtimeTaskId: null, reason: "job" },
        { id: "h-a", runtimeTaskId: "rt-1", reason: "scoped" },
      ],
    });
    expect(a.start.reasons).toContain("PAYMENT_GATE_UNSATISFIED");
    expect(a.start.reasons).toContain("HOLD_ACTIVE");
    expect(a.start.blockerDetails).toEqual([
      { kind: "payment_gate", gateId: "g-a", title: "First" },
      { kind: "payment_gate", gateId: "g-b", title: "Second" },
      { kind: "operational_hold", holdId: "h-a", scope: "RUNTIME_TASK", reason: "scoped" },
      { kind: "operational_hold", holdId: "h-b", scope: "JOB", reason: "job" },
    ]);
  });

  it("skeleton bridge lists only job-wide holds", () => {
    const a = evaluateSkeletonTaskActionability(true, summary(), true, true, {
      skeletonTaskId: "sk-1",
      paymentGates: [
        {
          id: "g1",
          status: "UNSATISFIED",
          title: "Deposit",
          targets: [{ taskId: "sk-1", taskKind: "SKELETON" }],
        },
      ],
      activeHolds: [
        { id: "h-task", runtimeTaskId: "rt-x", reason: "ignored for skeleton" },
        { id: "h-job", runtimeTaskId: null, reason: "weather" },
      ],
    });
    expect(a.start.blockerDetails).toEqual([
      { kind: "payment_gate", gateId: "g1", title: "Deposit" },
      { kind: "operational_hold", holdId: "h-job", scope: "JOB", reason: "weather" },
    ]);
  });

  it("does not emit payment gate details when not blocked by payment", () => {
    const a = evaluateRuntimeTaskActionability(true, summary(), false, true, {
      runtimeTaskId: "rt-1",
      paymentGates: [
        {
          id: "g1",
          status: "UNSATISFIED",
          title: "X",
          targets: [{ taskId: "rt-1", taskKind: "RUNTIME" }],
        },
      ],
      activeHolds: [{ id: "h1", runtimeTaskId: null, reason: "r" }],
    });
    expect(a.start.reasons).not.toContain("PAYMENT_GATE_UNSATISFIED");
    expect(a.start.blockerDetails).toEqual([
      { kind: "operational_hold", holdId: "h1", scope: "JOB", reason: "r" },
    ]);
  });
});
