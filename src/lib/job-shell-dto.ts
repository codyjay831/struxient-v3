import type { JobShellReadModel } from "@/server/slice1/reads/job-shell";
import {
  evaluateRuntimeTaskActionability,
  toTaskActionabilityApiDto,
  type TaskActionabilityApiDto,
} from "@/server/slice1/eligibility/task-actionability";

export type { TaskActionabilityApiDto };

export type JobShellRuntimeTaskExecutionApiDto = {
  status: "not_started" | "in_progress" | "completed";
  startedAt: string | null;
  completedAt: string | null;
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
};

export type JobShellFlowApiDto = {
  id: string;
  quoteVersionId: string;
  workflowVersionId: string;
  createdAt: string;
  activation: { id: string; activatedAt: string } | null;
  runtimeTasks: JobShellRuntimeTaskApiDto[];
};

export type JobShellApiDto = {
  job: { id: string; createdAt: string; flowGroupId: string };
  flowGroup: { id: string; name: string; customerId: string };
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
    flows: m.flows.map((f) => ({
      id: f.id,
      quoteVersionId: f.quoteVersionId,
      workflowVersionId: f.workflowVersionId,
      createdAt: f.createdAt.toISOString(),
      activation: f.activation
        ? { id: f.activation.id, activatedAt: f.activation.activatedAt.toISOString() }
        : null,
      runtimeTasks: f.runtimeTasks.map((t) => {
        const hasActivation = f.activation != null;
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
          },
          actionability: toTaskActionabilityApiDto(
            evaluateRuntimeTaskActionability(hasActivation, t.execution),
          ),
        };
      }),
    })),
  };
}
