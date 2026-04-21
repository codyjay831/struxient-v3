/**
 * Pure helpers for the `/dev/quotes/[quoteId]` workspace page.
 *
 * The page itself is a server component that resolves the auth principal,
 * loads the workspace read model, and composes a few client + server
 * subcomponents. All input → presentation-state shaping lives here so the
 * page stays thin and the contract is verifiable in unit tests.
 *
 * Five responsibilities, all pure (no React, no DB, no fetch):
 *
 *   1. `presentAuthFailure` — translate `ResolvePrincipalFailure` into an
 *      operator-facing panel shape, distinct per failure kind. The page
 *      previously rendered a single generic message regardless of the
 *      underlying reason, hiding bypass misconfiguration from operators.
 *
 *   2. `presentWorkspaceLoadError` — classify a thrown error from the
 *      workspace read into a panel shape (db-init / db-url / invariant /
 *      unknown). Mirrors what the adjacent `/dev/quote-scope` page already
 *      does inline; lifting it into a helper makes the contract testable.
 *
 *   3. `toQuoteHeadReadinessInput` — typed mapper from a workspace head
 *      version row + line item count into the `QuoteHeadReadinessInput`
 *      shape that `deriveQuoteHeadWorkspaceReadiness` consumes. Replaces an
 *      `any`-typed mapper in the page.
 *
 *   4. `deriveHeadDraftPipelineTargets` — pin/workspace targets for steps 2
 *      and 3 are only valid when the head version is `DRAFT`. Centralizes
 *      that gate so we don't accidentally show a pin/compose UI on a
 *      sent/signed head.
 *
 *   5. `deriveExecutionBridgeData` — consolidates the bridge data shape so
 *      the page doesn't hand-build it (and so the known-incomplete fields
 *      `flowId`/`activationId`/`activatedAtIso`/`runtimeTaskCount` are
 *      acknowledged in one place rather than scattered with TODO comments).
 */

import type { ResolvePrincipalFailure } from "@/lib/auth/api-principal";
import type { QuoteVersionHistoryItemDto } from "@/server/slice1/reads/quote-version-history-reads";
import type { QuoteHeadReadinessInput } from "@/lib/workspace/derive-quote-head-workspace-readiness";
import type { ActivatedExecutionEntryTarget } from "@/lib/workspace/derive-workspace-execution-entry-target";
import type { ExecutionBridgeData } from "@/components/quotes/workspace/quote-workspace-execution-bridge";

/* ---------------- Auth failure presentation ---------------- */

export type AuthFailurePresentation = {
  /** Tagged failure kind, surfaced verbatim so operators can grep logs. */
  failureKind: ResolvePrincipalFailure["kind"];
  /** Headline for the panel. */
  title: string;
  /** Human-readable explanation of why this specific kind happened. */
  message: string;
  /**
   * Concrete recovery steps. Each is one operator action; the page renders
   * them as a list. Distinct per kind so we don't blanket-tell every visitor
   * to "sign in" when the real fix is to set env vars or re-seed.
   */
  remediation: string[];
  /** Tone for the panel border/background. */
  tone: "amber" | "red";
};

export function presentAuthFailure(failure: ResolvePrincipalFailure): AuthFailurePresentation {
  switch (failure.kind) {
    case "unauthenticated":
      return {
        failureKind: "unauthenticated",
        title: "Sign in required",
        message:
          "No active session was found, and the local dev auth bypass is not enabled.",
        remediation: [
          "Sign in at /dev/login with seeded credentials.",
          "Or, in non-production only, set STRUXIENT_DEV_AUTH_BYPASS=true plus STRUXIENT_DEV_TENANT_ID and STRUXIENT_DEV_USER_ID (see .env.example) and restart the dev server.",
        ],
        tone: "amber",
      };
    case "bypass_misconfigured":
      return {
        failureKind: "bypass_misconfigured",
        title: "Dev auth bypass is misconfigured",
        message:
          "STRUXIENT_DEV_AUTH_BYPASS is enabled but STRUXIENT_DEV_TENANT_ID or STRUXIENT_DEV_USER_ID is missing.",
        remediation: [
          "Set both STRUXIENT_DEV_TENANT_ID and STRUXIENT_DEV_USER_ID in .env or .env.local using values from the latest seed.",
          "Restart the dev server after editing env files.",
          "If you want a real session instead, unset STRUXIENT_DEV_AUTH_BYPASS and sign in at /dev/login.",
        ],
        tone: "red",
      };
    case "bypass_invalid_user":
      return {
        failureKind: "bypass_invalid_user",
        title: "Dev auth bypass user is not a member of the configured tenant",
        message:
          "STRUXIENT_DEV_USER_ID does not resolve to a user inside STRUXIENT_DEV_TENANT_ID. The DB row was not found.",
        remediation: [
          "Re-seed the database (npm run db:seed) and copy the printed dev user/tenant ids into your env file.",
          "Confirm the user row still exists for that tenant; ids may have changed if the DB was reset.",
          "Restart the dev server after correcting the env values.",
        ],
        tone: "red",
      };
  }
}

/* ---------------- Workspace load error presentation ---------------- */

export type WorkspaceLoadErrorInput =
  | { kind: "prisma_init"; message: string }
  | { kind: "missing_database_url"; message: string }
  | { kind: "invariant"; code: string; message: string; context?: unknown }
  | { kind: "unknown"; message: string };

export type WorkspaceLoadErrorPresentation = {
  errorKind: WorkspaceLoadErrorInput["kind"];
  title: string;
  message: string;
  remediation: string[];
  tone: "amber" | "red";
  /** Present only for invariant violations — the structured context blob. */
  context?: unknown;
  /** Present only for invariant violations — the canon-defined invariant code. */
  code?: string;
};

