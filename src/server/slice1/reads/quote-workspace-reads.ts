import type { PrismaClient } from "@prisma/client";
import {
  buildQuoteVersionCompareToPrior,
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
  _count: { select: { proposalGroups: true, quoteLineItems: true } },
  portalQuoteShareToken: true,
  voidedAt: true,
  voidReason: true,
  portalDeclinedAt: true,
  portalDeclineReason: true,
} as const;

/** Aggregate summary of line items for a specific version. */
export type QuoteVersionLineItemSummaryDto = {
  lineItemCount: number;
  libraryLineItemCount: number;
  localLineItemCount: number;
  totalLineItemCents: number | null;
};

/** Compact visibility for one line item. */
export type QuoteLineItemVisibilityDto = {
  id: string;
  title: string;
  quantity: number;
  lineTotalCents: number | null;
  isLibraryBacked: boolean;
  isQuoteLocal: boolean;
};

/** Compact visibility for a payment gate. */
export type QuoteWorkspacePaymentGateDto = {
  id: string;
  status: "UNSATISFIED" | "SATISFIED";
  title: string;
  satisfiedAt: string | null;
  targetCount: number;
};

/** Compact visibility for a change order. */
export type QuoteWorkspaceChangeOrderDto = {
  id: string;
  status: "DRAFT" | "PENDING_CUSTOMER" | "READY_TO_APPLY" | "APPLIED" | "VOID";
  reason: string;
  appliedAt: string | null;
  createdAt: string;
  draftQuoteVersionId: string | null;
  /** Present when the CO draft was sent for portal review (Epic 37). */
  draftQuotePortalShareToken: string | null;
  draftQuoteVersionStatus: string | null;
  /** When the linked draft exists and was declined on the customer portal (read from `QuoteVersion`). */
  draftQuotePortalDeclinedAtIso: string | null;
  draftQuotePortalDeclineReason: string | null;
};

/** VOID change order whose linked draft was declined on the portal — show explicit office explanation (Epic 37 + 54). */
export function shouldShowPortalDeclineVoidExplanation(
  co: Pick<QuoteWorkspaceChangeOrderDto, "status" | "draftQuoteVersionStatus">,
): boolean {
  return co.status === "VOID" && co.draftQuoteVersionStatus === "DECLINED";
}

/** Compact visibility for media evidence. */
export type QuoteWorkspaceEvidenceDto = {
  storageKey: string;
  fileName: string;
  contentType: string;
  taskTitle: string;
  createdAt: string;
};

