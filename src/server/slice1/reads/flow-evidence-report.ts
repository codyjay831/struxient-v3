import type { PrismaClient } from "@prisma/client";
import {
  parseSkeletonTasksFromWorkflowSnapshot,
  parseWorkflowNodeIdsInOrder,
} from "../compose-preview/workflow-snapshot-skeleton-tasks";
import { deriveRuntimeExecutionSummary } from "./derive-runtime-execution-summary";
import type { FlowEvidenceReportDto, FlowEvidenceReportTaskDto } from "@/lib/flow-evidence-report-dto";

export async function getFlowEvidenceReportReadModel(
  client: PrismaClient,
  params: { tenantId?: string; flowId?: string; shareToken?: string },
): Promise<FlowEvidenceReportDto | null> {
  const where: any = {};
  if (params.shareToken) {
    where.publicShareToken = params.shareToken;
    where.publicShareStatus = "PUBLISHED";
  } else {
    where.id = params.flowId;
    where.tenantId = params.tenantId;
  }

  const row = await client.flow.findFirst({
    where: { ...where, OR: [{ publicShareExpiresAt: null }, { publicShareExpiresAt: { gt: new Date() } }] },
    select: {
      id: true,
      createdAt: true,
      publicShareExpiresAt: true,
      publicShareReceiptAcknowledgedAt: true,
      publicShareClarificationRequestedAt: true,
      publicShareClarificationReason: true,
      quoteVersion: {
        select: {
          quote: {
            select: {
              quoteNumber: true,
              flowGroup: {
                select: {
                  id: true,
                  name: true,
                  customer: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      workflowVersion: {
        select: { snapshotJson: true },
      },
      runtimeTasks: {
        where: { changeOrderIdSuperseded: null },
        select: {
          id: true,
          nodeId: true,
          displayTitle: true,
          createdAt: true,
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
    },
  });

  if (!row) return null;

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

  const eventsBySkeletonId = new Map<string, any[]>();
  for (const r of skExec) {
    if (!r.skeletonTaskId) continue;
    const list = eventsBySkeletonId.get(r.skeletonTaskId) ?? [];
    list.push(r);
    eventsBySkeletonId.set(r.skeletonTaskId, list);
  }

  const tasks: FlowEvidenceReportTaskDto[] = [];

  // Interleave tasks by node order
  for (const nodeId of workflowNodeOrder) {
    // Add skeletons for this node
    for (const sk of skeletonBase.filter(s => s.nodeId === nodeId)) {
      const summary = deriveRuntimeExecutionSummary(eventsBySkeletonId.get(sk.skeletonTaskId) ?? []);
      tasks.push({
        kind: "SKELETON",
        id: sk.skeletonTaskId,
        nodeId: sk.nodeId,
        displayTitle: sk.displayTitle,
        status: summary.status,
        startedAt: summary.startedAt?.toISOString() ?? null,
        completedAt: summary.completedAt?.toISOString() ?? null,
        reviewedAt: summary.reviewedAt?.toISOString() ?? null,
        verified: summary.status === "accepted",
        proof: summary.completionProof ?? null,
      });
    }
    // Add runtimes for this node
    for (const rt of row.runtimeTasks.filter(t => t.nodeId === nodeId)) {
      const summary = deriveRuntimeExecutionSummary(rt.taskExecutions);
      tasks.push({
        kind: "RUNTIME",
        id: rt.id,
        nodeId: rt.nodeId,
        displayTitle: rt.displayTitle,
        status: summary.status,
        startedAt: summary.startedAt?.toISOString() ?? null,
        completedAt: summary.completedAt?.toISOString() ?? null,
        reviewedAt: summary.reviewedAt?.toISOString() ?? null,
        verified: summary.status === "accepted",
        proof: summary.completionProof ?? null,
      });
    }
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completedAt != null).length;
  const acceptedTasks = tasks.filter(t => t.status === "accepted").length;

  return {
    reportId: `REP-${row.id.slice(-6).toUpperCase()}`,
    generatedAt: new Date().toISOString(),
    flow: {
      id: row.id,
      quoteNumber: row.quoteVersion.quote.quoteNumber,
      createdAt: row.createdAt.toISOString(),
      receiptAcknowledgedAt: row.publicShareReceiptAcknowledgedAt?.toISOString() || null,
      clarificationRequestedAt: row.publicShareClarificationRequestedAt?.toISOString() || null,
      clarificationReason: row.publicShareClarificationReason,
      expiresAt: row.publicShareExpiresAt?.toISOString() || null,
    },
    job: {
      id: row.quoteVersion.quote.flowGroup.id,
      name: row.quoteVersion.quote.flowGroup.name,
    },
    customer: row.quoteVersion.quote.flowGroup.customer,
    tasks,
    stats: {
      totalTasks,
      completedTasks,
      acceptedTasks,
      verifiedPercentage: totalTasks > 0 ? Math.round((acceptedTasks / totalTasks) * 100) : 0,
    },
  };
}
