import type { ComposePreviewValidationClientItem } from "@/lib/workspace/quote-workspace-compose-preview-client-types";

/** Server message from `compose-engine.ts` for quote-local tier expansion. */
export const EXPANSION_EMPTY_QUOTE_LOCAL_MESSAGE =
  "After tier filter, quote-local packet yields no items for this manifest line.";

export type ComposeLineIssueForMapping = Pick<
  ComposePreviewValidationClientItem,
  "code" | "message" | "lineItemId"
>;

export type LineComposeBlockerBannerModel = {
  contractorTitle: string;
  contractorBody: string;
  actionLabel: string;
  actionHref: string;
  /** Shown under the action link as quiet guidance. */
  actionHelper?: string;
  /** Primary technical row (always shown inside Technical details). */
  technicalCode: string;
  technicalMessage: string;
  /** Additional blocking issues on the same line (codes + messages only). */
  additionalTechnical?: { code: string; message: string }[];
  /** When true, surface Technical details disclosure on the line card. */
  showTechnicalDetails: boolean;
};

function isExpansionEmptyQuoteLocalIssue(issue: ComposeLineIssueForMapping): boolean {
  if (issue.code !== "EXPANSION_EMPTY") return false;
  const m = issue.message.trim();
  return m === EXPANSION_EMPTY_QUOTE_LOCAL_MESSAGE || m.includes("quote-local packet yields no items");
}

/**
 * Single-issue mapping. Unknown line-attached issues get a generic contractor summary;
 * technical code/message are always preserved for support.
 */
export function mapComposeLineBlockingIssueToBanner(
  quoteId: string,
  lineItemId: string,
  issue: ComposeLineIssueForMapping,
): LineComposeBlockerBannerModel {
  const actionHref = `/quotes/${encodeURIComponent(quoteId)}#line-item-${encodeURIComponent(lineItemId)}`;

  if (isExpansionEmptyQuoteLocalIssue(issue)) {
    return {
      contractorTitle: "Line needs crew tasks",
      contractorBody:
        "This line has no crew tasks for the selected tier. Add matching tasks, change the tier, or turn this into an estimate-only line before sending.",
      actionLabel: "Jump to line",
      actionHref,
      actionHelper: "Edit this line in step 1 to fix crew work or change it to estimate-only.",
      technicalCode: issue.code,
      technicalMessage: issue.message,
      showTechnicalDetails: true,
    };
  }

  return {
    contractorTitle: "Line needs attention",
    contractorBody:
      "This line is blocking the proposal from being sent. Review the send preview for details.",
    actionLabel: "Jump to line",
    actionHref,
    technicalCode: issue.code,
    technicalMessage: issue.message,
    showTechnicalDetails: true,
  };
}

/** Prefer EXPANSION_EMPTY (quote-local) first, then stable by code. */
export function sortComposeBlockingIssuesForLine(
  issues: ComposeLineIssueForMapping[],
): ComposeLineIssueForMapping[] {
  return [...issues].sort((a, b) => {
    const r = (x: ComposeLineIssueForMapping) => (isExpansionEmptyQuoteLocalIssue(x) ? 0 : 1);
    const d = r(a) - r(b);
    if (d !== 0) return d;
    return a.code.localeCompare(b.code) || a.message.localeCompare(b.message);
  });
}

export function groupComposeBlockingErrorsByLineItemId(
  errors: ComposePreviewValidationClientItem[],
): Record<string, ComposePreviewValidationClientItem[]> {
  const out: Record<string, ComposePreviewValidationClientItem[]> = {};
  for (const e of errors) {
    const id = e.lineItemId;
    if (!id) continue;
    if (!out[id]) out[id] = [];
    out[id].push(e);
  }
  return out;
}

/**
 * Build one banner for a line from one or more blocking compose errors.
 * Only errors with `lineItemId` should be passed in `issues` (same id).
 */
export function buildLineComposeBlockerBanner(
  quoteId: string,
  lineItemId: string,
  issues: ComposePreviewValidationClientItem[],
): LineComposeBlockerBannerModel | null {
  if (issues.length === 0) return null;
  const sorted = sortComposeBlockingIssuesForLine(issues);
  const primary = sorted[0]!;
  const base = mapComposeLineBlockingIssueToBanner(quoteId, lineItemId, primary);
  const rest = sorted.slice(1);
  if (rest.length === 0) return base;

  return {
    ...base,
    contractorBody:
      base.contractorBody +
      "\n\nThere is another issue on this line — see Technical details for the full list.",
    additionalTechnical: rest.map((r) => ({ code: r.code, message: r.message })),
  };
}
