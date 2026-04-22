import type { QuoteVersionLifecycleReadModel } from "@/server/slice1/reads/quote-version-lifecycle";

export type QuoteVersionLifecycleApiDto = {
  quoteVersion: {
    id: string;
    status: string;
    sentAt: string | null;
    signedAt: string | null;
    signedById: string | null;
    portalQuoteShareToken: string | null;
  };
  quote: { id: string; flowGroupId: string };
  job: { id: string; createdAt: string; flowGroupId: string } | null;
  quoteSignature: {
    id: string;
    signedAt: string;
    method: string;
    recordedById: string | null;
    portalSignerLabel: string | null;
  } | null;
  flow: {
    id: string;
    createdAt: string;
    jobId: string;
    workflowVersionId: string;
    runtimeTaskCount: number;
  } | null;
  activation: {
    id: string;
    activatedAt: string;
    packageSnapshotSha256: string;
  } | null;
};

export function toQuoteVersionLifecycleApiDto(m: QuoteVersionLifecycleReadModel): QuoteVersionLifecycleApiDto {
  return {
    quoteVersion: {
      id: m.quoteVersion.id,
      status: m.quoteVersion.status,
      sentAt: m.quoteVersion.sentAt?.toISOString() ?? null,
      signedAt: m.quoteVersion.signedAt?.toISOString() ?? null,
      signedById: m.quoteVersion.signedById,
      portalQuoteShareToken: m.quoteVersion.portalQuoteShareToken,
    },
    quote: m.quote,
    job: m.job
      ? { id: m.job.id, createdAt: m.job.createdAt.toISOString(), flowGroupId: m.job.flowGroupId }
      : null,
    quoteSignature: m.quoteSignature
      ? {
          id: m.quoteSignature.id,
          signedAt: m.quoteSignature.signedAt.toISOString(),
          method: m.quoteSignature.method,
          recordedById: m.quoteSignature.recordedById,
          portalSignerLabel: m.quoteSignature.portalSignerLabel,
        }
      : null,
    flow: m.flow
      ? {
          id: m.flow.id,
          createdAt: m.flow.createdAt.toISOString(),
          jobId: m.flow.jobId,
          workflowVersionId: m.flow.workflowVersionId,
          runtimeTaskCount: m.flow.runtimeTaskCount,
        }
      : null,
    activation: m.activation
      ? {
          id: m.activation.id,
          activatedAt: m.activation.activatedAt.toISOString(),
          packageSnapshotSha256: m.activation.packageSnapshotSha256,
        }
      : null,
  };
}
