import { describe, expect, it } from "vitest";
import {
  buildJobShellQuickJumpLinks,
  deriveJobHeaderContext,
  formatJobTimestamp,
  presentAuthFailure,
  presentJobShellLoadError,
  summarizeFlowRuntimeTasks,
  type FlowForRuntimeSummary,
} from "./job-shell-page-state";
import type { JobShellApiDto } from "@/lib/job-shell-dto";
import type { TaskStartBlockReason } from "@/server/slice1/eligibility/task-actionability";

/* ---------------- Shared re-export sanity ---------------- */

describe("re-exported presentation primitives", () => {
  // The job page must render the SAME panel/copy as the workspace and scope
  // pages for identical failure kinds. Locking the re-export prevents a
  // future accidental override that would let copy drift between surfaces.
  it("presentAuthFailure forwards to the shared workspace helper (kind preserved, remediation populated)", () => {
    const r = presentAuthFailure({ kind: "unauthenticated" });
    expect(r.failureKind).toBe("unauthenticated");
    expect(r.tone).toBe("amber");
    expect(r.remediation.length).toBeGreaterThan(0);
  });

  it("presentJobShellLoadError preserves invariant code + context verbatim", () => {
    const r = presentJobShellLoadError({
      kind: "invariant",
      code: "READ_MODEL_INVARIANT_FAILURE",
      message: "boom",
      context: { jobId: "job_1" },
    });
    expect(r.errorKind).toBe("invariant");
    expect(r.code).toBe("READ_MODEL_INVARIANT_FAILURE");
    expect(r.context).toEqual({ jobId: "job_1" });
  });

  it("presentJobShellLoadError classifies prisma_init / missing_database_url / unknown distinctly", () => {
    expect(presentJobShellLoadError({ kind: "prisma_init", message: "x" }).errorKind).toBe(
      "prisma_init",
    );
    expect(
      presentJobShellLoadError({ kind: "missing_database_url", message: "y" }).errorKind,
    ).toBe("missing_database_url");
    expect(presentJobShellLoadError({ kind: "unknown", message: "z" }).errorKind).toBe("unknown");
  });
});

/* ---------------- formatJobTimestamp ---------------- */

describe("formatJobTimestamp", () => {
  it("formats a valid ISO string in fixed YYYY-MM-DD HH:MM:SS UTC form", () => {
    expect(formatJobTimestamp("2026-04-21T17:30:42.123Z")).toBe("2026-04-21 17:30:42 UTC");
  });

  it("strips trailing fractional seconds even when no millis are present", () => {
    expect(formatJobTimestamp("2026-04-21T00:00:00.000Z")).toBe("2026-04-21 00:00:00 UTC");
  });

  it("returns the original string verbatim when the input is not parseable", () => {
    expect(formatJobTimestamp("not-a-date")).toBe("not-a-date");
  });

  it("does not throw on empty input (returns it verbatim)", () => {
    expect(formatJobTimestamp("")).toBe("");
  });
});

/* ---------------- buildJobShellQuickJumpLinks ---------------- */

describe("buildJobShellQuickJumpLinks", () => {
  it("emits the four base discovery links in fixed order when no flow exists", () => {
    const r = buildJobShellQuickJumpLinks({ jobId: "job_1", newestFlow: null });
    expect(r.map((l) => l.label)).toEqual([
      "All jobs",
      "Activated flows",
      "Customers",
      "Flow groups",
    ]);
    expect(r.find((l) => l.label === "Open work feed")).toBeUndefined();
    expect(r.find((l) => l.label === "Quote workspace")).toBeUndefined();
  });

  it("appends Open work feed (emerald) and Quote workspace (sky) when a flow is provided", () => {
    const r = buildJobShellQuickJumpLinks({
      jobId: "job_1",
      newestFlow: { id: "flow_5", quoteId: "quote_9" },
    });
    const wf = r.find((l) => l.label === "Open work feed");
    const qw = r.find((l) => l.label === "Quote workspace");
    expect(wf?.href).toBe("/dev/work-feed/flow_5");
    expect(wf?.variant).toBe("emerald");
    expect(qw?.href).toBe("/dev/quotes/quote_9");
    expect(qw?.variant).toBe("sky");
  });

  it("never emits a /dev/work-feed/null link when newestFlow is null (regression guard)", () => {
    const r = buildJobShellQuickJumpLinks({ jobId: "job_1", newestFlow: null });
    for (const l of r) {
      expect(l.href).not.toContain("/null");
      expect(l.href).not.toContain("/undefined");
    }
  });
});

