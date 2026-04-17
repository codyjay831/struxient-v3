import type { PrismaClient } from "@prisma/client";
import { deriveRuntimeExecutionSummary, type RuntimeTaskExecutionSummary } from "./derive-runtime-execution-summary";

export type JobShellRuntimeTaskExecutionRead = RuntimeTaskExecutionSummary;

export type JobShellRuntimeTaskRead = {
  id: string;
  packageTaskId: string;
  nodeId: string;
  lineItemId: string;
  displayTitle: string;
  createdAt: Date;
  execution: JobShellRuntimeTaskExecutionRead;
};

export type JobShellFlowRead = {
  id: string;
  quoteVersionId: string;
  workflowVersionId: string;
  createdAt: Date;
  activation: { id: string; activatedAt: Date } | null;
  runtimeTasks: JobShellRuntimeTaskRead[];
};

export type JobShellReadModel = {
  job: { id: string; createdAt: Date; flowGroupId: string; tenantId: string };
  flowGroup: { id: string; name: string; customerId: string };
  flows: JobShellFlowRead[];
};

/**
 * Tenant-scoped job detail: flow group + flows (with activation + runtime tasks + execution projection).
 */
export async function getJobShellReadModel(
  client: PrismaClient,
  params: { tenantId: string; jobId: string },
): Promise<JobShellReadModel | null> {
  const row = await client.job.findFirst({
    where: { id: params.jobId, tenantId: params.tenantId },
    select: {
      id: true,
      createdAt: true,
      flowGroupId: true,
      tenantId: true,
      flowGroup: {
        select: { id: true, name: true, customerId: true },
      },
      flows: {
        select: {
          id: true,
          quoteVersionId: true,
          workflowVersionId: true,
          createdAt: true,
          activation: {
            select: { id: true, activatedAt: true },
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
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!row) {
    return null;
  }

  return {
    job: {
      id: row.id,
      createdAt: row.createdAt,
      flowGroupId: row.flowGroupId,
      tenantId: row.tenantId,
    },
    flowGroup: row.flowGroup,
    flows: row.flows.map((f) => ({
      id: f.id,
      quoteVersionId: f.quoteVersionId,
      workflowVersionId: f.workflowVersionId,
      createdAt: f.createdAt,
      activation: f.activation,
      runtimeTasks: f.runtimeTasks.map((t) => ({
        id: t.id,
        packageTaskId: t.packageTaskId,
        nodeId: t.nodeId,
        lineItemId: t.lineItemId,
        displayTitle: t.displayTitle,
        createdAt: t.createdAt,
        execution: deriveRuntimeExecutionSummary(t.taskExecutions),
      })),
    })),
  };
}
