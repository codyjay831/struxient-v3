import { describe, expect, it } from "vitest";
import type { QuoteVersionHistoryItemDto } from "@/server/slice1/reads/quote-version-history-reads";
import {
  deriveExecutionBridgeData,
  deriveHeadDraftPipelineTargets,
  presentAuthFailure,
  presentWorkspaceLoadError,
  toQuoteHeadReadinessInput,
} from "./quote-workspace-page-state";

function head(over: Partial<QuoteVersionHistoryItemDto> = {}): QuoteVersionHistoryItemDto {
  return {
    id: "qv_test_0000000000000001",
    versionNumber: 3,
    status: "DRAFT",
    createdAt: "2026-04-21T00:00:00.000Z",
    sentAt: null,
    signedAt: null,
    title: null,
    pinnedWorkflowVersionId: null,
    hasPinnedWorkflow: false,
    hasFrozenArtifacts: false,
    proposalGroupCount: 1,
    lineItemCount: 0,
    hasActivation: false,
    portalQuoteShareToken: null,
    voidedAt: null,
    voidReason: null,
    portalDeclinedAt: null,
    portalDeclineReason: null,
    portalChangeRequestedAt: null,
    portalChangeRequestMessage: null,
    compareToPrior: null,
    ...over,
  };
}

describe("presentAuthFailure", () => {
  it("maps unauthenticated to a Sign in panel that mentions both real session and dev bypass", () => {
    const r = presentAuthFailure({ kind: "unauthenticated" });
    expect(r.failureKind).toBe("unauthenticated");
    expect(r.tone).toBe("amber");
    expect(r.title.toLowerCase()).toContain("sign in");
    expect(r.remediation.some((s) => s.includes("/dev/login"))).toBe(true);
    expect(r.remediation.some((s) => s.includes("STRUXIENT_DEV_AUTH_BYPASS"))).toBe(true);
  });

  it("maps bypass_misconfigured to a red panel that names the missing env vars", () => {
    const r = presentAuthFailure({ kind: "bypass_misconfigured" });
    expect(r.failureKind).toBe("bypass_misconfigured");
    expect(r.tone).toBe("red");
    expect(r.message).toContain("STRUXIENT_DEV_TENANT_ID");
    expect(r.message).toContain("STRUXIENT_DEV_USER_ID");
    expect(r.remediation.some((s) => s.toLowerCase().includes("restart"))).toBe(true);
  });

  it("maps bypass_invalid_user to a red panel that points at re-seeding", () => {
    const r = presentAuthFailure({ kind: "bypass_invalid_user" });
    expect(r.failureKind).toBe("bypass_invalid_user");
    expect(r.tone).toBe("red");
    expect(r.remediation.some((s) => s.toLowerCase().includes("seed"))).toBe(true);
  });

  // Locks operator-clarity contract: every failure kind must carry at least one
  // concrete remediation step. If `ResolvePrincipalFailure` ever gains a new
  // variant the typechecker forces an update here, and this test guards that
  // the new variant can't ship with an empty remediation list.
  it.each([
    { kind: "unauthenticated" } as const,
    { kind: "bypass_misconfigured" } as const,
    { kind: "bypass_invalid_user" } as const,
  ])("returns at least one remediation step for $kind", (failure) => {
    const r = presentAuthFailure(failure);
    expect(r.remediation.length).toBeGreaterThan(0);
    expect(r.title.length).toBeGreaterThan(0);
    expect(r.message.length).toBeGreaterThan(0);
  });
});

describe("presentWorkspaceLoadError", () => {
  it("classifies prisma_init with the original message preserved", () => {
    const r = presentWorkspaceLoadError({
      kind: "prisma_init",
      message: "Can't reach database server at `localhost:5432`",
    });
    expect(r.errorKind).toBe("prisma_init");
    expect(r.tone).toBe("red");
    expect(r.message).toContain("localhost:5432");
    expect(r.remediation.some((s) => s.includes("DATABASE_URL"))).toBe(true);
    expect(r.code).toBeUndefined();
    expect(r.context).toBeUndefined();
  });

  it("classifies missing_database_url as amber and instructs env edit", () => {
    const r = presentWorkspaceLoadError({
      kind: "missing_database_url",
      message: "[Struxient] DATABASE_URL not set",
    });
    expect(r.errorKind).toBe("missing_database_url");
    expect(r.tone).toBe("amber");
    expect(r.message).toContain("DATABASE_URL");
    expect(r.remediation.some((s) => s.includes(".env"))).toBe(true);
  });

  it("classifies invariant violations and preserves code + context verbatim", () => {
    const ctx = { quoteVersionId: "qv_1", expected: "DRAFT", actual: "SENT" };
    const r = presentWorkspaceLoadError({
      kind: "invariant",
      code: "QUOTE_VERSION_NOT_DRAFT",
      message: "Quote version is not draft.",
      context: ctx,
    });
    expect(r.errorKind).toBe("invariant");
    expect(r.tone).toBe("red");
    expect(r.code).toBe("QUOTE_VERSION_NOT_DRAFT");
    expect(r.context).toEqual(ctx);
    expect(r.title).toContain("QUOTE_VERSION_NOT_DRAFT");
  });

  it("omits context entirely when invariant has no context (no `context: undefined` key)", () => {
    const r = presentWorkspaceLoadError({
      kind: "invariant",
      code: "READ_MODEL_INVARIANT_FAILURE",
      message: "boom",
    });
    expect("context" in r).toBe(false);
  });

  it("classifies unknown errors with a fallback message when input message is empty", () => {
    const r = presentWorkspaceLoadError({ kind: "unknown", message: "" });
    expect(r.errorKind).toBe("unknown");
    expect(r.tone).toBe("red");
    expect(r.message.length).toBeGreaterThan(0);
  });

  it("classifies unknown errors with the original message when provided", () => {
    const r = presentWorkspaceLoadError({ kind: "unknown", message: "ECONNRESET on prisma" });
    expect(r.message).toContain("ECONNRESET");
  });
});

