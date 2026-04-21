import type { PrismaClient } from "@prisma/client";
import {
  parseSkeletonTasksFromWorkflowSnapshot,
  parseWorkflowNodeIdsInOrder,
  type WorkflowSkeletonTaskRow,
} from "../compose-preview/workflow-snapshot-skeleton-tasks";
import { deriveRuntimeExecutionSummary, type RuntimeTaskExecutionSummary } from "./derive-runtime-execution-summary";

export type FlowExecutionRuntimeTaskRead = {
  id: string;
  packageTaskId: string;
  nodeId: string;
  lineItemId: string;
  displayTitle: string;
  createdAt: Date;
  execution: RuntimeTaskExecutionSummary;
  completionRequirementsJson?: any;
  conditionalRulesJson?: any;
  instructions?: string | null;
};

export type FlowExecutionSkeletonTaskRead = WorkflowSkeletonTaskRow & {
  execution: RuntimeTaskExecutionSummary;
};

export type FlowExecutionReadModel = {
  flow: {
    id: string;
    jobId: string;
    quoteVersionId: string;
    workflowVersionId: string;
    createdAt: Date;
    tenantId: string;
    publicShareToken: string | null;
    publicShareStatus: string;
    publicShareTokenGeneratedAt: Date | null;
    publicShareFirstViewedAt: Date | null;
    publicShareLastViewedAt: Date | null;
    publicShareViewCount: number;
    publicShareLastFollowUpSentAt: Date | null;
    publicShareReceiptAcknowledgedAt: Date | null;
    publicShareClarificationRequestedAt: Date | null;
    publicShareClarificationReason: string | null;
    publicShareClarificationResolvedAt: Date | null;
    publicShareClarificationResolutionNote: string | null;
    publicShareNotificationLastSeenAt: Date | null;
    publicShareExpiresAt: Date | null;
  };
  customer: { id: string; name: string; email: string | null; phone: string | null };
  project: { id: string; name: string };
  tenant: { id: string; name: string };
  deliveries: {
    id: string;
    deliveredAt: Date;
    deliveryMethod: string;
    recipientDetail: string | null;
    shareToken: string;
    providerStatus: string;
    providerError: string | null;
  }[];
  activation: { id: string; activatedAt: Date } | null;
  workflowVersion: { id: string; versionNumber: number; status: string };
  skeletonTasks: FlowExecutionSkeletonTaskRead[];
  /** Workflow snapshot `nodes` order; used to interleave skeleton + runtime per node. */
  workflowNodeOrder: string[];
  runtimeTasks: FlowExecutionRuntimeTaskRead[];
  paymentGates: {
    id: string;
    status: "UNSATISFIED" | "SATISFIED";
    title: string;
    targets: { taskId: string; taskKind: "RUNTIME" | "SKELETON" }[];
  }[];
};

/**
 * Tenant-scoped flow execution view: activation, skeleton rows from snapshot, runtime tasks + execution summary.
 */
