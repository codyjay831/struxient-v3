import { Prisma, type PrismaClient } from "@prisma/client";
import { parseSkeletonTasksFromWorkflowSnapshot } from "../compose-preview/workflow-snapshot-skeleton-tasks";
import { evaluateSkeletonTaskActionability } from "../eligibility/task-actionability";
import { deriveRuntimeExecutionSummary } from "../reads/derive-runtime-execution-summary";
import type { RuntimeTaskExecutionRequestBody } from "./runtime-task-execution";

export type SkeletonTaskExecutionEventDto = {
  taskExecutionId: string;
  flowId: string;
  skeletonTaskId: string;
  eventType: "STARTED" | "COMPLETED";
  actorUserId: string;
  createdAt: string;
  idempotentReplay: boolean;
};

export type StartSkeletonTaskResult =
  | { ok: true; data: SkeletonTaskExecutionEventDto }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid_actor" }
  | { ok: false; kind: "unknown_skeleton_task" }
  | { ok: false; kind: "already_completed" }
  | { ok: false; kind: "flow_not_activated" };

export type CompleteSkeletonTaskResult =
  | { ok: true; data: SkeletonTaskExecutionEventDto }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid_actor" }
  | { ok: false; kind: "unknown_skeleton_task" }
  | { ok: false; kind: "not_started" }
  | { ok: false; kind: "flow_not_activated" };

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function skeletonDefinedOnSnapshot(snapshotJson: unknown, skeletonTaskId: string): boolean {
  const rows = parseSkeletonTasksFromWorkflowSnapshot(snapshotJson);
  return rows.some((r) => r.skeletonTaskId === skeletonTaskId);
}

/**
 * Append-only STARTED for a workflow skeleton task (template id on pinned snapshot).
 * Idempotent on unique (flowId, skeletonTaskId, STARTED) for taskKind SKELETON.
 */
