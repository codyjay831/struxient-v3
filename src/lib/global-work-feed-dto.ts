import type {
  GlobalWorkFeedReadModel,
  GlobalWorkFeedRuntimeLane,
} from "@/server/slice1/reads/global-work-feed-reads";
import { toTaskActionabilityApiDto, type TaskActionabilityApiDto } from "@/server/slice1/eligibility/task-actionability";

export type GlobalWorkFeedRuntimeTaskApiRow = {
  runtimeTaskId: string;
  flowId: string;
  jobId: string;
  flowGroupId: string;
  flowGroupName: string;
  customerId: string;
  customerName: string;
  quoteNumber: string;
  displayTitle: string;
  nodeId: string;
  createdAt: string;
  execution: {
    status: "not_started" | "in_progress" | "completed" | "accepted" | "correction_required";
    startedAt: string | null;
    completedAt: string | null;
    reviewedAt: string | null;
    correctionFeedback: string | null;
  };
  actionability: TaskActionabilityApiDto;
  lane: GlobalWorkFeedRuntimeLane;
};

export type GlobalWorkFeedPreJobTaskApiRow = {
  preJobTaskId: string;
  title: string;
  status: string;
  taskType: string;
  sourceType: string;
  flowGroupId: string;
  flowGroupName: string;
  customerId: string;
  customerName: string;
  quoteVersionId: string | null;
  quoteId: string | null;
  quoteNumber: string | null;
  quoteVersionNumber: number | null;
  dueAt: string | null;
  createdAt: string;
  assignedToLabel: string | null;
};

export type GlobalWorkFeedSkeletonTaskApiRow = {
  skeletonTaskId: string;
  flowId: string;
  workflowVersionId: string;
  jobId: string;
  flowGroupId: string;
  flowGroupName: string;
  customerId: string;
  customerName: string;
  quoteNumber: string;
  displayTitle: string;
  nodeId: string;
  execution: GlobalWorkFeedRuntimeTaskApiRow["execution"];
  actionability: TaskActionabilityApiDto;
  lane: GlobalWorkFeedRuntimeLane;
};

export type GlobalWorkFeedApiDto = {
  schemaVersion: number;
  runtimeTruncated: boolean;
  preJobTruncated: boolean;
  skeletonFlowScanTruncated: boolean;
  skeletonRowsTruncated: boolean;
  rows: GlobalWorkFeedRuntimeTaskApiRow[];
  preJobRows: GlobalWorkFeedPreJobTaskApiRow[];
  skeletonRows: GlobalWorkFeedSkeletonTaskApiRow[];
};

export function toGlobalWorkFeedApiDto(model: GlobalWorkFeedReadModel): GlobalWorkFeedApiDto {
  return {
    schemaVersion: model.schemaVersion,
    runtimeTruncated: model.runtimeTruncated,
    preJobTruncated: model.preJobTruncated,
    skeletonFlowScanTruncated: model.skeletonFlowScanTruncated,
    skeletonRowsTruncated: model.skeletonRowsTruncated,
    rows: model.rows.map((r) => ({
      runtimeTaskId: r.runtimeTaskId,
      flowId: r.flowId,
      jobId: r.jobId,
      flowGroupId: r.flowGroupId,
      flowGroupName: r.flowGroupName,
      customerId: r.customerId,
      customerName: r.customerName,
      quoteNumber: r.quoteNumber,
      displayTitle: r.displayTitle,
      nodeId: r.nodeId,
      createdAt: r.createdAt.toISOString(),
      execution: {
        status: r.execution.status,
        startedAt: r.execution.startedAt?.toISOString() ?? null,
        completedAt: r.execution.completedAt?.toISOString() ?? null,
        reviewedAt: r.execution.reviewedAt?.toISOString() ?? null,
        correctionFeedback: r.execution.correctionFeedback,
      },
      actionability: toTaskActionabilityApiDto(r.actionability),
      lane: r.lane,
    })),
    preJobRows: model.preJobRows.map((p) => ({
      preJobTaskId: p.preJobTaskId,
      title: p.title,
      status: p.status,
      taskType: p.taskType,
      sourceType: p.sourceType,
      flowGroupId: p.flowGroupId,
      flowGroupName: p.flowGroupName,
      customerId: p.customerId,
      customerName: p.customerName,
      quoteVersionId: p.quoteVersionId,
      quoteId: p.quoteId,
      quoteNumber: p.quoteNumber,
      quoteVersionNumber: p.quoteVersionNumber,
      dueAt: p.dueAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      assignedToLabel: p.assignedToLabel,
    })),
    skeletonRows: model.skeletonRows.map((s) => ({
      skeletonTaskId: s.skeletonTaskId,
      flowId: s.flowId,
      workflowVersionId: s.workflowVersionId,
      jobId: s.jobId,
      flowGroupId: s.flowGroupId,
      flowGroupName: s.flowGroupName,
      customerId: s.customerId,
      customerName: s.customerName,
      quoteNumber: s.quoteNumber,
      displayTitle: s.displayTitle,
      nodeId: s.nodeId,
      execution: {
        status: s.execution.status,
        startedAt: s.execution.startedAt?.toISOString() ?? null,
        completedAt: s.execution.completedAt?.toISOString() ?? null,
        reviewedAt: s.execution.reviewedAt?.toISOString() ?? null,
        correctionFeedback: s.execution.correctionFeedback,
      },
      actionability: toTaskActionabilityApiDto(s.actionability),
      lane: s.lane,
    })),
  };
}
