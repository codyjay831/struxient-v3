import { Prisma, type PrismaClient } from "@prisma/client";
import { evaluateRuntimeTaskActionability } from "../eligibility/task-actionability";
import { deriveRuntimeExecutionSummary } from "../reads/derive-runtime-execution-summary";

export type RuntimeTaskExecutionRequestBody = {
  notes?: string | null;
};

export type TaskExecutionEventDto = {
  taskExecutionId: string;
  runtimeTaskId: string;
  flowId: string;
  eventType: "STARTED" | "COMPLETED";
  actorUserId: string;
  createdAt: string;
  idempotentReplay: boolean;
};

export type StartRuntimeTaskResult =
  | { ok: true; data: TaskExecutionEventDto }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid_actor" }
  | { ok: false; kind: "already_completed" }
  | { ok: false; kind: "flow_not_activated" };

export type CompleteRuntimeTaskResult =
  | { ok: true; data: TaskExecutionEventDto }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid_actor" }
  | { ok: false; kind: "not_started" }
  | { ok: false; kind: "flow_not_activated" };

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Append-only STARTED for a RUNTIME task; idempotent on unique (runtimeTaskId, STARTED).
 */
export async function startRuntimeTaskForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    runtimeTaskId: string;
    actorUserId: string;
    request: RuntimeTaskExecutionRequestBody;
  },
): Promise<StartRuntimeTaskResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) {
    return { ok: false, kind: "invalid_actor" };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "RuntimeTask" WHERE id = ${params.runtimeTaskId} FOR UPDATE`;

    const rt = await tx.runtimeTask.findFirst({
      where: { id: params.runtimeTaskId, tenantId: params.tenantId },
      select: { id: true, flowId: true, tenantId: true },
    });
    if (!rt) {
      return { ok: false, kind: "not_found" };
    }

    const activation = await tx.activation.findUnique({
      where: { flowId: rt.flowId },
      select: { id: true },
    });

    const runtimeEvents = await tx.taskExecution.findMany({
      where: { runtimeTaskId: rt.id, taskKind: "RUNTIME" },
      select: { eventType: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const execution = deriveRuntimeExecutionSummary(runtimeEvents);
    const actionability = evaluateRuntimeTaskActionability(activation != null, execution);
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
          tenantId: rt.tenantId,
          flowId: rt.flowId,
          taskKind: "RUNTIME",
          runtimeTaskId: rt.id,
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
          runtimeTaskId: rt.id,
          flowId: row.flowId,
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
        where: { runtimeTaskId: rt.id, eventType: "STARTED" },
        select: { id: true, createdAt: true, flowId: true, actorUserId: true },
      });
      if (!existing) {
        throw e;
      }
      return {
        ok: true,
        data: {
          taskExecutionId: existing.id,
          runtimeTaskId: rt.id,
          flowId: existing.flowId,
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
 * Append-only COMPLETED after STARTED; idempotent on unique (runtimeTaskId, COMPLETED).
 */
export async function completeRuntimeTaskForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    runtimeTaskId: string;
    actorUserId: string;
    request: RuntimeTaskExecutionRequestBody;
  },
): Promise<CompleteRuntimeTaskResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) {
    return { ok: false, kind: "invalid_actor" };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "RuntimeTask" WHERE id = ${params.runtimeTaskId} FOR UPDATE`;

    const rt = await tx.runtimeTask.findFirst({
      where: { id: params.runtimeTaskId, tenantId: params.tenantId },
      select: { id: true, flowId: true, tenantId: true },
    });
    if (!rt) {
      return { ok: false, kind: "not_found" };
    }

    const activation = await tx.activation.findUnique({
      where: { flowId: rt.flowId },
      select: { id: true },
    });

    const runtimeEvents = await tx.taskExecution.findMany({
      where: { runtimeTaskId: rt.id, taskKind: "RUNTIME" },
      select: { eventType: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const execution = deriveRuntimeExecutionSummary(runtimeEvents);
    const actionability = evaluateRuntimeTaskActionability(activation != null, execution);
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
          tenantId: rt.tenantId,
          flowId: rt.flowId,
          taskKind: "RUNTIME",
          runtimeTaskId: rt.id,
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
          runtimeTaskId: rt.id,
          flowId: row.flowId,
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
        where: { runtimeTaskId: rt.id, eventType: "COMPLETED" },
        select: { id: true, createdAt: true, flowId: true, actorUserId: true },
      });
      if (!existing) {
        throw e;
      }
      return {
        ok: true,
        data: {
          taskExecutionId: existing.id,
          runtimeTaskId: rt.id,
          flowId: existing.flowId,
          eventType: "COMPLETED",
          actorUserId: existing.actorUserId,
          createdAt: existing.createdAt.toISOString(),
          idempotentReplay: true,
        },
      };
    }
  });
}
