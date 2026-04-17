import type { PrismaClient } from "@prisma/client";
import {
  mapQuoteVersionRowToHistoryItem,
  type QuoteVersionHistoryItemDto,
} from "./quote-version-history-reads";

const VERSION_SELECT = {
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
} as const;

/** Aggregate summary of line items for a specific version. */
export type QuoteVersionLineItemSummaryDto = {
  lineItemCount: number;
  libraryLineItemCount: number;
  localLineItemCount: number;
  totalLineItemCents: number | null;
};

/** Static path patterns; clients substitute `:quoteId` / `:quoteVersionId`. */
export type QuoteWorkspaceRouteHints = {
  quoteWorkspaceGet: "GET /api/quotes/:quoteId/workspace";
  quoteDetailGet: "GET /api/quotes/:quoteId";
  versionHistoryGet: "GET /api/quotes/:quoteId/versions";
  nextVersionPost: "POST /api/quotes/:quoteId/versions";
  quoteVersionScopeGet: "GET /api/quote-versions/:quoteVersionId/scope";
  quoteVersionLifecycleGet: "GET /api/quote-versions/:quoteVersionId/lifecycle";
  quoteVersionFreezeGet: "GET /api/quote-versions/:quoteVersionId/freeze";
  quoteVersionSignPost: "POST /api/quote-versions/:quoteVersionId/sign";
  quoteVersionActivatePost: "POST /api/quote-versions/:quoteVersionId/activate";
  flowExecutionGet: "GET /api/flows/:flowId";
  jobShellGet: "GET /api/jobs/:jobId";
  customerDetailGet: "GET /api/customers/:customerId";
  flowGroupDetailGet: "GET /api/flow-groups/:flowGroupId";
  workflowVersionsListGet: "GET /api/workflow-versions";
  workflowVersionDetailGet: "GET /api/workflow-versions/:workflowVersionId";
};

const ROUTE_HINTS: QuoteWorkspaceRouteHints = {
  quoteWorkspaceGet: "GET /api/quotes/:quoteId/workspace",
  quoteDetailGet: "GET /api/quotes/:quoteId",
  versionHistoryGet: "GET /api/quotes/:quoteId/versions",
  nextVersionPost: "POST /api/quotes/:quoteId/versions",
  quoteVersionScopeGet: "GET /api/quote-versions/:quoteVersionId/scope",
  quoteVersionLifecycleGet: "GET /api/quote-versions/:quoteVersionId/lifecycle",
  quoteVersionFreezeGet: "GET /api/quote-versions/:quoteVersionId/freeze",
  quoteVersionSignPost: "POST /api/quote-versions/:quoteVersionId/sign",
  quoteVersionActivatePost: "POST /api/quote-versions/:quoteVersionId/activate",
  flowExecutionGet: "GET /api/flows/:flowId",
  jobShellGet: "GET /api/jobs/:jobId",
  customerDetailGet: "GET /api/customers/:customerId",
  flowGroupDetailGet: "GET /api/flow-groups/:flowGroupId",
  workflowVersionsListGet: "GET /api/workflow-versions",
  workflowVersionDetailGet: "GET /api/workflow-versions/:workflowVersionId",
};

/**
 * Single read model for office navigation: shell + full version list (same ordering and item shape as
 * `GET /api/quotes/:quoteId/versions` — **versionNumber descending**).
 */
export type QuoteWorkspaceDto = {
  quote: { id: string; quoteNumber: string; createdAt: string };
  customer: { id: string; name: string };
  flowGroup: { id: string; name: string };
  versions: QuoteVersionHistoryItemDto[];
  /** First entry in `versions` (max `versionNumber`), or null if no versions. */
  latestQuoteVersionId: string | null;
  /** Summary data for the head version (versions[0]), if it exists. */
  headLineItemSummary: QuoteVersionLineItemSummaryDto | null;
  routeHints: QuoteWorkspaceRouteHints;
};

/**
 * One query: tenant-owned quote with customer, flow group, and all versions (history mapper reused).
 */
export async function getQuoteWorkspaceForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; quoteId: string },
): Promise<QuoteWorkspaceDto | null> {
  const row = await prisma.quote.findFirst({
    where: { id: params.quoteId, tenantId: params.tenantId },
    select: {
      id: true,
      quoteNumber: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      flowGroup: { select: { id: true, name: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: VERSION_SELECT,
      },
    },
  });

  if (!row) {
    return null;
  }

  const versions = row.versions.map(mapQuoteVersionRowToHistoryItem);
  const headVersion = row.versions[0];
  const latestQuoteVersionId = headVersion?.id ?? null;

  let headLineItemSummary: QuoteVersionLineItemSummaryDto | null = null;
  if (headVersion) {
    const headLines = await prisma.quoteLineItem.findMany({
      where: { quoteVersionId: headVersion.id },
      select: {
        scopePacketRevisionId: true,
        quoteLocalPacketId: true,
        lineTotalCents: true,
      },
    });

    if (headLines.length > 0) {
      headLineItemSummary = {
        lineItemCount: headLines.length,
        libraryLineItemCount: headLines.filter((l) => l.scopePacketRevisionId != null).length,
        localLineItemCount: headLines.filter((l) => l.quoteLocalPacketId != null).length,
        totalLineItemCents: headLines.reduce((acc, l) => acc + (l.lineTotalCents ?? 0), 0),
      };
    } else {
      headLineItemSummary = {
        lineItemCount: 0,
        libraryLineItemCount: 0,
        localLineItemCount: 0,
        totalLineItemCents: null,
      };
    }
  }

  return {
    quote: {
      id: row.id,
      quoteNumber: row.quoteNumber,
      createdAt: row.createdAt.toISOString(),
    },
    customer: row.customer,
    flowGroup: row.flowGroup,
    versions,
    latestQuoteVersionId,
    headLineItemSummary,
    routeHints: ROUTE_HINTS,
  };
}