export async function startSkeletonTaskForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    flowId: string;
    skeletonTaskId: string;
    actorUserId: string;
    request: RuntimeTaskExecutionRequestBody;
  },
): Promise<StartSkeletonTaskResult> {
  const skeletonTaskId = params.skeletonTaskId.trim();
  if (!skeletonTaskId) {
    return { ok: false, kind: "unknown_skeleton_task" };
  }

  const actorId = params.actorUserId.trim();
  if (!actorId) {
    return { ok: false, kind: "invalid_actor" };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Flow" WHERE id = ${params.flowId} FOR UPDATE`;

    const flow = await tx.flow.findFirst({
      where: { id: params.flowId, tenantId: params.tenantId },
      select: {
        id: true,
        tenantId: true,
        workflowVersion: { select: { snapshotJson: true } },
      },
    });
    if (!flow) {
      return { ok: false, kind: "not_found" };
    }

    if (!skeletonDefinedOnSnapshot(flow.workflowVersion.snapshotJson, skeletonTaskId)) {
      return { ok: false, kind: "unknown_skeleton_task" };
    }

    const activation = await tx.activation.findUnique({
      where: { flowId: flow.id },
      select: { id: true },
    });

    const skEvents = await tx.taskExecution.findMany({
      where: {
        flowId: flow.id,
        taskKind: "SKELETON",
        skeletonTaskId,
      },
      select: { eventType: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const execution = deriveRuntimeExecutionSummary(skEvents);
    const actionability = evaluateSkeletonTaskActionability(activation != null, execution);
    if (actionability.start.reasons.includes("TASK_ALREADY_COMPLETED")) {
      return { ok: false, kind: "already_completed" };
    }
    if (actionability.start.reasons.includes("FLOW_NOT_ACTIVATED")) {
      return { ok: false, kind: "flow_not_activated" };
    }

    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!actor) {
      return { ok: false, kind: "invalid_actor" };
    }

    const notes = params.request.notes?.trim() || null;

    try {
      const row = await tx.taskExecution.create({
        data: {
          tenantId: flow.tenantId,
          flowId: flow.id,
          taskKind: "SKELETON",
          skeletonTaskId,
          eventType: "STARTED",
          actorUserId: actor.id,
          notes,
        },
        select: { id: true, createdAt: true, flowId: true },
      });
      return {
        ok: true,
        data: {
          taskExecutionId: row.id,
          flowId: row.flowId,
          skeletonTaskId,
          eventType: "STARTED",
          actorUserId: actor.id,
          createdAt: row.createdAt.toISOString(),
          idempotentReplay: false,
        },
      };
    } catch (e) {
      if (!isUniqueViolation(e)) {
        throw e;
      }
      const existing = await tx.taskExecution.findFirst({
        where: {
          flowId: flow.id,
          taskKind: "SKELETON",
          skeletonTaskId,
          eventType: "STARTED",
        },
        select: { id: true, createdAt: true, flowId: true, actorUserId: true },
      });
      if (!existing) {
        throw e;
      }
      return {
        ok: true,
        data: {
          taskExecutionId: existing.id,
          flowId: existing.flowId,
          skeletonTaskId,
          eventType: "STARTED",
          actorUserId: existing.actorUserId,
          createdAt: existing.createdAt.toISOString(),
          idempotentReplay: true,
        },
      };
    }
  });
}

/**
 * Append-only COMPLETED after STARTED; idempotent on SKELETON unique (flowId, skeletonTaskId, COMPLETED).
 */
export async function completeSkeletonTaskForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    flowId: string;
    skeletonTaskId: string;
    actorUserId: string;
    request: RuntimeTaskExecutionRequestBody;
  },
): Promise<CompleteSkeletonTaskResult> {
  const skeletonTaskId = params.skeletonTaskId.trim();
  if (!skeletonTaskId) {
    return { ok: false, kind: "unknown_skeleton_task" };
  }

  const actorId = params.actorUserId.trim();
  if (!actorId) {
    return { ok: false, kind: "invalid_actor" };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Flow" WHERE id = ${params.flowId} FOR UPDATE`;

    const flow = await tx.flow.findFirst({
      where: { id: params.flowId, tenantId: params.tenantId },
      select: {
        id: true,
        tenantId: true,
        workflowVersion: { select: { snapshotJson: true } },
      },
    });
    if (!flow) {
      return { ok: false, kind: "not_found" };
    }

    if (!skeletonDefinedOnSnapshot(flow.workflowVersion.snapshotJson, skeletonTaskId)) {
      return { ok: false, kind: "unknown_skeleton_task" };
    }

    const activation = await tx.activation.findUnique({
      where: { flowId: flow.id },
      select: { id: true },
    });

    const skEvents = await tx.taskExecution.findMany({
      where: {
        flowId: flow.id,
        taskKind: "SKELETON",
        skeletonTaskId,
      },
      select: { eventType: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const execution = deriveRuntimeExecutionSummary(skEvents);
    const actionability = evaluateSkeletonTaskActionability(activation != null, execution);
    if (actionability.complete.reasons.includes("FLOW_NOT_ACTIVATED")) {
      return { ok: false, kind: "flow_not_activated" };
    }
    if (actionability.complete.reasons.includes("TASK_NOT_STARTED")) {
      return { ok: false, kind: "not_started" };
    }

    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!actor) {
      return { ok: false, kind: "invalid_actor" };
    }

    const notes = params.request.notes?.trim() || null;

    try {
      const row = await tx.taskExecution.create({
        data: {
          tenantId: flow.tenantId,
          flowId: flow.id,
          taskKind: "SKELETON",
          skeletonTaskId,
          eventType: "COMPLETED",
          actorUserId: actor.id,
          notes,
        },
        select: { id: true, createdAt: true, flowId: true },
      });
      return {
        ok: true,
        data: {
          taskExecutionId: row.id,
          flowId: row.flowId,
          skeletonTaskId,
          eventType: "COMPLETED",
          actorUserId: actor.id,
          createdAt: row.createdAt.toISOString(),
          idempotentReplay: false,
        },
      };
    } catch (e) {
      if (!isUniqueViolation(e)) {
        throw e;
      }
      const existing = await tx.taskExecution.findFirst({
        where: {
          flowId: flow.id,
          taskKind: "SKELETON",
          skeletonTaskId,
          eventType: "COMPLETED",
        },
        select: { id: true, createdAt: true, flowId: true, actorUserId: true },
      });
      if (!existing) {
        throw e;
      }
      return {
        ok: true,
        data: {
          taskExecutionId: existing.id,
          flowId: existing.flowId,
          skeletonTaskId,
          eventType: "COMPLETED",
          actorUserId: existing.actorUserId,
          createdAt: existing.createdAt.toISOString(),
          idempotentReplay: true,
        },
      };
    }
  });
}