/** FlowGroup-scoped pre-job rows for office context (read-only list; no scheduling semantics). */
export type QuoteWorkspacePreJobTaskDto = {
  id: string;
  title: string;
  status: string;
  taskType: string;
  sourceType: string;
  quoteVersionId: string | null;
  /** When the linked version belongs to this workspace quote; otherwise null. */
  linkedQuoteVersionNumber: number | null;
  /** Office scope URL when the task points at a version on this quote; otherwise null. */
  quoteVersionScopeHref: string | null;
  assignedToLabel: string | null;
  dueAtIso: string | null;
  createdAtIso: string;
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
  flowGroup: { id: string; name: string; jobId: string | null };
  versions: QuoteVersionHistoryItemDto[];
  /** First entry in `versions` (max `versionNumber`), or null if no versions. */
  latestQuoteVersionId: string | null;
  /** Summary data for the head version (versions[0]), if it exists. */
  headLineItemSummary: QuoteVersionLineItemSummaryDto | null;
  /** Itemized list for visibility on the head version. */
  headLineItems: QuoteLineItemVisibilityDto[];
  /** Payment gates associated with the job/engagement. */
  paymentGates: QuoteWorkspacePaymentGateDto[];
  /** Change orders associated with the job. */
  changeOrders: QuoteWorkspaceChangeOrderDto[];
  /** Consolidated evidence from all tasks on the job. */
  evidence: QuoteWorkspaceEvidenceDto[];
  /** PreJobTask rows on the quote's FlowGroup (same tenant); optional quoteVersion link. */
  preJobTasks: QuoteWorkspacePreJobTaskDto[];
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
      flowGroup: {
        select: {
          id: true,
          name: true,
          job: { select: { id: true } },
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: VERSION_SELECT,
      },
    },
  });

  if (!row) {
    return null;
  }

  const paymentGates: QuoteWorkspacePaymentGateDto[] = [];
  const changeOrders: QuoteWorkspaceChangeOrderDto[] = [];
  const evidence: QuoteWorkspaceEvidenceDto[] = [];

  const preJobTaskRows = await prisma.preJobTask.findMany({
    where: { tenantId: params.tenantId, flowGroupId: row.flowGroup.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      taskType: true,
      sourceType: true,
      quoteVersionId: true,
      dueAt: true,
      createdAt: true,
      assignedToUser: { select: { email: true, displayName: true } },
    },
  });

  const versionIdToNumber = new Map(row.versions.map((v) => [v.id, v.versionNumber]));
  const versionIdsThisQuote = new Set(row.versions.map((v) => v.id));

  const preJobTasks: QuoteWorkspacePreJobTaskDto[] = preJobTaskRows.map((t) => {
    const qvid = t.quoteVersionId;
    const linkedQuoteVersionNumber =
      qvid != null && versionIdToNumber.has(qvid) ? versionIdToNumber.get(qvid)! : null;
    const quoteVersionScopeHref =
      qvid != null && versionIdsThisQuote.has(qvid)
        ? `/quotes/${params.quoteId}/versions/${encodeURIComponent(qvid)}/scope`
        : null;
    const assignedToLabel = t.assignedToUser
      ? (t.assignedToUser.displayName?.trim() || t.assignedToUser.email)
      : null;
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      taskType: t.taskType,
      sourceType: t.sourceType,
      quoteVersionId: qvid,
      linkedQuoteVersionNumber,
      quoteVersionScopeHref,
      assignedToLabel,
      dueAtIso: t.dueAt?.toISOString() ?? null,
      createdAtIso: t.createdAt.toISOString(),
    };
  });

  if (row.flowGroup.job) {
    const gates = await prisma.paymentGate.findMany({
      where: { jobId: row.flowGroup.job.id, tenantId: params.tenantId },
      select: {
        id: true,
        status: true,
        title: true,
        satisfiedAt: true,
        _count: { select: { targets: true } },
      },
    });
    for (const g of gates) {
      paymentGates.push({
        id: g.id,
        status: g.status as "UNSATISFIED" | "SATISFIED",
        title: g.title,
        satisfiedAt: g.satisfiedAt?.toISOString() ?? null,
        targetCount: g._count.targets,
      });
    }

    const cos = await prisma.changeOrder.findMany({
      where: { jobId: row.flowGroup.job.id, tenantId: params.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        reason: true,
        appliedAt: true,
        createdAt: true,
        draftQuoteVersionId: true,
        draftQuoteVersion: {
          select: {
            portalQuoteShareToken: true,
            status: true,
            portalDeclinedAt: true,
            portalDeclineReason: true,
          },
        },
      },
    });
    for (const co of cos) {
      const draft = co.draftQuoteVersion;
      changeOrders.push({
        id: co.id,
        status: co.status as QuoteWorkspaceChangeOrderDto["status"],
        reason: co.reason,
        appliedAt: co.appliedAt?.toISOString() ?? null,
        createdAt: co.createdAt.toISOString(),
        draftQuoteVersionId: co.draftQuoteVersionId,
        draftQuotePortalShareToken: draft?.portalQuoteShareToken ?? null,
        draftQuoteVersionStatus: draft?.status ?? null,
        draftQuotePortalDeclinedAtIso: draft?.portalDeclinedAt?.toISOString() ?? null,
        draftQuotePortalDeclineReason: draft?.portalDeclineReason ?? null,
      });
    }

    const attachments = await prisma.completionProofAttachment.findMany({
      where: { tenantId: params.tenantId, completionProof: { runtimeTask: { flow: { jobId: row.flowGroup.job.id } } } },
      orderBy: { createdAt: "desc" },
      select: {
        storageKey: true,
        fileName: true,
        contentType: true,
        createdAt: true,
        completionProof: {
          select: {
            runtimeTask: { select: { displayTitle: true } }
          }
        }
      }
    });

    for (const a of attachments) {
      evidence.push({
        storageKey: a.storageKey,
        fileName: a.fileName,
        contentType: a.contentType,
        taskTitle: a.completionProof.runtimeTask.displayTitle,
        createdAt: a.createdAt.toISOString(),
      });
    }
  }

  const versions = row.versions.map((v, i) => {
    const base = mapQuoteVersionRowToHistoryItem(v);
    const priorOlder = row.versions[i + 1];
    return {
      ...base,
      compareToPrior:
        priorOlder != null ? buildQuoteVersionCompareToPrior(v, priorOlder) : null,
    };
  });
  const headVersion = row.versions[0];
  const latestQuoteVersionId = headVersion?.id ?? null;

  let headLineItemSummary: QuoteVersionLineItemSummaryDto | null = null;
  let headLineItems: QuoteLineItemVisibilityDto[] = [];
  if (headVersion) {
    const headLines = await prisma.quoteLineItem.findMany({
      where: { quoteVersionId: headVersion.id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        quantity: true,
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
      headLineItems = headLines.map((l) => ({
        id: l.id,
        title: l.title,
        quantity: l.quantity,
        lineTotalCents: l.lineTotalCents,
        isLibraryBacked: l.scopePacketRevisionId != null,
        isQuoteLocal: l.quoteLocalPacketId != null,
      }));
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
    flowGroup: {
      ...row.flowGroup,
      jobId: row.flowGroup.job?.id ?? null,
    },
    versions,
    latestQuoteVersionId,
    headLineItemSummary,
    headLineItems,
    paymentGates,
    changeOrders,
    evidence,
    preJobTasks,
    routeHints: ROUTE_HINTS,
  };
}
