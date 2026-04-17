import type { PrismaClient, QuoteVersionStatus } from "@prisma/client";
import { InvariantViolationError } from "../errors";
import { assertQuoteVersionDraft } from "../invariants/quote-version";
import { bumpComposePreviewStalenessToken } from "./compose-staleness";

export type PinnedWorkflowQuoteVersionDto = {
  id: string;
  quoteId: string;
  versionNumber: number;
  status: QuoteVersionStatus;
  pinnedWorkflowVersionId: string | null;
};

/**
 * Draft-only: set or clear `pinnedWorkflowVersionId`. Non-null pins must be tenant-owned and PUBLISHED.
 */
export async function setPinnedWorkflowVersionForTenant(
  client: PrismaClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    pinnedWorkflowVersionId: string | null;
  },
): Promise<PinnedWorkflowQuoteVersionDto | "not_found"> {
  const qv = await client.quoteVersion.findFirst({
    where: { id: params.quoteVersionId, quote: { tenantId: params.tenantId } },
    select: { id: true, status: true, quoteId: true, versionNumber: true },
  });

  if (!qv) {
    return "not_found";
  }

  assertQuoteVersionDraft({ status: qv.status, quoteVersionId: qv.id });

  if (params.pinnedWorkflowVersionId == null) {
    const updated = await client.quoteVersion.update({
      where: { id: qv.id },
      data: { pinnedWorkflowVersionId: null },
      select: {
        id: true,
        quoteId: true,
        versionNumber: true,
        status: true,
        pinnedWorkflowVersionId: true,
      },
    });
    await bumpComposePreviewStalenessToken(client, qv.id);
    return updated;
  }

  const wf = await client.workflowVersion.findFirst({
    where: {
      id: params.pinnedWorkflowVersionId,
      workflowTemplate: { tenantId: params.tenantId },
    },
    select: { id: true, status: true },
  });

  if (!wf) {
    throw new InvariantViolationError(
      "PINNED_WORKFLOW_VERSION_NOT_FOUND",
      "Workflow version not found or does not belong to this tenant.",
      { pinnedWorkflowVersionId: params.pinnedWorkflowVersionId },
    );
  }

  if (wf.status !== "PUBLISHED") {
    throw new InvariantViolationError(
      "PINNED_WORKFLOW_VERSION_NOT_PUBLISHED",
      "Only PUBLISHED workflow versions may be pinned on a draft quote version.",
      { pinnedWorkflowVersionId: wf.id, status: wf.status },
    );
  }

  const updated = await client.quoteVersion.update({
    where: { id: qv.id },
    data: { pinnedWorkflowVersionId: wf.id },
    select: {
      id: true,
      quoteId: true,
      versionNumber: true,
      status: true,
      pinnedWorkflowVersionId: true,
    },
  });

  await bumpComposePreviewStalenessToken(client, qv.id);

  return updated;
}