export async function getFlowExecutionReadModel(
  client: PrismaClient,
  params: { tenantId: string; flowId: string },
): Promise<FlowExecutionReadModel | null> {
  const row = await client.flow.findFirst({
    where: { id: params.flowId, tenantId: params.tenantId },
    select: {
      id: true,
      jobId: true,
      quoteVersionId: true,
      workflowVersionId: true,
      createdAt: true,
      tenantId: true,
      publicShareToken: true,
      publicShareStatus: true,
      publicShareTokenGeneratedAt: true,
      publicShareFirstViewedAt: true,
      publicShareLastViewedAt: true,
      publicShareViewCount: true,
      publicShareLastFollowUpSentAt: true,
      publicShareReceiptAcknowledgedAt: true,
      publicShareClarificationRequestedAt: true,
      publicShareClarificationReason: true,
      publicShareClarificationResolvedAt: true,
      publicShareClarificationResolutionNote: true,
      publicShareNotificationLastSeenAt: true,
      publicShareExpiresAt: true,
      tenant: {
        select: { id: true, name: true },
      },
      deliveries: {
        select: {
          id: true,
          deliveredAt: true,
          deliveryMethod: true,
          recipientDetail: true,
          shareToken: true,
          providerStatus: true,
          providerError: true,
        },
        orderBy: { deliveredAt: "desc" },
      },
      activation: {
        select: { id: true, activatedAt: true },
      },
      workflowVersion: {
        select: { id: true, versionNumber: true, status: true, snapshotJson: true },
      },
      runtimeTasks: {
        where: { changeOrderIdSuperseded: null },
        select: {
          id: true,
          packageTaskId: true,
          nodeId: true,
          lineItemId: true,
          displayTitle: true,
          createdAt: true,
          completionRequirementsJson: true,
          conditionalRulesJson: true,
          instructions: true,
          taskExecutions: {
            where: { taskKind: "RUNTIME" },
            select: { 
              eventType: true, 
              createdAt: true,
              notes: true,
              completionProof: {
                select: {
                  note: true,
                  attachments: { select: { fileName: true, storageKey: true, contentType: true } },
                  checklistJson: true,
                  measurementsJson: true,
                  identifiersJson: true,
                  overallResult: true,
                }
              }
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      job: {
        select: {
          flowGroup: {
            select: {
              id: true,
              name: true,
              customer: {
                select: { id: true, name: true, primaryEmail: true, primaryPhone: true },
              },
            },
          },
          paymentGates: {
            select: {
              id: true,
              status: true,
              title: true,
              targets: {
                select: { taskId: true, taskKind: true },
              },
            },
          },
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  const snapshotJson = row.workflowVersion.snapshotJson;
  const skeletonBase = parseSkeletonTasksFromWorkflowSnapshot(snapshotJson);
  const workflowNodeOrder = parseWorkflowNodeIdsInOrder(snapshotJson);

  const skExec = await client.taskExecution.findMany({
    where: { flowId: row.id, taskKind: "SKELETON" },
    select: { 
      skeletonTaskId: true, 
      eventType: true, 
      createdAt: true,
      notes: true,
      completionProof: {
        select: {
          note: true,
          attachments: { select: { fileName: true, storageKey: true, contentType: true } },
          checklistJson: true,
          measurementsJson: true,
          identifiersJson: true,
          overallResult: true,
        }
      }
    },
  });
  const eventsBySkeletonId = new Map<string, { 
    eventType: string; 
    createdAt: Date;
    notes?: string | null;
    completionProof?: {
      note: string | null;
      attachments: { fileName: string; storageKey: string; contentType: string }[];
      checklistJson?: any;
      measurementsJson?: any;
      identifiersJson?: any;
      overallResult?: string | null;
    } | null;
  }[]>();
  for (const r of skExec) {
    if (!r.skeletonTaskId) continue;
    const list = eventsBySkeletonId.get(r.skeletonTaskId) ?? [];
    list.push({ 
      eventType: r.eventType, 
      createdAt: r.createdAt,
      notes: r.notes,
      completionProof: r.completionProof,
    });
    eventsBySkeletonId.set(r.skeletonTaskId, list);
  }

  const skeletonTasks: FlowExecutionSkeletonTaskRead[] = skeletonBase.map((sk) => ({
    ...sk,
    execution: deriveRuntimeExecutionSummary(eventsBySkeletonId.get(sk.skeletonTaskId) ?? []),
  }));

  return {
    flow: {
      id: row.id,
      jobId: row.jobId,
      quoteVersionId: row.quoteVersionId,
      workflowVersionId: row.workflowVersionId,
      createdAt: row.createdAt,
      tenantId: row.tenantId,
      publicShareToken: row.publicShareToken,
      publicShareStatus: row.publicShareStatus,
      publicShareTokenGeneratedAt: row.publicShareTokenGeneratedAt,
      publicShareFirstViewedAt: row.publicShareFirstViewedAt,
      publicShareLastViewedAt: row.publicShareLastViewedAt,
      publicShareViewCount: row.publicShareViewCount,
      publicShareLastFollowUpSentAt: row.publicShareLastFollowUpSentAt,
      publicShareReceiptAcknowledgedAt: row.publicShareReceiptAcknowledgedAt,
      publicShareClarificationRequestedAt: row.publicShareClarificationRequestedAt,
      publicShareClarificationReason: row.publicShareClarificationReason,
      publicShareClarificationResolvedAt: row.publicShareClarificationResolvedAt,
      publicShareClarificationResolutionNote: row.publicShareClarificationResolutionNote,
      publicShareNotificationLastSeenAt: row.publicShareNotificationLastSeenAt,
      publicShareExpiresAt: row.publicShareExpiresAt,
    },
    customer: {
      id: row.job.flowGroup.customer.id,
      name: row.job.flowGroup.customer.name,
      email: row.job.flowGroup.customer.primaryEmail,
      phone: row.job.flowGroup.customer.primaryPhone,
    },
    project: {
      id: row.job.flowGroup.id,
      name: row.job.flowGroup.name,
    },
    tenant: {
      id: row.tenant.id,
      name: row.tenant.name,
    },
    deliveries: row.deliveries.map((d) => ({
      id: d.id,
      deliveredAt: d.deliveredAt,
      deliveryMethod: d.deliveryMethod,
      recipientDetail: d.recipientDetail,
      shareToken: d.shareToken,
      providerStatus: d.providerStatus,
      providerError: d.providerError,
    })),
    activation: row.activation,
    workflowVersion: {
      id: row.workflowVersion.id,
      versionNumber: row.workflowVersion.versionNumber,
      status: row.workflowVersion.status,
    },
    skeletonTasks,
    workflowNodeOrder,
    runtimeTasks: row.runtimeTasks.map((t) => ({
      id: t.id,
      packageTaskId: t.packageTaskId,
      nodeId: t.nodeId,
      lineItemId: t.lineItemId,
      displayTitle: t.displayTitle,
      createdAt: t.createdAt,
      execution: deriveRuntimeExecutionSummary(t.taskExecutions),
      completionRequirementsJson: t.completionRequirementsJson,
      conditionalRulesJson: t.conditionalRulesJson,
      instructions: t.instructions,
    })),
    paymentGates: row.job.paymentGates.map((g) => ({
      id: g.id,
      status: g.status as "UNSATISFIED" | "SATISFIED",
      title: g.title,
      targets: g.targets.map((tg) => ({
        taskId: tg.taskId,
        taskKind: tg.taskKind as "RUNTIME" | "SKELETON",
      })),
    })),
  };
}
