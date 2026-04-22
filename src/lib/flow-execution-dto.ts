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
import {
  runtimeTaskBlockedByActiveHolds,
  skeletonStartBlockedByActiveHolds,
} from "@/server/slice1/eligibility/hold-eligibility";

export type { TaskActionabilityApiDto };

export type FlowExecutionRuntimeTaskApiDto = {
  id: string;
  packageTaskId: string;
  nodeId: string;
  lineItemId: string;
  displayTitle: string;
  createdAt: string;
  execution: {
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
  /** Central MVP actionability (`epic 30` shell) — matches start/complete route gates. */
  actionability: TaskActionabilityApiDto;
  completionRequirementsJson?: any;
  conditionalRulesJson?: any;
  instructions?: string | null;
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
      completionRequirementsJson?: unknown;
      conditionalRulesJson?: unknown;
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
      completionRequirementsJson?: any;
      conditionalRulesJson?: any;
      instructions?: string | null;
    };

export type FlowExecutionApiDto = {
  flow: {
    id: string;
    jobId: string;
    quoteVersionId: string;
    workflowVersionId: string;
    createdAt: string;
    publicShareToken: string | null;
    publicShareStatus: "UNPUBLISHED" | "PUBLISHED";
    publicShareTokenGeneratedAt: string | null;
    publicShareFirstViewedAt: string | null;
    publicShareLastViewedAt: string | null;
    publicShareViewCount: number;
    publicShareLastFollowUpSentAt: string | null;
    publicShareReceiptAcknowledgedAt: string | null;
    publicShareClarificationRequestedAt: string | null;
    publicShareClarificationReason: string | null;
    publicShareClarificationResolvedAt: string | null;
    publicShareClarificationResolutionNote: string | null;
    publicShareNotificationLastSeenAt: string | null;
    publicShareExpiresAt: string | null;
  };
  customer: { id: string; name: string; email: string | null; phone: string | null };
  project: { id: string; name: string };
  tenant: { id: string; name: string };
  deliveries: {
    id: string;
    deliveredAt: string;
    deliveryMethod: string;
    recipientDetail: string | null;
    shareToken: string;
    providerStatus: string;
    providerError: string | null;
  }[];
  activation: { id: string; activatedAt: string } | null;
  workflowVersion: { id: string; versionNumber: number; status: string };
  workflowNodeOrder: string[];
  skeletonTasks: {
    nodeId: string;
    skeletonTaskId: string;
    displayTitle: string;
    execution: FlowExecutionRuntimeTaskApiDto["execution"];
    actionability: TaskActionabilityApiDto;
    completionRequirementsJson?: unknown;
    conditionalRulesJson?: unknown;
  }[];
  runtimeTasks: FlowExecutionRuntimeTaskApiDto[];
  workItems: FlowWorkItemApiDto[];
  activeOperationalHolds: {
    id: string;
    runtimeTaskId: string | null;
    holdType: string;
    reason: string;
  }[];
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

function bridgeHolds(m: FlowExecutionReadModel) {
  return m.activeOperationalHolds.map((h) => ({
    id: h.id,
    runtimeTaskId: h.runtimeTaskId,
    reason: h.reason,
  }));
}

function buildWorkItems(m: FlowExecutionReadModel): FlowWorkItemApiDto[] {
  const hasActivation = m.activation != null;
  const holdScopes = m.activeOperationalHolds.map((h) => ({ runtimeTaskId: h.runtimeTaskId }));
  const activeHoldsBridge = bridgeHolds(m);
  const nodeOrder = mergeNodeOrder(m.workflowNodeOrder, m.skeletonTasks, m.runtimeTasks);
  const items: FlowWorkItemApiDto[] = [];
  for (const nodeId of nodeOrder) {
    for (const sk of skeletonTasksForNode(m.skeletonTasks, nodeId)) {
      const hasUnsatisfiedPaymentGate = m.paymentGates.some(g => 
        g.status === "UNSATISFIED" && 
        g.targets.some(tg => tg.taskId === sk.skeletonTaskId && tg.taskKind === "SKELETON")
      );
      const hasHold = skeletonStartBlockedByActiveHolds(holdScopes);
      items.push({
        kind: "SKELETON",
        nodeId: sk.nodeId,
        skeletonTaskId: sk.skeletonTaskId,
        displayTitle: sk.displayTitle,
        execution: {
          status: sk.execution.status,
          startedAt: sk.execution.startedAt?.toISOString() ?? null,
          completedAt: sk.execution.completedAt?.toISOString() ?? null,
          reviewedAt: sk.execution.reviewedAt?.toISOString() ?? null,
          correctionFeedback: sk.execution.correctionFeedback,
          completionProof: sk.execution.completionProof,
        },
        completionRequirementsJson: sk.completionRequirementsJson,
        conditionalRulesJson: sk.conditionalRulesJson,
        actionability: toTaskActionabilityApiDto(
          evaluateSkeletonTaskActionability(hasActivation, sk.execution, hasUnsatisfiedPaymentGate, hasHold, {
            skeletonTaskId: sk.skeletonTaskId,
            paymentGates: m.paymentGates,
            activeHolds: activeHoldsBridge,
          }),
        ),
      });
    }
    for (const rt of runtimeTasksForNode(m.runtimeTasks, nodeId)) {
      const hasUnsatisfiedPaymentGate = m.paymentGates.some(g => 
        g.status === "UNSATISFIED" && 
        g.targets.some(tg => tg.taskId === rt.id && tg.taskKind === "RUNTIME")
      );
      const hasHold = runtimeTaskBlockedByActiveHolds(holdScopes, rt.id);
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
          reviewedAt: rt.execution.reviewedAt?.toISOString() ?? null,
          correctionFeedback: rt.execution.correctionFeedback,
          completionProof: rt.execution.completionProof,
        },
        actionability: toTaskActionabilityApiDto(
          evaluateRuntimeTaskActionability(hasActivation, rt.execution, hasUnsatisfiedPaymentGate, hasHold, {
            runtimeTaskId: rt.id,
            paymentGates: m.paymentGates,
            activeHolds: activeHoldsBridge,
          }),
        ),
        completionRequirementsJson: rt.completionRequirementsJson,
        conditionalRulesJson: rt.conditionalRulesJson,
        instructions: rt.instructions,
      });
    }
  }
  return items;
}

