/**
 * Pure helpers for the `/dev/quote-scope/[quoteVersionId]` page.
 *
 * Two responsibility groups:
 *
 *   1. Shared presentation primitives (auth-failure + page-load-error) are
 *      re-exported from the adjacent workspace helper. Both internal quote
 *      pages render identical operator-facing copy and remediation lists for
 *      the same `ResolvePrincipalFailure` kinds and the same DB / invariant
 *      classes — single source of truth, no parallel drift.
 *
 *   2. Pure scope helpers (line-item grouping, version-context banner) now
 *      live under `src/lib/quote-scope/` so the office scope editor can
 *      consume them without any `/dev/...` import. They are re-exported here
 *      so the dev page (and its tests) keep their existing import paths.
 *
 *   3. Quick-jump links remain dev-specific (their hrefs target `/dev/...`),
 *      so they stay in this file.
 *
 * The page component stays a thin server-rendered shell that calls these
 * helpers and renders. Auth/tenant/capability gates remain enforced
 * server-side; nothing here weakens them.
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
import type { QuoteVersionLifecycleApiDto } from "@/lib/quote-version-lifecycle-dto";

/* ---------------- Shared presentation re-exports ---------------- */

export type {
  AuthFailurePresentation,
  WorkspaceLoadErrorInput as InternalLoadErrorInput,
  WorkspaceLoadErrorPresentation as InternalLoadErrorPresentation,
};

export const presentAuthFailure = presentAuthFailureShared;
/**
 * Re-export under a surface-agnostic name. Body and contract are unchanged.
 * The page renders `errorKind` / `code` / `tone` exactly as the workspace
 * page does, so the same fix instructions show up in either context.
 */
export const presentInternalLoadError = presentWorkspaceLoadErrorShared;

/* ---------------- Shared scope helpers (re-exports) ---------------- */

// Pure helpers and types now live under `src/lib/quote-scope/` so they can
// be consumed by the office scope editor without any `/dev/...` dependency.
// Re-exported here unchanged so the dev page and its tests keep working
// against their existing import paths.
export {
  groupQuoteScopeLineItemsByProposalGroup,
  deriveScopeVersionContext,
} from "@/lib/quote-scope/quote-scope-grouping";
export type {
  ScopeProposalGroupForGrouping,
  ScopeLineItemForGrouping,
  ScopeProposalGroupWithItems,
  ScopeGroupingResult,
  ScopeVersionContextInput,
  ScopeVersionContext,
} from "@/lib/quote-scope/quote-scope-grouping";

/* ---------------- Quick-jump links (dev-only chrome) ---------------- */

export type ScopeQuickJumpLink = {
  label: string;
  href: string;
  variant?: "sky" | "emerald";
};

export type ScopeQuickJumpInput = {
  /** Quote workspace target (always present). */
  quoteId: string;
  /** Lifecycle DTO when the lifecycle read succeeded; null otherwise. */
  lifecycle: Pick<QuoteVersionLifecycleApiDto, "flow" | "job"> | null;
};

/**
 * Deterministic quick-jump strip for the scope page.
 *
 * Order is fixed so the same operator action stays in the same place across
 * different scope versions:
 *   1. Quote workspace (sky, primary)
 *   2. All quotes
 *   3. Customers
 *   4. Flow groups
 *   5. Flow detail (only if lifecycle.flow is present)
 *   6. Job anchor (emerald, only if lifecycle.job is present)
 */
export function buildQuoteScopeQuickJumpLinks(input: ScopeQuickJumpInput): ScopeQuickJumpLink[] {
  const links: ScopeQuickJumpLink[] = [
    { label: "Quote workspace", href: `/dev/quotes/${input.quoteId}`, variant: "sky" },
    { label: "All quotes", href: "/dev/quotes" },
    { label: "Customers", href: "/dev/customers" },
    { label: "Flow groups", href: "/dev/flow-groups" },
  ];
  if (input.lifecycle?.flow) {
    links.push({ label: "Flow detail", href: `/dev/flow/${input.lifecycle.flow.id}` });
  }
  if (input.lifecycle?.job) {
    links.push({
      label: "Job anchor",
      href: `/dev/jobs/${input.lifecycle.job.id}`,
      variant: "emerald",
    });
  }
  return links;
}
