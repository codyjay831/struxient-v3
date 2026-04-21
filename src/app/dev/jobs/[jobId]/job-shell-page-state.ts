/**
 * Pure helpers for the `/dev/jobs/[jobId]` job-anchor page.
 *
 * Two responsibility groups (same pattern as `/dev/quote-scope/[quoteVersionId]`):
 *
 *   1. Shared presentation primitives (auth-failure + page-load-error) are
 *      re-exported from the workspace helper. The job-shell page renders the
 *      same operator-facing copy and remediation lists for the same
 *      `ResolvePrincipalFailure` kinds and the same DB / invariant classes
 *      as the workspace and scope pages — single source of truth, no parallel
 *      drift across surfaces.
 *
 *   2. Job-shell specific derivations (timestamp formatting, per-flow
 *      execution rollup, header context) live in the surface-agnostic
 *      `@/lib/jobs/job-shell-summary` module so the office job surfaces can
 *      consume the same canon helpers without importing from `/dev/...`. The
 *      symbols are re-exported here so the dev page and the existing tests
 *      in `./job-shell-page-state.test.ts` keep working untouched.
 *
 * Quick-jump links remain dev-specific: the link targets are the `/dev/*`
 * discovery surfaces that office does not have an equivalent for yet.
 */

import type {
  AuthFailurePresentation,
  WorkspaceLoadErrorInput,
  WorkspaceLoadErrorPresentation,
} from "@/app/dev/quotes/[quoteId]/quote-workspace-page-state";
import {
  presentAuthFailure as presentAuthFailureShared,
  presentWorkspaceLoadError as presentWorkspaceLoadErrorShared,
} from "@/app/dev/quotes/[quoteId]/quote-workspace-page-state";
import type { JobShellFlowApiDto } from "@/lib/job-shell-dto";

/* ---------------- Shared presentation re-exports ---------------- */

export type {
  AuthFailurePresentation,
  WorkspaceLoadErrorInput as JobShellLoadErrorInput,
  WorkspaceLoadErrorPresentation as JobShellLoadErrorPresentation,
};

export const presentAuthFailure = presentAuthFailureShared;
/**
 * Re-export under a surface-agnostic name. Body and contract are unchanged.
 * The page renders `errorKind` / `code` / `tone` exactly as the workspace
 * and scope pages do, so the same fix instructions show up in either context.
 */
export const presentJobShellLoadError = presentWorkspaceLoadErrorShared;

/* ---------------- Canon helpers (re-exported from `@/lib/jobs/...`) ---------------- */

export {
  formatJobTimestamp,
  summarizeFlowRuntimeTasks,
  deriveJobHeaderContext,
} from "@/lib/jobs/job-shell-summary";
export type {
  FlowForRuntimeSummary,
  FlowRuntimeSummary,
  JobHeaderContext,
} from "@/lib/jobs/job-shell-summary";

/* ---------------- Quick-jump links (dev-only) ---------------- */

export type JobShellQuickJumpLink = {
  label: string;
  href: string;
  variant?: "sky" | "emerald";
};

export type JobShellQuickJumpInput = {
  /** Job id, used to round-trip the operator back to this page from related views. */
  jobId: string;
  /**
   * Newest flow on this job (by `createdAt`), or null when the job has no
   * flows yet (jobs are created at SIGN; flows only appear after activation).
   * Used to expose a primary work-feed entry without forcing the operator to
   * read the flow list when there is exactly one obvious candidate.
   */
  newestFlow: Pick<JobShellFlowApiDto, "id" | "quoteId"> | null;
};

/**
 * Deterministic quick-jump strip for the `/dev/jobs/[jobId]` page. Targets
 * the `/dev/*` discovery surfaces — office has its own navigation chrome and
 * does not consume this helper.
 *
 * Order is fixed so the same operator action stays in the same place across
 * different jobs:
 *   1. All jobs (always)
 *   2. Activated flows (always)
 *   3. Customers (always)
 *   4. Flow groups (always)
 *   5. Open work feed (emerald, only when the job has a newest flow)
 *   6. Quote workspace (sky, only when the job has a newest flow)
 *
 * The (5) and (6) entries are intentionally only emitted when there is a
 * concrete flow to point at — otherwise we'd link to `/dev/work-feed/null`
 * or guess at a quote id.
 */
export function buildJobShellQuickJumpLinks(
  input: JobShellQuickJumpInput,
): JobShellQuickJumpLink[] {
  const links: JobShellQuickJumpLink[] = [
    { label: "All jobs", href: "/dev/jobs" },
    { label: "Activated flows", href: "/dev/flows" },
    { label: "Customers", href: "/dev/customers" },
    { label: "Flow groups", href: "/dev/flow-groups" },
  ];
  if (input.newestFlow) {
    links.push({
      label: "Open work feed",
      href: `/dev/work-feed/${input.newestFlow.id}`,
      variant: "emerald",
    });
    links.push({
      label: "Quote workspace",
      href: `/dev/quotes/${input.newestFlow.quoteId}`,
      variant: "sky",
    });
  }
  return links;
}
