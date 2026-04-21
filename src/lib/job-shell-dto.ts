import type { JobShellReadModel } from "@/server/slice1/reads/job-shell";
import {
  evaluateRuntimeTaskActionability,
  toTaskActionabilityApiDto,
  type TaskActionabilityApiDto,
} from "@/server/slice1/eligibility/task-actionability";

export type { TaskActionabilityApiDto };

export type JobShellRuntimeTaskExecutionApiDto = {
  status: "not_started" | "in_progress" | "completed" | "accepted" | "correction_required";
  startedAt: string | null;
  completedAt: string | null;
  reviewedAt: string | null;
  correctionFeedback: string | null;
  completionProof?: {
    note: string | null;
    attachments: { fileName: string; storageKey: string; contentType: string }[];
    checklist: { label: string; status: "yes" | "no" | "na" }[];
    measurements: { label: string; value: string; unit?: string }[];
    identifiers: { label: string; value: string }[];
    overallResult: string | null;
  } | null;
};

export type JobShellRuntimeTaskApiDto = {
  id: string;
  packageTaskId: string;
  nodeId: string;
  lineItemId: string;
  displayTitle: string;
  createdAt: string;
  execution: JobShellRuntimeTaskExecutionApiDto;
  /** Same rules as `GET /api/flows/[flowId]` runtime tasks (`epic 30` shell). */
  actionability: TaskActionabilityApiDto;
  completionRequirementsJson?: any;
  conditionalRulesJson?: any;
  instructions?: string | null;
};

export type JobShellFlowApiDto = {
  id: string;
  quoteId: string;
  quoteVersionId: string;
  workflowVersionId: string;
  createdAt: string;
  quoteNumber: string;
  activation: { id: string; activatedAt: string } | null;
  runtimeTasks: JobShellRuntimeTaskApiDto[];
};

export type JobShellApiDto = {
  job: { id: string; createdAt: string; flowGroupId: string };
  flowGroup: { id: string; name: string; customerId: string };
  customer: { id: string; name: string };
  flows: JobShellFlowApiDto[];
};

export function toJobShellApiDto(m: JobShellReadModel): JobShellApiDto {
  return {
    job: {
      id: m.job.id,
      createdAt: m.job.createdAt.toISOString(),
      flowGroupId: m.job.flowGroupId,
    },
    flowGroup: m.flowGroup,
    customer: m.customer,
    flows: m.flows.map((f) => ({
      id: f.id,
      quoteId: f.quoteId,
      quoteVersionId: f.quoteVersionId,
      workflowVersionId: f.workflowVersionId,
      createdAt: f.createdAt.toISOString(),
      quoteNumber: f.quoteNumber,
      activation: f.activation
        ? { id: f.activation.id, activatedAt: f.activation.activatedAt.toISOString() }
        : null,
      runtimeTasks: f.runtimeTasks.map((t) => {
        const hasActivation = f.activation != null;
        const hasUnsatisfiedPaymentGate = m.paymentGates.some(g => 
          g.status === "UNSATISFIED" && 
          g.targets.some(tg => tg.taskId === t.id && tg.taskKind === "RUNTIME")
        );
        return {
          id: t.id,
          packageTaskId: t.packageTaskId,
          nodeId: t.nodeId,
          lineItemId: t.lineItemId,
          displayTitle: t.displayTitle,
          createdAt: t.createdAt.toISOString(),
          execution: {
            status: t.execution.status,
            startedAt: t.execution.startedAt?.toISOString() ?? null,
            completedAt: t.execution.completedAt?.toISOString() ?? null,
            reviewedAt: t.execution.reviewedAt?.toISOString() ?? null,
            correctionFeedback: t.execution.correctionFeedback,
            completionProof: t.execution.completionProof,
          },
          actionability: toTaskActionabilityApiDto(
            evaluateRuntimeTaskActionability(hasActivation, t.execution, hasUnsatisfiedPaymentGate),
          ),
          completionRequirementsJson: t.completionRequirementsJson,
          conditionalRulesJson: t.conditionalRulesJson,
          instructions: t.instructions,
        };
      }),
    })),
  };
}
