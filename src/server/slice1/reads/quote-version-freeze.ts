import type { Prisma } from "@prisma/client";
import type { QuoteVersionScopeDb } from "./quote-version-scope";

export type QuoteVersionFreezeReadModel = {
  id: string;
  status: "SENT" | "SIGNED" | "DECLINED" | "VOID" | "SUPERSEDED";
  sentAt: Date;
  sentById: string;
  pinnedWorkflowVersionId: string | null;
  planSnapshotSha256: string;
  packageSnapshotSha256: string;
  generatedPlanSnapshot: Prisma.JsonValue;
  executionPackageSnapshot: Prisma.JsonValue;
};

/**
 * Tenant-scoped read of frozen snapshots; SENT/SIGNED/DECLINED and withdrawn SUPERSEDED or VOID rows
 * that still carry send-time payloads (audit / compare; Epic 14).
 */
export async function getQuoteVersionFreezeReadModel(
  client: QuoteVersionScopeDb,
  params: { tenantId: string; quoteVersionId: string },
): Promise<QuoteVersionFreezeReadModel | null> {
  const row = await client.quoteVersion.findFirst({
    where: {
      id: params.quoteVersionId,
      status: { in: ["SENT", "SIGNED", "DECLINED", "VOID", "SUPERSEDED"] },
      quote: { tenantId: params.tenantId },
    },
    select: {
      id: true,
      status: true,
      sentAt: true,
      sentById: true,
      pinnedWorkflowVersionId: true,
      planSnapshotSha256: true,
      packageSnapshotSha256: true,
      generatedPlanSnapshot: true,
      executionPackageSnapshot: true,
    },
  });

  if (!row || row.sentAt == null || row.sentById == null) {
    return null;
  }

  if (
    row.planSnapshotSha256 == null ||
    row.packageSnapshotSha256 == null ||
    row.generatedPlanSnapshot == null ||
    row.executionPackageSnapshot == null
  ) {
    return null;
  }

  return {
    id: row.id,
    status: row.status as QuoteVersionFreezeReadModel["status"],
    sentAt: row.sentAt,
    sentById: row.sentById,
    pinnedWorkflowVersionId: row.pinnedWorkflowVersionId,
    planSnapshotSha256: row.planSnapshotSha256,
    packageSnapshotSha256: row.packageSnapshotSha256,
    generatedPlanSnapshot: row.generatedPlanSnapshot,
    executionPackageSnapshot: row.executionPackageSnapshot,
  };
}