export function presentWorkspaceLoadError(
  input: WorkspaceLoadErrorInput,
): WorkspaceLoadErrorPresentation {
  switch (input.kind) {
    case "prisma_init":
      return {
        errorKind: "prisma_init",
        title: "Database connection failed",
        message: input.message,
        remediation: [
          "Set DATABASE_URL in .env or .env.local (same folder as package.json).",
          "Confirm Postgres is running and reachable from this machine.",
          "Restart `npm run dev` after changing env files.",
        ],
        tone: "red",
      };
    case "missing_database_url":
      return {
        errorKind: "missing_database_url",
        title: "Missing DATABASE_URL",
        message: input.message,
        remediation: [
          "Add DATABASE_URL=… to .env or .env.local.",
          "Restart the dev server after editing env files.",
        ],
        tone: "amber",
      };
    case "invariant":
      return {
        errorKind: "invariant",
        title: `Invariant violation: ${input.code}`,
        message: input.message,
        remediation: [
          "This is a server-side invariant — the read refused to return data because state would be inconsistent.",
          "Inspect the context blob below and the matching canon document; do not patch around it in the UI.",
        ],
        tone: "red",
        code: input.code,
        ...(input.context !== undefined ? { context: input.context } : {}),
      };
    case "unknown":
      return {
        errorKind: "unknown",
        title: "Unexpected workspace load error",
        message: input.message || "An unknown error occurred while loading the quote workspace.",
        remediation: [
          "Check the dev server logs for a stack trace.",
          "Reload the page; if the error reproduces, capture the stack and the URL before reporting.",
        ],
        tone: "red",
      };
  }
}

/* ---------------- Readiness input mapper ---------------- */

/**
 * Typed mapper from a workspace head version row + line item count to the
 * input shape consumed by `deriveQuoteHeadWorkspaceReadiness`. Replaces an
 * `any`-typed inline mapper in the page; locks the field set so a future
 * change to either side fails the typechecker rather than silently passing
 * `undefined`.
 */
export function toQuoteHeadReadinessInput(
  head: QuoteVersionHistoryItemDto,
  lineItemCount: number,
): QuoteHeadReadinessInput {
  return {
    id: head.id,
    versionNumber: head.versionNumber,
    status: head.status,
    lineItemCount,
    hasPinnedWorkflow: head.hasPinnedWorkflow,
    hasFrozenArtifacts: head.hasFrozenArtifacts,
    hasActivation: head.hasActivation,
    proposalGroupCount: head.proposalGroupCount,
    sentAt: head.sentAt,
    signedAt: head.signedAt,
  };
}

/* ---------------- Head-draft pipeline targets ---------------- */

export type HeadDraftPinTarget = {
  quoteVersionId: string;
  versionNumber: number;
  pinnedWorkflowVersionId: string | null;
};

export type HeadDraftWorkspaceTarget = {
  quoteVersionId: string;
  versionNumber: number;
  hasPinnedWorkflow: boolean;
};

export type HeadDraftPipelineTargets = {
  pinTarget: HeadDraftPinTarget | null;
  workspaceTarget: HeadDraftWorkspaceTarget | null;
};

/**
 * Pin (step 2) and compose/send (step 3) targets are only valid when the
 * head version is `DRAFT`. Returns `null` for both when the head is null
 * or in any other status — the corresponding pipeline panels render their
 * own "no eligible draft" copy.
 *
 * Centralizing the gate makes it impossible to leak a pin/compose action
 * onto a sent or signed head by accident in a future page edit.
 */
export function deriveHeadDraftPipelineTargets(
  head: QuoteVersionHistoryItemDto | null,
): HeadDraftPipelineTargets {
  if (!head || head.status !== "DRAFT") {
    return { pinTarget: null, workspaceTarget: null };
  }
  return {
    pinTarget: {
      quoteVersionId: head.id,
      versionNumber: head.versionNumber,
      pinnedWorkflowVersionId: head.pinnedWorkflowVersionId,
    },
    workspaceTarget: {
      quoteVersionId: head.id,
      versionNumber: head.versionNumber,
      hasPinnedWorkflow: head.hasPinnedWorkflow,
    },
  };
}

/* ---------------- Execution bridge data ---------------- */

export type ExecutionBridgeDerivationInput = {
  /** From `deriveNewestActivatedExecutionEntryTarget`. */
  executionEntryTarget: ActivatedExecutionEntryTarget | null;
  /** Route param so the bridge can link back to the quote workspace. */
  quoteId: string;
  /** From the workspace read model — may be null when no job is anchored. */
  jobId: string | null;
};

/**
 * Builds the execution bridge data the bridge component renders.
 *
 * NOTE: `flowId`, `activationId`, `activatedAtIso`, and `runtimeTaskCount`
 * are intentionally `null` at this layer — the workspace read model does
 * not yet surface them. The bridge component already renders the null-flow
 * branch ("Flow record not linked"). When the workspace read is extended
 * to carry these, only this helper changes; the page does not.
 */
export function deriveExecutionBridgeData(
  input: ExecutionBridgeDerivationInput,
): ExecutionBridgeData {
  if (!input.executionEntryTarget) {
    return { kind: "none" };
  }
  return {
    kind: "linked",
    quoteId: input.quoteId,
    quoteVersionId: input.executionEntryTarget.quoteVersionId,
    versionNumber: input.executionEntryTarget.versionNumber,
    flowId: null,
    jobId: input.jobId,
    activationId: null,
    activatedAtIso: null,
    runtimeTaskCount: null,
  };
}
