import type { PrismaClient } from "@prisma/client";
import type { ProjectEvidenceRollupDto, ProjectEvidenceRollupFlowDto } from "@/lib/project-evidence-rollup-dto";
import { getFlowEvidenceReportReadModel } from "./flow-evidence-report";

export async function getProjectEvidenceRollupReadModel(
  prisma: PrismaClient,
  params: { tenantId?: string; flowGroupId?: string; shareToken?: string }
): Promise<ProjectEvidenceRollupDto | null> {
  // 1. Resolve FlowGroup
  const where: any = {};
  if (params.shareToken) {
    where.publicShareToken = params.shareToken;
    where.publicShareStatus = "PUBLISHED";
  } else {
    where.id = params.flowGroupId;
    where.tenantId = params.tenantId;
  }

  const flowGroup = await prisma.flowGroup.findFirst({
    where: {
      ...where,
      ...(params.shareToken ? {
        OR: [
          { publicShareExpiresAt: null },
          { publicShareExpiresAt: { gt: new Date() } }
        ]
      } : {})
    },
    select: {
      id: true,
      name: true,
      customerId: true,
      publicShareStatus: true,
      publicShareToken: true,
      publicShareTokenGeneratedAt: true,
      publicShareExpiresAt: true,
      publicShareViewCount: true,
      publicShareFirstViewedAt: true,
      publicShareLastViewedAt: true,
      publicShareReceiptAcknowledgedAt: true,
      publicShareClarificationRequestedAt: true,
      publicShareClarificationReason: true,
      publicShareClarificationResolvedAt: true,
      publicShareClarificationResolutionNote: true,
      publicShareClarificationEscalatedAt: true,
      publicShareNotificationLastSeenAt: true,
      deliveries: {
        orderBy: { deliveredAt: "desc" },
        select: {
          id: true,
          deliveredAt: true,
          deliveryMethod: true,
          recipientDetail: true,
          shareToken: true,
          providerStatus: true,
          providerError: true,
        }
      },
      customer: { select: { name: true, primaryEmail: true, primaryPhone: true } },
      job: {
        select: {
          flows: {
            select: {
              id: true,
              publicShareStatus: true,
              publicShareToken: true,
              publicShareExpiresAt: true,
              quoteVersion: {
                select: {
                  title: true,
                  quote: { select: { quoteNumber: true } }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!flowGroup || !flowGroup.job) return null;

  const flows: ProjectEvidenceRollupFlowDto[] = [];
  
  for (const flowRow of flowGroup.job.flows) {
    // If it's a public view, apply strict child flow visibility rules:
    // 1. Must be PUBLISHED
    // 2. Must NOT be expired
    if (params.shareToken) {
      if (flowRow.publicShareStatus !== "PUBLISHED") continue;
      if (flowRow.publicShareExpiresAt && flowRow.publicShareExpiresAt < new Date()) continue;
    }

    const report = await getFlowEvidenceReportReadModel(prisma, { flowId: flowRow.id });
    if (!report) continue;

    flows.push({
      id: flowRow.id,
      title: flowRow.quoteVersion.title || `Flow ${flowRow.quoteVersion.quote.quoteNumber}`,
      publicShareToken: flowRow.publicShareToken,
      status: report.stats.verifiedPercentage === 100 ? "COMPLETED" : "ACTIVE", 
      publicShareStatus: flowRow.publicShareStatus,
      publicShareExpiresAt: flowRow.publicShareExpiresAt?.toISOString() || null,
      stats: report.stats
    });
  }

  const totalTasks = flows.reduce((acc, f) => acc + f.stats.totalTasks, 0);
  const completedTasks = flows.reduce((acc, f) => acc + f.stats.completedTasks, 0);
  const acceptedTasks = flows.reduce((acc, f) => acc + f.stats.acceptedTasks, 0);

  return {
    projectId: flowGroup.id,
    projectName: flowGroup.name,
    customerId: flowGroup.customerId,
    customerName: flowGroup.customer.name,
    customerEmail: flowGroup.customer.primaryEmail,
    customerPhone: flowGroup.customer.primaryPhone,
    generatedAt: new Date().toISOString(),
    publicShareStatus: flowGroup.publicShareStatus as "UNPUBLISHED" | "PUBLISHED",
    publicShareToken: flowGroup.publicShareToken,
    publicShareExpiresAt: flowGroup.publicShareExpiresAt?.toISOString() || null,
    publicShareViewCount: flowGroup.publicShareViewCount,
    publicShareFirstViewedAt: flowGroup.publicShareFirstViewedAt?.toISOString() || null,
    publicShareLastViewedAt: flowGroup.publicShareLastViewedAt?.toISOString() || null,
    publicShareReceiptAcknowledgedAt: flowGroup.publicShareReceiptAcknowledgedAt?.toISOString() || null,
    publicShareClarificationRequestedAt: flowGroup.publicShareClarificationRequestedAt?.toISOString() || null,
    publicShareClarificationReason: flowGroup.publicShareClarificationReason || null,
    publicShareClarificationResolvedAt: flowGroup.publicShareClarificationResolvedAt?.toISOString() || null,
    publicShareClarificationResolutionNote: flowGroup.publicShareClarificationResolutionNote || null,
    publicShareClarificationEscalatedAt: flowGroup.publicShareClarificationEscalatedAt?.toISOString() || null,
    publicShareNotificationLastSeenAt: flowGroup.publicShareNotificationLastSeenAt?.toISOString() || null,
    deliveries: flowGroup.deliveries.map(d => ({
      ...d,
      deliveredAt: d.deliveredAt.toISOString(),
    })),
    flows,
    overallStats: {
      totalFlows: flowGroup.job.flows.length,
      publishedFlows: flowGroup.job.flows.filter(f => f.publicShareStatus === "PUBLISHED").length,
      totalTasks,
      completedTasks,
      acceptedTasks,
      verifiedPercentage: totalTasks > 0 ? Math.round((acceptedTasks / totalTasks) * 100) : 0
    },
    ...calculateInteractionStatus(flowGroup)
  };
}

function calculateInteractionStatus(fg: any) {
  const lastAckAt = fg.publicShareReceiptAcknowledgedAt ? new Date(fg.publicShareReceiptAcknowledgedAt) : null;
  const lastClarifAt = fg.publicShareClarificationRequestedAt ? new Date(fg.publicShareClarificationRequestedAt) : null;
  const lastSeenAt = fg.publicShareNotificationLastSeenAt ? new Date(fg.publicShareNotificationLastSeenAt) : null;
  const resolvedAt = fg.publicShareClarificationResolvedAt ? new Date(fg.publicShareClarificationResolvedAt) : null;
  const expiresAt = fg.publicShareExpiresAt ? new Date(fg.publicShareExpiresAt) : null;
  const now = new Date();

  const isClarificationUnresolved = !!lastClarifAt && (!resolvedAt || resolvedAt < lastClarifAt);
  
  let notificationPriority: "NONE" | "INFO" | "URGENT" = "NONE";

  // Clarification request is always URGENT if unseen
  if (lastClarifAt && (!lastSeenAt || lastSeenAt < lastClarifAt)) {
    notificationPriority = "URGENT";
  } 
  // Acknowledgment is INFO if unseen
  else if (lastAckAt && (!lastSeenAt || lastSeenAt < lastAckAt)) {
    notificationPriority = "INFO";
  }

  // shareAccessStatus derivation
  let shareAccessStatus: "ACTIVE" | "EXPIRED" | "REVOKED" | "PENDING_PUBLISH" = "PENDING_PUBLISH";
  if (fg.publicShareStatus === "PUBLISHED") {
    if (expiresAt && expiresAt < now) {
      shareAccessStatus = "EXPIRED";
    } else {
      shareAccessStatus = "ACTIVE";
    }
  } else if (fg.publicShareToken && fg.publicShareTokenGeneratedAt) {
    shareAccessStatus = "REVOKED";
  }

  // interactionStatus derivation (narrowly derived from durable fields)
  let interactionStatus: "PUBLISHED" | "VIEWED" | "ACKNOWLEDGED" | "CLARIFICATION_REQUESTED" | "CLARIFICATION_RESOLVED" | "REVOKED" | "EXPIRED" | "PENDING_PUBLISH" = "PENDING_PUBLISH";

  if (shareAccessStatus === "REVOKED") {
    interactionStatus = "REVOKED";
  } else if (shareAccessStatus === "EXPIRED") {
    interactionStatus = "EXPIRED";
  } else if (fg.publicShareStatus === "PUBLISHED") {
    if (isClarificationUnresolved) {
      interactionStatus = "CLARIFICATION_REQUESTED";
    } else if (lastAckAt && (!lastClarifAt || lastAckAt > lastClarifAt)) {
      interactionStatus = "ACKNOWLEDGED";
    } else if (resolvedAt && (!lastClarifAt || resolvedAt >= lastClarifAt)) {
      interactionStatus = "CLARIFICATION_RESOLVED";
    } else if (fg.publicShareViewCount > 0) {
      interactionStatus = "VIEWED";
    } else {
      interactionStatus = "PUBLISHED";
    }
  }

  const requiresAttention = notificationPriority === "URGENT" || isClarificationUnresolved;

  return { notificationPriority, isClarificationUnresolved, interactionStatus, requiresAttention, shareAccessStatus };
}
