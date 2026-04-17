import type { PrismaClient, QuoteVersionStatus } from "@prisma/client";

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
  /** An `Activation` row exists for this version (post-activate path). */
  hasActivation: boolean;
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
  _count: { proposalGroups: number };
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
    hasActivation: row.activation != null,
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
          _count: { select: { proposalGroups: true } },
        },
      },
    },
  });

  if (!quote) {
    return null;
  }

  return {
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    versions: quote.versions.map(mapQuoteVersionRowToHistoryItem),
  };
}
