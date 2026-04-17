/**
 * Picks the quote version row to use as the workspace **execution bridge** anchor.
 * `versions` must be **newest-first** (same contract as workspace / history APIs).
 */

export type VersionRowForExecutionEntry = {
  id: string;
  versionNumber: number;
  hasActivation: boolean;
};

export type ActivatedExecutionEntryTarget = {
  quoteVersionId: string;
  versionNumber: number;
};

/**
 * **Rule:** first row with `hasActivation === true` in newest-first order = **highest `versionNumber`**
 * among versions that have an activation. Used only for navigation/summary — task execution stays on flow/work-feed APIs.
 */
export function deriveNewestActivatedExecutionEntryTarget(
  versionsOrderedNewestFirst: VersionRowForExecutionEntry[],
): ActivatedExecutionEntryTarget | null {
  const row = versionsOrderedNewestFirst.find((v) => v.hasActivation);
  if (!row) {
    return null;
  }
  return { quoteVersionId: row.id, versionNumber: row.versionNumber };
}