/* ---------------- summarizeFlowRuntimeTasks ---------------- */

const T = (
  status: FlowForRuntimeSummary["runtimeTasks"][number]["execution"]["status"],
  startReasons: ReadonlyArray<TaskStartBlockReason> = [],
): FlowForRuntimeSummary["runtimeTasks"][number] => ({
  execution: { status },
  actionability: {
    start: {
      canStart: startReasons.length === 0,
      reasons: startReasons,
    },
    complete: { canComplete: false },
  },
});

const FLOW = (
  activated: boolean,
  tasks: FlowForRuntimeSummary["runtimeTasks"][number][] = [],
): FlowForRuntimeSummary => ({
  activation: activated ? { id: "act_1", activatedAt: "2026-01-01T00:00:00.000Z" } : null,
  runtimeTasks: tasks,
});

describe("summarizeFlowRuntimeTasks", () => {
  it("returns health=empty when the flow has no runtime tasks", () => {
    const r = summarizeFlowRuntimeTasks(FLOW(true, []));
    expect(r.total).toBe(0);
    expect(r.health).toBe("empty");
    expect(r.blockingStartReasons).toEqual([]);
  });

  it("returns health=not_activated when there is no Activation, regardless of task counts", () => {
    const r = summarizeFlowRuntimeTasks(
      FLOW(false, [T("not_started"), T("not_started")]),
    );
    expect(r.health).toBe("not_activated");
    expect(r.notStarted).toBe(2);
  });

  it("returns health=ready when activated but every task is not_started and unblocked", () => {
    const r = summarizeFlowRuntimeTasks(FLOW(true, [T("not_started"), T("not_started")]));
    expect(r.health).toBe("ready");
    expect(r.blockingStartReasons).toEqual([]);
  });

  it("returns health=blocked when at least one task carries PAYMENT_GATE_UNSATISFIED", () => {
    const r = summarizeFlowRuntimeTasks(
      FLOW(true, [
        T("not_started", ["PAYMENT_GATE_UNSATISFIED"]),
        T("not_started"),
      ]),
    );
    expect(r.health).toBe("blocked");
    expect(r.blockingStartReasons).toEqual(["PAYMENT_GATE_UNSATISFIED"]);
  });

  it("ignores reasons that are not real blockers (already_started/already_completed/already_accepted/flow_not_activated)", () => {
    // A task whose only reasons are FLOW_NOT_ACTIVATED + TASK_ALREADY_STARTED
    // should not count as a 'blocked' health (those are state-of-task, not
    // operator-fixable gating). FLOW_NOT_ACTIVATED is also already conveyed
    // by the activation flag.
    const r = summarizeFlowRuntimeTasks(
      FLOW(true, [T("in_progress", ["TASK_ALREADY_STARTED"])]),
    );
    expect(r.blockingStartReasons).toEqual([]);
    expect(r.health).toBe("in_progress");
  });

  it("returns health=in_progress when at least one task is in motion (in_progress/completed/correction_required/accepted) and nothing is blocking", () => {
    const r = summarizeFlowRuntimeTasks(
      FLOW(true, [T("in_progress"), T("not_started"), T("completed")]),
    );
    expect(r.health).toBe("in_progress");
    expect(r.inProgress).toBe(1);
    expect(r.awaitingReview).toBe(1);
    expect(r.notStarted).toBe(1);
  });

  it("returns health=all_accepted only when EVERY task is in 'accepted' state", () => {
    const allAccepted = summarizeFlowRuntimeTasks(
      FLOW(true, [T("accepted"), T("accepted"), T("accepted")]),
    );
    expect(allAccepted.health).toBe("all_accepted");

    const oneNotAccepted = summarizeFlowRuntimeTasks(
      FLOW(true, [T("accepted"), T("accepted"), T("completed")]),
    );
    expect(oneNotAccepted.health).toBe("in_progress");
  });

  it("counts every status into exactly one bucket (totals add up)", () => {
    const r = summarizeFlowRuntimeTasks(
      FLOW(true, [
        T("accepted"),
        T("completed"),
        T("in_progress"),
        T("correction_required"),
        T("not_started"),
        T("not_started"),
      ]),
    );
    expect(r.accepted).toBe(1);
    expect(r.awaitingReview).toBe(1);
    expect(r.inProgress).toBe(1);
    expect(r.correctionRequired).toBe(1);
    expect(r.notStarted).toBe(2);
    expect(r.total).toBe(6);
    expect(
      r.accepted + r.awaitingReview + r.inProgress + r.correctionRequired + r.notStarted,
    ).toBe(r.total);
  });

  it("dedupes blocking reasons across multiple tasks and returns them sorted", () => {
    const r = summarizeFlowRuntimeTasks(
      FLOW(true, [
        T("not_started", ["PAYMENT_GATE_UNSATISFIED"]),
        T("not_started", ["PAYMENT_GATE_UNSATISFIED"]),
      ]),
    );
    expect(r.blockingStartReasons).toEqual(["PAYMENT_GATE_UNSATISFIED"]);
  });
});

