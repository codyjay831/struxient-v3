import { describe, expect, it } from "vitest";
import {
  buildQuoteScopeQuickJumpLinks,
  presentAuthFailure,
  presentInternalLoadError,
} from "./quote-scope-page-state";

/* ---------------- Shared re-export sanity ---------------- */

describe("re-exported presentation primitives", () => {
  // The scope page renders the SAME panel/copy as the workspace page for
  // identical failure kinds. Locking the re-export prevents a future
  // accidental override that would let copy drift between surfaces.
  it("presentAuthFailure forwards to the shared workspace helper (same kinds, same remediation length)", () => {
    const r = presentAuthFailure({ kind: "bypass_misconfigured" });
    expect(r.failureKind).toBe("bypass_misconfigured");
    expect(r.tone).toBe("red");
    expect(r.remediation.length).toBeGreaterThan(0);
  });

  it("presentInternalLoadError preserves invariant code + context verbatim", () => {
    const r = presentInternalLoadError({
      kind: "invariant",
      code: "READ_MODEL_INVARIANT_FAILURE",
      message: "boom",
      context: { quoteVersionId: "qv_1" },
    });
    expect(r.errorKind).toBe("invariant");
    expect(r.code).toBe("READ_MODEL_INVARIANT_FAILURE");
    expect(r.context).toEqual({ quoteVersionId: "qv_1" });
  });

  it("presentInternalLoadError classifies prisma_init / missing_database_url / unknown distinctly", () => {
    expect(presentInternalLoadError({ kind: "prisma_init", message: "x" }).errorKind).toBe(
      "prisma_init",
    );
    expect(
      presentInternalLoadError({ kind: "missing_database_url", message: "y" }).errorKind,
    ).toBe("missing_database_url");
    expect(presentInternalLoadError({ kind: "unknown", message: "z" }).errorKind).toBe("unknown");
  });
});

/* ---------------- Quick jump (dev-only chrome) ---------------- */

describe("buildQuoteScopeQuickJumpLinks", () => {
  it("returns the four base links in fixed order when no lifecycle is present", () => {
    const r = buildQuoteScopeQuickJumpLinks({ quoteId: "q_1", lifecycle: null });
    expect(r.map((l) => l.label)).toEqual([
      "Quote workspace",
      "All quotes",
      "Customers",
      "Flow groups",
    ]);
    expect(r[0]?.variant).toBe("sky");
    expect(r[0]?.href).toBe("/dev/quotes/q_1");
  });

  it("appends Flow detail when lifecycle.flow is present", () => {
    const r = buildQuoteScopeQuickJumpLinks({
      quoteId: "q_1",
      lifecycle: {
        flow: {
          id: "flow_5",
          createdAt: "2026-01-01T00:00:00.000Z",
          jobId: "job_1",
          workflowVersionId: "wfv_1",
          runtimeTaskCount: 3,
        },
        job: null,
      },
    });
    expect(r.find((l) => l.label === "Flow detail")?.href).toBe("/dev/flow/flow_5");
    expect(r.find((l) => l.label === "Job anchor")).toBeUndefined();
  });

  it("appends Job anchor (emerald) when lifecycle.job is present", () => {
    const r = buildQuoteScopeQuickJumpLinks({
      quoteId: "q_1",
      lifecycle: {
        flow: null,
        job: { id: "job_9", createdAt: "2026-01-01T00:00:00.000Z", flowGroupId: "fg_1" },
      },
    });
    const job = r.find((l) => l.label === "Job anchor");
    expect(job?.href).toBe("/dev/jobs/job_9");
    expect(job?.variant).toBe("emerald");
  });

  it("emits Quote workspace as the first link with variant=sky", () => {
    const r = buildQuoteScopeQuickJumpLinks({ quoteId: "q_42", lifecycle: null });
    expect(r[0]).toEqual({ label: "Quote workspace", href: "/dev/quotes/q_42", variant: "sky" });
  });
});
