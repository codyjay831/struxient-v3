/**
 * Chooses which quote version is the workspace **sign** candidate from version history.
 * History is expected **newest-first** (same as `GET …/workspace` / `…/versions`).
 */

export type VersionRowForSign = {
  id: string;
  versionNumber: number;
  status: string;
  portalQuoteShareToken?: string | null;
};

export type SentSignTarget = {
  quoteVersionId: string;
  versionNumber: number;
  /** Present after Epic 54 send; build `/portal/quotes/{token}`. */
  portalQuoteShareToken: string | null;
};

/**
 * **Rule:** the first row with `status === "SENT"` in newest-first order — i.e. the **highest `versionNumber`**
 * among SENT rows. This is explicit when the head is still `DRAFT` and an older row is `SENT`.
 * If there is no `SENT` row, signing from this workspace surface is not offered.
 */
export function deriveNewestSentSignTarget(
  versionsOrderedNewestFirst: VersionRowForSign[],
): SentSignTarget | null {
  const row = versionsOrderedNewestFirst.find((v) => v.status === "SENT");
  if (!row) {
    return null;
  }
  return {
    quoteVersionId: row.id,
    versionNumber: row.versionNumber,
    portalQuoteShareToken: row.portalQuoteShareToken ?? null,
  };
}

/** Subset of workspace/history version row used for portal-decline office visibility. */
export type VersionRowForPortalDecline = {
  id: string;
  versionNumber: number;
  status: string;
  portalQuoteShareToken?: string | null;
  portalDeclinedAt: string | null;
  portalDeclineReason: string | null;
};

export type PortalDeclinedSummary = {
  quoteVersionId: string;
  versionNumber: number;
  portalDeclinedAtIso: string;
  portalDeclineReason: string;
  portalQuoteShareToken: string | null;
};

/**
 * Newest-first: first **DECLINED** row with persisted decline metadata (portal path).
 */
export function deriveNewestPortalDeclinedSummary(
  versionsOrderedNewestFirst: VersionRowForPortalDecline[],
): PortalDeclinedSummary | null {
  const row = versionsOrderedNewestFirst.find(
    (v) =>
      v.status === "DECLINED" &&
      v.portalDeclinedAt != null &&
      v.portalDeclinedAt !== "" &&
      (v.portalDeclineReason?.trim().length ?? 0) > 0,
  );
  if (!row?.portalDeclinedAt || !row.portalDeclineReason) {
    return null;
  }
  return {
    quoteVersionId: row.id,
    versionNumber: row.versionNumber,
    portalDeclinedAtIso: row.portalDeclinedAt,
    portalDeclineReason: row.portalDeclineReason,
    portalQuoteShareToken: row.portalQuoteShareToken ?? null,
  };
}
