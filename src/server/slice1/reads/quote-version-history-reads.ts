import type { PrismaClient, QuoteVersionStatus } from "@prisma/client";

/**
 * High-level, truthful compare of this revision to the **immediately older** `QuoteVersion`
 * (`versionNumber - 1`). Same ordering as history: `versions[i]` is newer than `versions[i+1]`.
 *
 * Not a line-item diff: counts and send-time snapshot hash equality only (Epic 14 slice).
 */
export type QuoteVersionCompareToPriorDto = {
  priorVersionId: string;
  priorVersionNumber: number;
  /** This row's line count minus the older row's (`current − prior`). */
  lineItemCountDelta: number;
  /** This row's proposal group count minus the older row's. */
  proposalGroupCountDelta: number;
  /**
   * `true` when both rows have non-null plan **and** package snapshot hashes and both pairs match.
   * `false` when both have full hashes and any hash differs.
   * `null` when either row is missing plan or package hash — no freeze-identity claim.
   */
  frozenPlanAndPackageIdentical: boolean | null;
  /** `pinnedWorkflowVersionId` equal on both rows (including both `null`). */
  pinnedWorkflowVersionIdMatch: boolean;
};

/**
 * One row per `QuoteVersion`, ordered by `versionNumber` **descending** (highest / newest first).
 * Use `id` with existing routes: `/api/quote-versions/{id}/scope`, `…/lifecycle`, `…/freeze`, etc.
 */
export type QuoteVersionHistoryItemDto = {
  id: string;
  versionNumber: number;
  status: QuoteVersionStatus;
  createdAt: string;
  sentAt: string | null;
  signedAt: string | null;
  title: string | null;
  /** Tenant workflow version id when pinned; same row as `hasPinnedWorkflow`. */
  pinnedWorkflowVersionId: string | null;
  /** Pinned workflow is set (compose/send prerequisites in later flows). */
  hasPinnedWorkflow: boolean;
  /** Plan or package snapshot hash recorded (freeze package path). */
  hasFrozenArtifacts: boolean;
  proposalGroupCount: number;
  /** Count of line items on this version (office compare / history). */
  lineItemCount: number;
  /** An `Activation` row exists for this version (post-activate path). */
  hasActivation: boolean;
  /** Customer portal link segment after send (Epic 54); null before first send or legacy rows. */
  portalQuoteShareToken: string | null;
  /** Present when status is VOID (Epic 14). */
  voidedAt: string | null;
  voidReason: string | null;
  /**
   * Compare to the next row in `versions` (older `versionNumber`), or `null` for the oldest row.
   */
  compareToPrior: QuoteVersionCompareToPriorDto | null;
};

export type QuoteVersionHistoryReadDto = {
  quoteId: string;
  quoteNumber: string;
  versions: QuoteVersionHistoryItemDto[];
};

/** Shared mapper for history + workspace reads (same select shape). */
export function mapQuoteVersionRowToHistoryItem(row: {
  id: string;
  versionNumber: number;
  status: QuoteVersionStatus;
  createdAt: Date;
  sentAt: Date | null;
  signedAt: Date | null;
  title: string | null;
  pinnedWorkflowVersionId: string | null;
  planSnapshotSha256: string | null;
  packageSnapshotSha256: string | null;
  activation: { id: string } | null;
  _count: { proposalGroups: number; quoteLineItems: number };
  portalQuoteShareToken: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
}): QuoteVersionHistoryItemDto {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    signedAt: row.signedAt?.toISOString() ?? null,
    title: row.title,
    pinnedWorkflowVersionId: row.pinnedWorkflowVersionId,
    hasPinnedWorkflow: row.pinnedWorkflowVersionId != null,
    hasFrozenArtifacts: row.planSnapshotSha256 != null || row.packageSnapshotSha256 != null,
    proposalGroupCount: row._count.proposalGroups,
    lineItemCount: row._count.quoteLineItems,
    hasActivation: row.activation != null,
    portalQuoteShareToken: row.portalQuoteShareToken,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidReason: row.voidReason,
    compareToPrior: null,
  };
}

/** Row slice used to derive `compareToPrior` (same Prisma select as history). */
export type QuoteVersionHistoryCompareSourceRow = {
  id: string;
  versionNumber: number;
  pinnedWorkflowVersionId: string | null;
  planSnapshotSha256: string | null;
  packageSnapshotSha256: string | null;
  _count: { proposalGroups: number; quoteLineItems: number };
};

/**
 * Pure helper: compare `current` to `priorOlder` (caller must pass the **older** revision:
 * lower `versionNumber`). Exposed for unit tests and workspace/history parity.
 */
export function buildQuoteVersionCompareToPrior(
  current: QuoteVersionHistoryCompareSourceRow,
  priorOlder: QuoteVersionHistoryCompareSourceRow,
): QuoteVersionCompareToPriorDto {
  const lineItemCountDelta = current._count.quoteLineItems - priorOlder._count.quoteLineItems;
  const proposalGroupCountDelta = current._count.proposalGroups - priorOlder._count.proposalGroups;
  const pinnedWorkflowVersionIdMatch =
    (current.pinnedWorkflowVersionId ?? null) === (priorOlder.pinnedWorkflowVersionId ?? null);

  const curPlan = current.planSnapshotSha256;
  const curPkg = current.packageSnapshotSha256;
  const priorPlan = priorOlder.planSnapshotSha256;
  const priorPkg = priorOlder.packageSnapshotSha256;

  let frozenPlanAndPackageIdentical: boolean | null = null;
  if (curPlan != null && curPkg != null && priorPlan != null && priorPkg != null) {
    frozenPlanAndPackageIdentical = curPlan === priorPlan && curPkg === priorPkg;
  }

  return {
    priorVersionId: priorOlder.id,
    priorVersionNumber: priorOlder.versionNumber,
    lineItemCountDelta,
    proposalGroupCountDelta,
    frozenPlanAndPackageIdentical,
    pinnedWorkflowVersionIdMatch,
  };
}

/**
 * Full version history for a tenant-owned quote. Returns `null` if the quote is missing or not in the tenant.
 */
export async function getQuoteVersionHistoryForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; quoteId: string },
): Promise<QuoteVersionHistoryReadDto | null> {
  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, tenantId: params.tenantId },
    select: {
      id: true,
      quoteNumber: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          status: true,
          createdAt: true,
          sentAt: true,
          signedAt: true,
          title: true,
          pinnedWorkflowVersionId: true,
          planSnapshotSha256: true,
          packageSnapshotSha256: true,
          activation: { select: { id: true } },
          _count: { select: { proposalGroups: true, quoteLineItems: true } },
          portalQuoteShareToken: true,
          voidedAt: true,
          voidReason: true,
        },
      },
    },
  });

  if (!quote) {
    return null;
  }

  const versions = quote.versions.map((row, i) => {
    const base = mapQuoteVersionRowToHistoryItem(row);
    const priorOlder = quote.versions[i + 1];
    const compareToPrior =
      priorOlder != null ? buildQuoteVersionCompareToPrior(row, priorOlder) : null;
    return { ...base, compareToPrior };
  });

  return {
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    versions,
  };
}