export function toFlowExecutionApiDto(m: FlowExecutionReadModel): FlowExecutionApiDto {
  const hasActivation = m.activation != null;
  const holdScopes = m.activeOperationalHolds.map((h) => ({ runtimeTaskId: h.runtimeTaskId }));
  const activeHoldsBridge = bridgeHolds(m);

  return {
    flow: {
      id: m.flow.id,
      jobId: m.flow.jobId,
      quoteVersionId: m.flow.quoteVersionId,
      workflowVersionId: m.flow.workflowVersionId,
      createdAt: m.flow.createdAt.toISOString(),
      publicShareToken: m.flow.publicShareToken,
      publicShareStatus: m.flow.publicShareStatus as "UNPUBLISHED" | "PUBLISHED",
      publicShareTokenGeneratedAt: m.flow.publicShareTokenGeneratedAt?.toISOString() || null,
      publicShareFirstViewedAt: m.flow.publicShareFirstViewedAt?.toISOString() || null,
      publicShareLastViewedAt: m.flow.publicShareLastViewedAt?.toISOString() || null,
      publicShareViewCount: m.flow.publicShareViewCount,
      publicShareLastFollowUpSentAt: m.flow.publicShareLastFollowUpSentAt?.toISOString() || null,
      publicShareReceiptAcknowledgedAt: m.flow.publicShareReceiptAcknowledgedAt?.toISOString() || null,
      publicShareClarificationRequestedAt: m.flow.publicShareClarificationRequestedAt?.toISOString() || null,
      publicShareClarificationReason: m.flow.publicShareClarificationReason,
      publicShareClarificationResolvedAt: m.flow.publicShareClarificationResolvedAt?.toISOString() || null,
      publicShareClarificationResolutionNote: m.flow.publicShareClarificationResolutionNote,
      publicShareNotificationLastSeenAt: m.flow.publicShareNotificationLastSeenAt?.toISOString() || null,
      publicShareExpiresAt: m.flow.publicShareExpiresAt?.toISOString() || null,
    },
    customer: m.customer,
    project: m.project,
    tenant: m.tenant,
    deliveries: m.deliveries.map((d) => ({
      id: d.id,
      deliveredAt: d.deliveredAt.toISOString(),
      deliveryMethod: d.deliveryMethod,
      recipientDetail: d.recipientDetail,
      shareToken: d.shareToken,
      providerStatus: d.providerStatus,
      providerError: d.providerError,
    })),
    activation: m.activation
      ? { id: m.activation.id, activatedAt: m.activation.activatedAt.toISOString() }
      : null,
    workflowVersion: m.workflowVersion,
    workflowNodeOrder: m.workflowNodeOrder,
    skeletonTasks: m.skeletonTasks.map((sk) => {
      const hasUnsatisfiedPaymentGate = m.paymentGates.some(g => 
        g.status === "UNSATISFIED" && 
        g.targets.some(tg => tg.taskId === sk.skeletonTaskId && tg.taskKind === "SKELETON")
      );
      const hasHold = skeletonStartBlockedByActiveHolds(holdScopes);
      return {
        nodeId: sk.nodeId,
        skeletonTaskId: sk.skeletonTaskId,
        displayTitle: sk.displayTitle,
        execution: {
          status: sk.execution.status,
          startedAt: sk.execution.startedAt?.toISOString() ?? null,
          completedAt: sk.execution.completedAt?.toISOString() ?? null,
          reviewedAt: sk.execution.reviewedAt?.toISOString() ?? null,
          correctionFeedback: sk.execution.correctionFeedback,
          completionProof: sk.execution.completionProof,
        },
        completionRequirementsJson: sk.completionRequirementsJson,
        conditionalRulesJson: sk.conditionalRulesJson,
        actionability: toTaskActionabilityApiDto(
          evaluateSkeletonTaskActionability(hasActivation, sk.execution, hasUnsatisfiedPaymentGate, hasHold, {
            skeletonTaskId: sk.skeletonTaskId,
            paymentGates: m.paymentGates,
            activeHolds: activeHoldsBridge,
          }),
        ),
      };
    }),
    runtimeTasks: m.runtimeTasks.map((t) => {
      const hasUnsatisfiedPaymentGate = m.paymentGates.some(g => 
        g.status === "UNSATISFIED" && 
        g.targets.some(tg => tg.taskId === t.id && tg.taskKind === "RUNTIME")
      );
      const hasHold = runtimeTaskBlockedByActiveHolds(holdScopes, t.id);
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
          evaluateRuntimeTaskActionability(hasActivation, t.execution, hasUnsatisfiedPaymentGate, hasHold, {
            runtimeTaskId: t.id,
            paymentGates: m.paymentGates,
            activeHolds: activeHoldsBridge,
          }),
        ),
        completionRequirementsJson: t.completionRequirementsJson,
        conditionalRulesJson: t.conditionalRulesJson,
        instructions: t.instructions,
      };
    }),
    workItems: buildWorkItems(m),
    activeOperationalHolds: m.activeOperationalHolds.map((h) => ({
      id: h.id,
      runtimeTaskId: h.runtimeTaskId,
      holdType: h.holdType,
      reason: h.reason,
    })),
  };
}
