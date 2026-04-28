import type { QuoteVersionCompareToPriorDto } from "@/server/slice1/reads/quote-version-history-reads";

function signedDelta(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? `+${String(n)}` : String(n);
}

/** Default table column: line/group deltas only (no lock or plan internals). */
export function quoteVersionCompareToPriorPlain(c: QuoteVersionCompareToPriorDto): string {
  return `vs v${String(c.priorVersionNumber)}: lines ${signedDelta(c.lineItemCountDelta)}, groups ${signedDelta(
    c.proposalGroupCountDelta,
  )}`;
}

/** Advanced/support-only: technical comparison vs prior revision. */
export function quoteVersionCompareToPriorTechnical(c: QuoteVersionCompareToPriorDto): string {
  const parts: string[] = [quoteVersionCompareToPriorPlain(c)];
  if (c.frozenPlanAndPackageIdentical === true) {
    parts.push("send-time plan+package hashes match");
  } else if (c.frozenPlanAndPackageIdentical === false) {
    parts.push("send-time plan/package hashes differ");
  } else {
    parts.push("freeze hash compare n/a");
  }
  parts.push(c.pinnedWorkflowVersionIdMatch ? "same template pin" : "template pin changed");
  return parts.join(" · ");
}
