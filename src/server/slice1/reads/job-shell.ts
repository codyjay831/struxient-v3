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
  completionRequirementsJson?: any;
  conditionalRulesJson?: any;
  instructions?: string | null;
};

export type JobShellFlowRead = {
  id: string;
  quoteId: string;
  quoteVersionId: string;
  workflowVersionId: string;
  createdAt: Date;
  quoteNumber: string;
  activation: { id: string; activatedAt: Date } | null;
  runtimeTasks: JobShellRuntimeTaskRead[];
};

export type JobShellPaymentGateRead = {
  id: string;
  status: "UNSATISFIED" | "SATISFIED";
  title: string;
  targets: { taskId: string; taskKind: "RUNTIME" | "SKELETON" }[];
};

export type JobShellOperationalHoldRead = {
  id: string;
  runtimeTaskId: string | null;
  holdType: string;
  reason: string;
};

export type JobShellReadModel = {
  job: { id: string; createdAt: Date; flowGroupId: string; tenantId: string };
  flowGroup: { id: string; name: string; customerId: string };
  customer: { id: string; name: string };
  flows: JobShellFlowRead[];
  paymentGates: JobShellPaymentGateRead[];
  activeOperationalHolds: JobShellOperationalHoldRead[];
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
        select: {
          id: true,
          name: true,
          customerId: true,
          customer: { select: { id: true, name: true } },
        },
      },
      flows: {
        select: {
          id: true,
          quoteVersionId: true,
          workflowVersionId: true,
          createdAt: true,
          quoteVersion: {
            select: {
              quote: { select: { id: true, quoteNumber: true } },
            },
          },
          activation: {
            select: { id: true, activatedAt: true },
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
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
      holds: {
        where: { status: "ACTIVE" },
        select: { id: true, runtimeTaskId: true, holdType: true, reason: true },
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
    flowGroup: {
      id: row.flowGroup.id,
      name: row.flowGroup.name,
      customerId: row.flowGroup.customerId,
    },
    customer: row.flowGroup.customer,
    flows: row.flows.map((f) => ({
      id: f.id,
      quoteId: f.quoteVersion.quote.id,
      quoteVersionId: f.quoteVersionId,
      workflowVersionId: f.workflowVersionId,
      createdAt: f.createdAt,
      quoteNumber: f.quoteVersion.quote.quoteNumber,
      activation: f.activation,
      runtimeTasks: f.runtimeTasks.map((t) => ({
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
    })),
    paymentGates: row.paymentGates.map((g) => ({
      id: g.id,
      status: g.status as "UNSATISFIED" | "SATISFIED",
      title: g.title,
      targets: g.targets.map((tg) => ({
        taskId: tg.taskId,
        taskKind: tg.taskKind as "RUNTIME" | "SKELETON",
      })),
    })),
    activeOperationalHolds: row.holds.map((h) => ({
      id: h.id,
      runtimeTaskId: h.runtimeTaskId,
      holdType: h.holdType,
      reason: h.reason,
    })),
  };
}
