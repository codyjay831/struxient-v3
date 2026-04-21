/**
 * Pure diagnostic helper for compose-preview tier filtering.
 *
 * Detects the silent-mismatch case where a manifest line's tier filter excludes
 * SOME, but not ALL, candidate packet rows. Used only to emit an additive
 * compose warning (`PACKET_ITEMS_FILTERED_BY_TIER`); does NOT change inclusion
 * or exclusion behavior, and does NOT change tier-matching semantics.
 *
 * Lives in src/lib so it can be unit-tested without Prisma. The compose engine
 * (src/server/slice1/compose-preview/compose-engine.ts) calls it after each
 * `tierFilterInclude` filter pass.
 */

const SAMPLE_TIER_CODE_LIMIT = 5;

export type TierFilterDiagnosticsItem = { tierCode: string | null };

export type TierPartialExclusionSummary = {
  excludedCount: number;
  includedCount: number;
  /**
   * Up to SAMPLE_TIER_CODE_LIMIT distinct, non-blank tier codes from excluded
   * candidates, sorted lexicographically. Useful for diagnosing typo / casing
   * mismatches. Excluded items always have a non-blank tier code because items
   * with blank tier match every line tier under existing semantics.
   */
  sampleExcludedTierCodes: string[];
};

/**
 * Returns a partial-exclusion summary when filtering removed some but not all
 * candidates. Returns null when:
 *   - no candidates were filtered out (everything included), OR
 *   - all candidates were filtered out (already covered by EXPANSION_EMPTY), OR
 *   - there were no candidates at all.
 *
 * `filtered` MUST be a subset of `candidates` produced by `Array.filter` on the
 * same array (object identity is used to detect excluded entries).
 */
export function summarizeTierPartialExclusion(args: {
  candidates: ReadonlyArray<TierFilterDiagnosticsItem>;
  filtered: ReadonlyArray<TierFilterDiagnosticsItem>;
}): TierPartialExclusionSummary | null {
  const candidatesCount = args.candidates.length;
  const includedCount = args.filtered.length;

  if (candidatesCount === 0) return null;
  if (includedCount === 0) return null;
  if (includedCount === candidatesCount) return null;

  const includedSet = new Set<TierFilterDiagnosticsItem>(args.filtered);
  const excludedTiers = new Set<string>();
  for (const c of args.candidates) {
    if (includedSet.has(c)) continue;
    if (c.tierCode != null && c.tierCode !== "") {
      excludedTiers.add(c.tierCode);
    }
  }

  const sampleExcludedTierCodes = [...excludedTiers]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, SAMPLE_TIER_CODE_LIMIT);

  return {
    excludedCount: candidatesCount - includedCount,
    includedCount,
    sampleExcludedTierCodes,
  };
}