describe("toQuoteHeadReadinessInput", () => {
  it("maps every workspace head field 1:1 with the supplied lineItemCount", () => {
    const row = head({
      id: "qv_42",
      versionNumber: 7,
      status: "SENT",
      hasPinnedWorkflow: true,
      hasFrozenArtifacts: true,
      hasActivation: false,
      proposalGroupCount: 2,
      sentAt: "2026-04-20T12:00:00.000Z",
      signedAt: null,
    });
    const r = toQuoteHeadReadinessInput(row, 5);
    expect(r).toEqual({
      id: "qv_42",
      versionNumber: 7,
      status: "SENT",
      lineItemCount: 5,
      hasPinnedWorkflow: true,
      hasFrozenArtifacts: true,
      hasActivation: false,
      proposalGroupCount: 2,
      sentAt: "2026-04-20T12:00:00.000Z",
      signedAt: null,
    });
  });

  it("does not silently default missing required fields (typing locks the shape)", () => {
    // This is a compile-time guard, but we verify the result has exactly the
    // expected keys at runtime so a future field addition shows up here too.
    const r = toQuoteHeadReadinessInput(head(), 0);
    expect(Object.keys(r).sort()).toEqual(
      [
        "hasActivation",
        "hasFrozenArtifacts",
        "hasPinnedWorkflow",
        "id",
        "lineItemCount",
        "proposalGroupCount",
        "sentAt",
        "signedAt",
        "status",
        "versionNumber",
      ].sort(),
    );
  });
});

describe("deriveHeadDraftPipelineTargets", () => {
  it("returns both targets null when head is null", () => {
    expect(deriveHeadDraftPipelineTargets(null)).toEqual({
      pinTarget: null,
      workspaceTarget: null,
    });
  });

  it("returns both targets null when head status is SENT", () => {
    expect(deriveHeadDraftPipelineTargets(head({ status: "SENT" }))).toEqual({
      pinTarget: null,
      workspaceTarget: null,
    });
  });

  it("returns both targets null when head status is SIGNED", () => {
    expect(deriveHeadDraftPipelineTargets(head({ status: "SIGNED" }))).toEqual({
      pinTarget: null,
      workspaceTarget: null,
    });
  });

  it("returns populated targets when head is DRAFT (no pinned workflow yet)", () => {
    const r = deriveHeadDraftPipelineTargets(
      head({ id: "qv_1", versionNumber: 1, status: "DRAFT", hasPinnedWorkflow: false, pinnedWorkflowVersionId: null }),
    );
    expect(r.pinTarget).toEqual({
      quoteVersionId: "qv_1",
      versionNumber: 1,
      pinnedWorkflowVersionId: null,
    });
    expect(r.workspaceTarget).toEqual({
      quoteVersionId: "qv_1",
      versionNumber: 1,
      hasPinnedWorkflow: false,
    });
  });

  it("forwards the pinned workflow version id and hasPinnedWorkflow flag verbatim", () => {
    const r = deriveHeadDraftPipelineTargets(
      head({
        id: "qv_2",
        versionNumber: 4,
        status: "DRAFT",
        hasPinnedWorkflow: true,
        pinnedWorkflowVersionId: "wf_v_99",
      }),
    );
    expect(r.pinTarget?.pinnedWorkflowVersionId).toBe("wf_v_99");
    expect(r.workspaceTarget?.hasPinnedWorkflow).toBe(true);
  });
});

describe("deriveExecutionBridgeData", () => {
  it("returns kind=none when no version has been activated", () => {
    expect(
      deriveExecutionBridgeData({ executionEntryTarget: null, quoteId: "q_1", jobId: null }),
    ).toEqual({ kind: "none" });
  });

  it("returns kind=linked carrying quoteId, target, jobId; flow/activation fields null until workspace read carries them", () => {
    const r = deriveExecutionBridgeData({
      executionEntryTarget: { quoteVersionId: "qv_99", versionNumber: 12 },
      quoteId: "q_1",
      jobId: "job_7",
    });
    expect(r).toEqual({
      kind: "linked",
      quoteId: "q_1",
      quoteVersionId: "qv_99",
      versionNumber: 12,
      flowId: null,
      jobId: "job_7",
      activationId: null,
      activatedAtIso: null,
      runtimeTaskCount: null,
    });
  });

  it("preserves a null jobId without coercing it to a string", () => {
    const r = deriveExecutionBridgeData({
      executionEntryTarget: { quoteVersionId: "qv_99", versionNumber: 1 },
      quoteId: "q_1",
      jobId: null,
    });
    if (r.kind !== "linked") throw new Error("unreachable");
    expect(r.jobId).toBeNull();
  });
});
