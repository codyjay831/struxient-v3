import type {
  FlowExecutionReadModel,
  FlowExecutionRuntimeTaskRead,
  FlowExecutionSkeletonTaskRead,
} from "@/server/slice1/reads/flow-execution";
import {
  evaluateRuntimeTaskActionability,
  evaluateSkeletonTaskActionability,
  toTaskActionabilityApiDto,
  type TaskActionabilityApiDto,
} from "@/server/slice1/eligibility/task-actionability";

export type { TaskActionabilityApiDto };

export type FlowExecutionRuntimeTaskApiDto = {
  id: string;
  packageTaskId: string;
  nodeId: string;
  lineItemId: string;
  displayTitle: string;
  createdAt: string;
  execution: {
    status: "not_started" | "in_progress" | "completed";
    startedAt: string | null;
    completedAt: string | null;
  };
  /** Central MVP actionability (`epic 30` shell) — matches start/complete route gates. */
  actionability: TaskActionabilityApiDto;
};

/** Merged feed: skeleton rows (per node, template order) then runtime tasks on that node (epic 36 / Phase 8 prep). */
export type FlowWorkItemApiDto =
  | {
      kind: "SKELETON";
      nodeId: string;
      skeletonTaskId: string;
      displayTitle: string;
      execution: FlowExecutionRuntimeTaskApiDto["execution"];
      actionability: TaskActionabilityApiDto;
    }
  | {
      kind: "RUNTIME";
      runtimeTaskId: string;
      packageTaskId: string;
      nodeId: string;
      lineItemId: string;
      displayTitle: string;
      createdAt: string;
      execution: FlowExecutionRuntimeTaskApiDto["execution"];
      actionability: TaskActionabilityApiDto;
    };

export type FlowExecutionApiDto = {
  flow: {
    id: string;
    jobId: string;
    quoteVersionId: string;
    workflowVersionId: string;
    createdAt: string;
  };
  activation: { id: string; activatedAt: string } | null;
  workflowVersion: { id: string; versionNumber: number; status: string };
  workflowNodeOrder: string[];
  skeletonTasks: {
    nodeId: string;
    skeletonTaskId: string;
    displayTitle: string;
    execution: FlowExecutionRuntimeTaskApiDto["execution"];
    actionability: TaskActionabilityApiDto;
  }[];
  runtimeTasks: FlowExecutionRuntimeTaskApiDto[];
  workItems: FlowWorkItemApiDto[];
};

function mergeNodeOrder(
  baseOrder: string[],
  skeletonTasks: FlowExecutionSkeletonTaskRead[],
  runtimeTasks: FlowExecutionRuntimeTaskRead[],
): string[] {
  const known = new Set(baseOrder);
  const extras = new Set<string>();
  for (const s of skeletonTasks) {
    extras.add(s.nodeId);
  }
  for (const r of runtimeTasks) {
    extras.add(r.nodeId);
  }
  const tail = [...extras].filter((id) => !known.has(id)).sort((a, b) => a.localeCompare(b));
  return [...baseOrder, ...tail];
}

function skeletonTasksForNode(
  skeletonTasks: FlowExecutionSkeletonTaskRead[],
  nodeId: string,
): FlowExecutionSkeletonTaskRead[] {
  return skeletonTasks.filter((s) => s.nodeId === nodeId);
}

function runtimeTasksForNode(
  runtimeTasks: FlowExecutionRuntimeTaskRead[],
  nodeId: string,
): FlowExecutionRuntimeTaskRead[] {
  return runtimeTasks
    .filter((t) => t.nodeId === nodeId)
    .sort((a, b) => {
      const t = a.createdAt.getTime() - b.createdAt.getTime();
      return t !== 0 ? t : a.id.localeCompare(b.id);
    });
}

function buildWorkItems(m: FlowExecutionReadModel): FlowWorkItemApiDto[] {
  const hasActivation = m.activation != null;
  const nodeOrder = mergeNodeOrder(m.workflowNodeOrder, m.skeletonTasks, m.runtimeTasks);
  const items: FlowWorkItemApiDto[] = [];
  for (const nodeId of nodeOrder) {
    for (const sk of skeletonTasksForNode(m.skeletonTasks, nodeId)) {
      items.push({
        kind: "SKELETON",
        nodeId: sk.nodeId,
        skeletonTaskId: sk.skeletonTaskId,
        displayTitle: sk.displayTitle,
        execution: {
          status: sk.execution.status,
          startedAt: sk.execution.startedAt?.toISOString() ?? null,
          completedAt: sk.execution.completedAt?.toISOString() ?? null,
        },
        actionability: toTaskActionabilityApiDto(
          evaluateSkeletonTaskActionability(hasActivation, sk.execution),
        ),
      });
    }
    for (const rt of runtimeTasksForNode(m.runtimeTasks, nodeId)) {
      items.push({
        kind: "RUNTIME",
        runtimeTaskId: rt.id,
        packageTaskId: rt.packageTaskId,
        nodeId: rt.nodeId,
        lineItemId: rt.lineItemId,
        displayTitle: rt.displayTitle,
        createdAt: rt.createdAt.toISOString(),
        execution: {
          status: rt.execution.status,
          startedAt: rt.execution.startedAt?.toISOString() ?? null,
          completedAt: rt.execution.completedAt?.toISOString() ?? null,
        },
        actionability: toTaskActionabilityApiDto(
          evaluateRuntimeTaskActionability(hasActivation, rt.execution),
        ),
      });
    }
  }
  return items;
}

export function toFlowExecutionApiDto(m: FlowExecutionReadModel): FlowExecutionApiDto {
  const hasActivation = m.activation != null;

  return {
    flow: {
      id: m.flow.id,
      jobId: m.flow.jobId,
      quoteVersionId: m.flow.quoteVersionId,
      workflowVersionId: m.flow.workflowVersionId,
      createdAt: m.flow.createdAt.toISOString(),
    },
    activation: m.activation
      ? { id: m.activation.id, activatedAt: m.activation.activatedAt.toISOString() }
      : null,
    workflowVersion: m.workflowVersion,
    workflowNodeOrder: m.workflowNodeOrder,
    skeletonTasks: m.skeletonTasks.map((sk) => ({
      nodeId: sk.nodeId,
      skeletonTaskId: sk.skeletonTaskId,
      displayTitle: sk.displayTitle,
      execution: {
        status: sk.execution.status,
        startedAt: sk.execution.startedAt?.toISOString() ?? null,
        completedAt: sk.execution.completedAt?.toISOString() ?? null,
      },
      actionability: toTaskActionabilityApiDto(
        evaluateSkeletonTaskActionability(hasActivation, sk.execution),
      ),
    })),
    runtimeTasks: m.runtimeTasks.map((t) => ({
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
    })),
    workItems: buildWorkItems(m),
  };
}
