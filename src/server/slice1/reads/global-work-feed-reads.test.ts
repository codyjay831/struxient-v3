import { describe, expect, it } from "vitest";
import { classifyGlobalWorkFeedRuntimeLane, isPreJobTaskOpenInWorkFeedStatus } from "./global-work-feed-reads";
import { evaluateRuntimeTaskActionability, evaluateSkeletonTaskActionability } from "../eligibility/task-actionability";
import type { RuntimeTaskExecutionSummary } from "./derive-runtime-execution-summary";

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

describe("classifyGlobalWorkFeedRuntimeLane", () => {
  it("matches evaluateRuntimeTaskActionability for common cases", () => {
    const a = evaluateRuntimeTaskActionability(true, summary({ status: "not_started" }), false, false);
    expect(classifyGlobalWorkFeedRuntimeLane(a)).toBe("startable");

    const b = evaluateRuntimeTaskActionability(true, summary({ status: "in_progress", startedAt: new Date() }), false, false);
    expect(classifyGlobalWorkFeedRuntimeLane(b)).toBe("completable");

    const c = evaluateRuntimeTaskActionability(false, summary({ status: "not_started" }), false, false);
    expect(classifyGlobalWorkFeedRuntimeLane(c)).toBe("blocked");

    const d = evaluateRuntimeTaskActionability(true, summary({ status: "not_started" }), true, false);
    expect(classifyGlobalWorkFeedRuntimeLane(d)).toBe("blocked");

    const holdBlocked = evaluateRuntimeTaskActionability(true, summary({ status: "not_started" }), false, true);
    expect(classifyGlobalWorkFeedRuntimeLane(holdBlocked)).toBe("blocked");
  });
});

describe("classifyGlobalWorkFeedRuntimeLane + skeleton actionability", () => {
  it("applies the same lane ordering for skeleton tasks (shared TaskActionability shape)", () => {
    const s = evaluateSkeletonTaskActionability(true, summary({ status: "not_started" }), false, false);
    expect(classifyGlobalWorkFeedRuntimeLane(s)).toBe("startable");
    const s2 = evaluateSkeletonTaskActionability(true, summary({ status: "not_started" }), true, false);
    expect(classifyGlobalWorkFeedRuntimeLane(s2)).toBe("blocked");
    const s3 = evaluateSkeletonTaskActionability(true, summary({ status: "not_started" }), false, true);
    expect(classifyGlobalWorkFeedRuntimeLane(s3)).toBe("blocked");
  });
});

describe("isPreJobTaskOpenInWorkFeedStatus", () => {
  it("excludes terminal pre-job statuses", () => {
    expect(isPreJobTaskOpenInWorkFeedStatus("DONE")).toBe(false);
    expect(isPreJobTaskOpenInWorkFeedStatus("CANCELLED")).toBe(false);
  });

  it("includes in-flight pre-job statuses", () => {
    expect(isPreJobTaskOpenInWorkFeedStatus("OPEN")).toBe(true);
    expect(isPreJobTaskOpenInWorkFeedStatus("READY")).toBe(true);
    expect(isPreJobTaskOpenInWorkFeedStatus("IN_PROGRESS")).toBe(true);
    expect(isPreJobTaskOpenInWorkFeedStatus("BLOCKED")).toBe(true);
  });
});
