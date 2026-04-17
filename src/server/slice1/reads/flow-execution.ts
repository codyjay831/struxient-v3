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
  };
  activation: { id: string; activatedAt: Date } | null;
  workflowVersion: { id: string; versionNumber: number; status: string };
  skeletonTasks: FlowExecutionSkeletonTaskRead[];
  /** Workflow snapshot `nodes` order; used to interleave skeleton + runtime per node. */
  workflowNodeOrder: string[];
  runtimeTasks: FlowExecutionRuntimeTaskRead[];
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
      activation: {
        select: { id: true, activatedAt: true },
      },
      workflowVersion: {
        select: { id: true, versionNumber: true, status: true, snapshotJson: true },
      },
      runtimeTasks: {
        select: {
          id: true,
          packageTaskId: true,
          nodeId: true,
          lineItemId: true,
          displayTitle: true,
          createdAt: true,
          taskExecutions: {
            where: { taskKind: "RUNTIME" },
            select: { eventType: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
    select: { skeletonTaskId: true, eventType: true, createdAt: true },
  });
  const eventsBySkeletonId = new Map<string, { eventType: string; createdAt: Date }[]>();
  for (const r of skExec) {
    if (!r.skeletonTaskId) continue;
    const list = eventsBySkeletonId.get(r.skeletonTaskId) ?? [];
    list.push({ eventType: r.eventType, createdAt: r.createdAt });
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
    },
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
    })),
  };
}