/* ---------------- deriveJobHeaderContext ---------------- */

describe("deriveJobHeaderContext", () => {
  const baseDto = (overrides: Partial<JobShellApiDto> = {}): JobShellApiDto => ({
    job: { id: "job_1", createdAt: "2026-01-01T00:00:00.000Z", flowGroupId: "fg_1" },
    flowGroup: { id: "fg_1", name: "Acme HVAC", customerId: "c_1" },
    customer: { id: "c_1", name: "Acme Co" },
    flows: [],
    ...overrides,
  });

  it("lifts customer + flow group identity straight off the DTO", () => {
    const r = deriveJobHeaderContext(baseDto());
    expect(r.customerName).toBe("Acme Co");
    expect(r.customerId).toBe("c_1");
    expect(r.flowGroupName).toBe("Acme HVAC");
    expect(r.flowGroupId).toBe("fg_1");
  });

  it("flowCount mirrors the number of flow rows on the DTO", () => {
    const r = deriveJobHeaderContext(
      baseDto({
        flows: [
          {
            id: "f1",
            quoteId: "q1",
            quoteVersionId: "qv1",
            workflowVersionId: "wfv1",
            createdAt: "2026-01-01T00:00:00.000Z",
            quoteNumber: "Q-1",
            activation: null,
            runtimeTasks: [],
          },
        ],
      }),
    );
    expect(r.flowCount).toBe(1);
  });

  it("hasActivatedFlow is true if and only if at least one flow has an Activation", () => {
    const noneActivated = deriveJobHeaderContext(
      baseDto({
        flows: [
          {
            id: "f1",
            quoteId: "q1",
            quoteVersionId: "qv1",
            workflowVersionId: "wfv1",
            createdAt: "2026-01-01T00:00:00.000Z",
            quoteNumber: "Q-1",
            activation: null,
            runtimeTasks: [],
          },
        ],
      }),
    );
    expect(noneActivated.hasActivatedFlow).toBe(false);

    const oneActivated = deriveJobHeaderContext(
      baseDto({
        flows: [
          {
            id: "f1",
            quoteId: "q1",
            quoteVersionId: "qv1",
            workflowVersionId: "wfv1",
            createdAt: "2026-01-01T00:00:00.000Z",
            quoteNumber: "Q-1",
            activation: { id: "act_1", activatedAt: "2026-01-02T00:00:00.000Z" },
            runtimeTasks: [],
          },
        ],
      }),
    );
    expect(oneActivated.hasActivatedFlow).toBe(true);
  });
});
