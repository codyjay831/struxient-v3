/**
 * Pure summary helpers for the catalog packet read-only inspector.
 *
 * Lives in src/lib so it can be unit-tested without Prisma. The reads layer
 * (src/server/slice1/reads/scope-packet-catalog-reads.ts) loads minimal rows
 * and uses these helpers to derive list-level counts and "latest published"
 * pointers without any tenant/runtime logic.
 *
 * This module is read-only: it never mutates input arrays or rows.
 *
 * Canon refs: docs/canon/05-packet-canon.md, docs/epics/15-scope-packets-epic.md.
 */

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export type ScopePacketRevisionForSummary = {
  id: string;
  revisionNumber: number;
  status: "DRAFT" | "PUBLISHED";
  /**
   * Nullable for DRAFT revisions produced by the interim one-step promotion
   * flow. PUBLISHED revisions still carry a Date; the "latest published"
   * pointer below only ever inspects PUBLISHED rows so the null branch is
   * never reached for them.
   *
   * Canon: docs/canon/05-packet-canon.md (Canon amendment — interim promotion).
   */
  publishedAt: Date | null;
};

export type ScopePacketRevisionsSummary = {
  revisionCount: number;
  publishedRevisionCount: number;
  latestPublishedRevisionId: string | null;
  latestPublishedRevisionNumber: number | null;
  latestPublishedAtIso: string | null;
};

/**
 * Computes counts and the "latest published" pointer for a packet's revisions.
 * "Latest" is determined by the highest `revisionNumber` among `PUBLISHED`
 * rows, matching the unique `(scopePacketId, revisionNumber)` constraint.
 * Ties (same revisionNumber) are broken by `id` ascending for determinism;
 * the schema unique constraint should make ties impossible in practice.
 */
export function summarizeScopePacketRevisions(
  revisions: ReadonlyArray<ScopePacketRevisionForSummary>,
): ScopePacketRevisionsSummary {
  const revisionCount = revisions.length;
  let publishedRevisionCount = 0;
  let latest: ScopePacketRevisionForSummary | null = null;

  for (const rev of revisions) {
    if (rev.status !== "PUBLISHED") continue;
    publishedRevisionCount++;
    if (latest === null) {
      latest = rev;
      continue;
    }
    if (rev.revisionNumber > latest.revisionNumber) {
      latest = rev;
      continue;
    }
    if (rev.revisionNumber === latest.revisionNumber && rev.id < latest.id) {
      latest = rev;
    }
  }

  return {
    revisionCount,
    publishedRevisionCount,
    latestPublishedRevisionId: latest?.id ?? null,
    latestPublishedRevisionNumber: latest?.revisionNumber ?? null,
    latestPublishedAtIso: latest?.publishedAt?.toISOString() ?? null,
  };
}

/**
 * Clamps a `?limit=` query string for the catalog packet list to a safe range.
 * Mirrors the pattern used by `clampTaskDefinitionListLimit` so the inspector
 * cannot be turned into an unbounded data dump.
 */
export function clampScopePacketListLimit(raw: string | null): number {
  if (raw == null || raw === "") return DEFAULT_LIST_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIST_LIMIT;
  return Math.min(n, MAX_LIST_LIMIT);
}

export const SCOPE_PACKET_LIST_LIMIT_DEFAULTS = {
  default: DEFAULT_LIST_LIMIT,
  max: MAX_LIST_LIMIT,
} as const;
