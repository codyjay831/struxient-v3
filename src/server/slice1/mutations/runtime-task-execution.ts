import { Prisma, type PrismaClient } from "@prisma/client";
import { evaluateRuntimeTaskActionability } from "../eligibility/task-actionability";
import { runtimeTaskBlockedByActiveHolds } from "../eligibility/hold-eligibility";
import { deriveRuntimeExecutionSummary } from "../reads/derive-runtime-execution-summary";
import { validateCompletionProofAgainstContract } from "./completion-proof-contract-validation";

export type RuntimeTaskExecutionRequestBody = {
  notes?: string | null;
  completionProof?: {
    note?: string | null;
    attachments?: {
      key: string;
      fileName: string;
      fileSize: number;
      contentType: string;
    }[];
    checklist?: { label: string; status: "yes" | "no" | "na" }[];
    measurements?: { label: string; value: string; unit?: string }[];
    identifiers?: { label: string; value: string }[];
    overallResult?: string | null;
  } | null;
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
  | { ok: false; kind: "flow_not_activated" }
  | { ok: false; kind: "payment_gate_unsatisfied" }
  | { ok: false; kind: "hold_active" };

export type CompleteRuntimeTaskResult =
  | { ok: true; data: TaskExecutionEventDto }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid_actor" }
  | { ok: false; kind: "not_started" }
  | { ok: false; kind: "flow_not_activated" }
  | { ok: false; kind: "validation_failed"; errors: { message: string; field?: string }[] };

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
      select: { id: true, flowId: true, tenantId: true, flow: { select: { jobId: true } } },
    });
    if (!rt) {
      return { ok: false, kind: "not_found" };
    }

    const activation = await tx.activation.findUnique({
      where: { flowId: rt.flowId },
      select: { id: true },
    });

    const hasUnsatisfiedPaymentGate = await tx.paymentGate.findFirst({
      where: {
        jobId: rt.flow.jobId,
        status: "UNSATISFIED",
        targets: {
          some: {
            taskId: rt.id,
            taskKind: "RUNTIME",
          },
        },
      },
      select: { id: true },
    });

    const activeHolds = await tx.hold.findMany({
      where: { tenantId: params.tenantId, jobId: rt.flow.jobId, status: "ACTIVE" },
      select: { runtimeTaskId: true },
    });
    const hasOperationalHold = runtimeTaskBlockedByActiveHolds(activeHolds, rt.id);

    const runtimeEvents = await tx.taskExecution.findMany({
      where: { runtimeTaskId: rt.id, taskKind: "RUNTIME" },
      select: { eventType: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const execution = deriveRuntimeExecutionSummary(runtimeEvents);
    const actionability = evaluateRuntimeTaskActionability(
      activation != null,
      execution,
      hasUnsatisfiedPaymentGate != null,
      hasOperationalHold,
    );
    if (actionability.start.reasons.includes("TASK_ALREADY_COMPLETED")) {
      return { ok: false, kind: "already_completed" };
    }
    if (actionability.start.reasons.includes("FLOW_NOT_ACTIVATED")) {
      return { ok: false, kind: "flow_not_activated" };
    }
    if (actionability.start.reasons.includes("PAYMENT_GATE_UNSATISFIED")) {
      return { ok: false, kind: "payment_gate_unsatisfied" };
    }
    if (actionability.start.reasons.includes("HOLD_ACTIVE")) {
      return { ok: false, kind: "hold_active" };
    }

    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!actor) {
      return { ok: false, kind: "invalid_actor" };
    }

    const notes = params.request.notes?.trim() || null;

    const existingStarted = await tx.taskExecution.findFirst({
      where: { runtimeTaskId: rt.id, eventType: "STARTED" },
      select: { id: true, createdAt: true, flowId: true, actorUserId: true },
    });

    if (existingStarted) {
      return {
        ok: true,
        data: {
          taskExecutionId: existingStarted.id,
          runtimeTaskId: rt.id,
          flowId: existingStarted.flowId,
          eventType: "STARTED",
          actorUserId: existingStarted.actorUserId,
          createdAt: existingStarted.createdAt.toISOString(),
          idempotentReplay: true,
        },
      };
    }

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
      select: { 
        id: true, 
        flowId: true, 
        tenantId: true,
        completionRequirementsJson: true,
        conditionalRulesJson: true
      },
    });
    if (!rt) {
      return { ok: false, kind: "not_found" };
    }

    const validationErrors = validateCompletionProofAgainstContract(
      rt.completionRequirementsJson,
      rt.conditionalRulesJson,
      params.request.completionProof,
    );
    if (validationErrors.length > 0) {
      return { ok: false, kind: "validation_failed", errors: validationErrors };
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
    const actionability = evaluateRuntimeTaskActionability(activation != null, execution, false, false);
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

    if (execution.status === "completed") {
      // Find the latest completed event for idempotent return
      const latestCompleted = await tx.taskExecution.findFirst({
        where: { runtimeTaskId: rt.id, eventType: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, flowId: true, actorUserId: true },
      });
      if (latestCompleted) {
        return {
          ok: true,
          data: {
            taskExecutionId: latestCompleted.id,
            runtimeTaskId: rt.id,
            flowId: latestCompleted.flowId,
            eventType: "COMPLETED",
            actorUserId: latestCompleted.actorUserId,
            createdAt: latestCompleted.createdAt.toISOString(),
            idempotentReplay: true,
          },
        };
      }
    }

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

    if (params.request.completionProof) {
        await tx.completionProof.create({
          data: {
            tenantId: rt.tenantId,
            runtimeTaskId: rt.id,
            taskExecutionId: row.id,
            note: params.request.completionProof.note?.trim() || null,
            checklistJson: params.request.completionProof.checklist || null,
            measurementsJson: params.request.completionProof.measurements || null,
            identifiersJson: params.request.completionProof.identifiers || null,
            overallResult: params.request.completionProof.overallResult || null,
            attachments: {
              create: (params.request.completionProof.attachments || []).map((a) => ({
                tenantId: rt.tenantId,
                storageKey: a.key,
                fileName: a.fileName,
                fileSize: a.fileSize,
                contentType: a.contentType,
                createdById: actor.id,
              })),
            },
          },
        });
      }

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
  });
}
