import type { QuoteVersionFreezeReadModel } from "@/server/slice1/reads/quote-version-freeze";

export type QuoteVersionFreezeApiDto = {
  quoteVersion: {
    id: string;
    status: "SENT";
    sentAt: string;
    sentById: string;
    pinnedWorkflowVersionId: string | null;
    planSnapshotSha256: string;
    packageSnapshotSha256: string;
  };
  generatedPlanSnapshot: unknown;
  executionPackageSnapshot: unknown;
};

export function toQuoteVersionFreezeApiDto(model: QuoteVersionFreezeReadModel): QuoteVersionFreezeApiDto {
  return {
    quoteVersion: {
      id: model.id,
      status: model.status,
      sentAt: model.sentAt.toISOString(),
      sentById: model.sentById,
      pinnedWorkflowVersionId: model.pinnedWorkflowVersionId,
      planSnapshotSha256: model.planSnapshotSha256,
      packageSnapshotSha256: model.packageSnapshotSha256,
    },
    generatedPlanSnapshot: model.generatedPlanSnapshot,
    executionPackageSnapshot: model.executionPackageSnapshot,
  };
}
