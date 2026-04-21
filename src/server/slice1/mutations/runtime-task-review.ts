import { Prisma, type PrismaClient } from "@prisma/client";
import { deriveRuntimeExecutionSummary } from "../reads/derive-runtime-execution-summary";

export type RuntimeTaskReviewRequestBody = {
  action: "ACCEPT" | "REQUEST_CORRECTION";
  feedback?: string | null;
};

export type TaskReviewResult =
  | { ok: true; data: { taskExecutionId: string } }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid_actor" }
  | { ok: false; kind: "not_completed" }
  | { ok: false; kind: "already_reviewed" };

/**
 * Office-side review of a COMPLETED runtime task.
 * Creates either a REVIEW_ACCEPTED or CORRECTION_REQUIRED event.
 */
export async function reviewRuntimeTaskForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    runtimeTaskId: string;
    actorUserId: string;
    request: RuntimeTaskReviewRequestBody;
  },
): Promise<TaskReviewResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) {
    return { ok: false, kind: "invalid_actor" };
  }

  return prisma.$transaction(async (tx) => {
    // Lock the task
    await tx.$queryRaw`SELECT id FROM "RuntimeTask" WHERE id = ${params.runtimeTaskId} FOR UPDATE`;

    const rt = await tx.runtimeTask.findFirst({
      where: { id: params.runtimeTaskId, tenantId: params.tenantId },
      select: { id: true, flowId: true, tenantId: true },
    });
    if (!rt) {
      return { ok: false, kind: "not_found" };
    }

    const events = await tx.taskExecution.findMany({
      where: { runtimeTaskId: rt.id, taskKind: "RUNTIME" },
      select: { eventType: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const summary = deriveRuntimeExecutionSummary(events);

    if (summary.status === "not_started" || summary.status === "in_progress") {
      return { ok: false, kind: "not_completed" };
    }
    if (summary.status === "accepted") {
      return { ok: false, kind: "already_reviewed" };
    }

    // Authorization check (stubbed for now per repo patterns, but assuming actor is office user)
    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true, role: true },
    });
    if (!actor) {
      return { ok: false, kind: "invalid_actor" };
    }

    const eventType = params.request.action === "ACCEPT" ? "REVIEW_ACCEPTED" : "CORRECTION_REQUIRED";
    const notes = params.request.feedback?.trim() || null;

    const row = await tx.taskExecution.create({
      data: {
        tenantId: rt.tenantId,
        flowId: rt.flowId,
        taskKind: "RUNTIME",
        runtimeTaskId: rt.id,
        eventType,
        actorUserId: actor.id,
        notes,
      },
      select: { id: true },
    });

    return {
      ok: true,
      data: { taskExecutionId: row.id },
    };
  });
}
