/**
 * Pure helpers for any quote-scope authoring/viewing surface (dev or office).
 *
 *   1. `groupQuoteScopeLineItemsByProposalGroup` — bucket line items into the
 *      proposal groups they belong to, preserving input order, surfacing any
 *      orphaned items rather than silently dropping them.
 *
 *   2. `deriveScopeVersionContext` — operator-facing classification of "what
 *      version am I looking at and what can I do here?" (latest_draft /
 *      older_draft / frozen_latest / frozen_older / unknown_status_*).
 *
 * Both are pure (no React, no fetch, no Prisma) and lock the UX contract
 * shared by the dev quote-scope page and the office scope editor. Lives under
 * `src/lib/quote-scope/` so office surfaces never need to import from
 * `/dev/...`.
 */

import type { QuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";

/* ---------------- Scope line-item grouping ---------------- */

/**
 * Subset of `QuoteVersionScopeApiDto["proposalGroups"][number]` we need for
 * grouping. Loose-typed at the boundary so the helper is independent of
 * future DTO field additions.
 */
export type ScopeProposalGroupForGrouping = {
  id: string;
  name: string;
  sortOrder: number;
};

/**
 * Subset of `QuoteVersionScopeApiDto["orderedLineItems"][number]` we need.
 * Keeping it minimal lets the helper accept tests without manufacturing
 * every DTO field, while still being assignable from the real DTO row.
 */
export type ScopeLineItemForGrouping = {
  id: string;
  proposalGroupId: string;
};

export type ScopeProposalGroupWithItems<TGroup extends ScopeProposalGroupForGrouping, TItem extends ScopeLineItemForGrouping> =
  TGroup & { items: TItem[] };

export type ScopeGroupingResult<TGroup extends ScopeProposalGroupForGrouping, TItem extends ScopeLineItemForGrouping> = {
  /** Groups in input order, each carrying its bucketed items in input order. */
  groupsWithItems: ScopeProposalGroupWithItems<TGroup, TItem>[];
  /**
   * Items whose `proposalGroupId` did not match any group in `groups`.
   * Should always be empty for a healthy DTO; rendered as an explicit
   * warning panel rather than silently swallowed.
   */
  orphanedItems: TItem[];
};

/**
 * Bucket `orderedItems` into their owning groups.
 *
 * Contract:
 *   - Groups appear in input order; items within each group keep input order.
 *   - Items whose `proposalGroupId` does not match a group are returned as
 *     `orphanedItems` (NOT silently dropped, NOT thrown). The page renders a
 *     warning when non-empty so a future DTO drift is loud, not invisible.
 *   - No item is duplicated and no item is dropped: the union of bucketed
 *     items + orphaned items has the same length as `orderedItems`.
 */
export function groupQuoteScopeLineItemsByProposalGroup<
  TGroup extends ScopeProposalGroupForGrouping,
  TItem extends ScopeLineItemForGrouping,
>(
  groups: readonly TGroup[],
  orderedItems: readonly TItem[],
): ScopeGroupingResult<TGroup, TItem> {
  const groupIndexById = new Map<string, number>();
  const buckets: TItem[][] = groups.map(() => []);
  groups.forEach((g, i) => groupIndexById.set(g.id, i));

  const orphanedItems: TItem[] = [];
  for (const item of orderedItems) {
    const idx = groupIndexById.get(item.proposalGroupId);
    if (idx === undefined) {
      orphanedItems.push(item);
      continue;
    }
    const bucket = buckets[idx];
    if (bucket) bucket.push(item);
  }

  const groupsWithItems = groups.map((g, i) => {
    const items: TItem[] = buckets[i] ?? [];
    return { ...g, items } as ScopeProposalGroupWithItems<TGroup, TItem>;
  });

  return { groupsWithItems, orphanedItems };
}

/* ---------------- Version context banner ---------------- */

/**
 * Operator-facing classification of "what version am I looking at and what
 * can I do here?". Drives a small banner above the scope tables so the
 * operator can tell at a glance whether this is the live editable head, an
 * older draft, or a sent/signed snapshot.
 */
export type ScopeVersionContextInput = {
  /** Status from the scope read model (DRAFT / SENT / SIGNED / etc.). */
  status: QuoteVersionScopeApiDto["quoteVersion"]["status"];
  /** True when the loaded version id equals the workspace's `latestQuoteVersionId`. */
  isLatest: boolean;
  /** versionNumber of the loaded version. */
  versionNumber: number;
};

export type ScopeVersionContext = {
  /** Tag operators can grep ("latest_draft", "older_draft", "frozen_latest", …). */
  kind:
    | "latest_draft"
    | "older_draft"
    | "frozen_latest"
    | "frozen_older"
    | "unknown_status_latest"
    | "unknown_status_older";
  tone: "emerald" | "amber" | "zinc";
  title: string;
  message: string;
};

export function deriveScopeVersionContext(input: ScopeVersionContextInput): ScopeVersionContext {
  const isDraft = input.status === "DRAFT";
  const isFrozen =
    input.status === "SENT" ||
    input.status === "SIGNED" ||
    input.status === "DECLINED" ||
    input.status === "VOID" ||
    input.status === "SUPERSEDED";

  if (isDraft && input.isLatest) {
    return {
      kind: "latest_draft",
      tone: "emerald",
      title: `Editable head · v${input.versionNumber} (DRAFT)`,
      message:
        "This is the head draft. Scope edits made here apply to the working version of the quote.",
    };
  }
  if (isDraft && !input.isLatest) {
    return {
      kind: "older_draft",
      tone: "amber",
      title: `Older draft · v${input.versionNumber} (DRAFT)`,
      message:
        "This is an older draft of the quote. The head version is newer; mutations here may not be the right target. Open the quote workspace to act on the head.",
    };
  }
  if (isFrozen && input.isLatest) {
    return {
      kind: "frozen_latest",
      tone: "amber",
      title: `Read-only head · v${input.versionNumber} (${input.status})`,
      message:
        "This is the head version, but it has been frozen by send/sign. Open the workspace to create a new draft revision before editing scope.",
    };
  }
  if (isFrozen && !input.isLatest) {
    return {
      kind: "frozen_older",
      tone: "zinc",
      title: `Historical · v${input.versionNumber} (${input.status})`,
      message:
        "Read-only snapshot of an older sent/signed version. Used for audit and reference; not the editable head.",
    };
  }
  if (input.isLatest) {
    return {
      kind: "unknown_status_latest",
      tone: "amber",
      title: `Head version · v${input.versionNumber} (${input.status})`,
      message:
        "Status is not one of the canon-recognised values (DRAFT/SENT/SIGNED). Treat lifecycle reads as the source of truth.",
    };
  }
  return {
    kind: "unknown_status_older",
    tone: "amber",
    title: `Older version · v${input.versionNumber} (${input.status})`,
    message:
      "Older version with an unrecognised status. Treat lifecycle reads as the source of truth.",
  };
}
