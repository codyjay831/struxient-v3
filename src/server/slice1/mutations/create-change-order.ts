import { PrismaClient } from "@prisma/client";
import { createNextQuoteVersionForTenant } from "./create-next-quote-version";

export type CreateChangeOrderResult =
  | { ok: true; data: { changeOrderId: string; draftQuoteVersionId: string } }
  | { ok: false; kind: "job_not_found" }
  | { ok: false; kind: "no_active_flow" }
  | { ok: false; kind: "already_has_draft" }
  | { ok: false; kind: "quote_version_failed"; detail: string };

export async function createChangeOrderForJob(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    jobId: string;
    reason: string;
    createdById: string;
  },
): Promise<CreateChangeOrderResult> {
  const job = await prisma.job.findFirst({
    where: { id: params.jobId, tenantId: params.tenantId },
    select: { id: true, flows: { orderBy: { createdAt: "desc" }, take: 1, select: { quoteVersion: { select: { quoteId: true } } } } },
  });

  if (!job) {
    return { ok: false, kind: "job_not_found" };
  }

  const latestFlow = job.flows[0];
  if (!latestFlow) {
    return { ok: false, kind: "no_active_flow" };
  }

  const quoteId = latestFlow.quoteVersion.quoteId;

  const existingDraft = await prisma.changeOrder.findFirst({
    where: { jobId: params.jobId, status: "DRAFT" },
    select: { id: true },
  });

  if (existingDraft) {
    return { ok: false, kind: "already_has_draft" };
  }

  const nextVersion = await createNextQuoteVersionForTenant(prisma, {
    tenantId: params.tenantId,
    quoteId,
    createdByUserId: params.createdById,
  });

  if (!nextVersion.ok) {
    return { ok: false, kind: "quote_version_failed", detail: nextVersion.kind };
  }

  const co = await prisma.changeOrder.create({
    data: {
      tenantId: params.tenantId,
      jobId: params.jobId,
      reason: params.reason,
      status: "DRAFT",
      draftQuoteVersionId: nextVersion.data.quoteVersionId,
      createdById: params.createdById,
    },
    select: { id: true, draftQuoteVersionId: true },
  });

  return {
    ok: true,
    data: {
      changeOrderId: co.id,
      draftQuoteVersionId: co.draftQuoteVersionId!,
    },
  };
}
