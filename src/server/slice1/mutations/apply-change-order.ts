import { Prisma, type PrismaClient } from "@prisma/client";
import { activateQuoteVersionInTransaction } from "./activate-quote-version";

export type ApplyChangeOrderResult =
  | { ok: true; data: { changeOrderId: string; appliedAt: string; supersededTaskCount: number; addedTaskCount: number; transferredExecutionCount: number } }
  | { ok: false; kind: "change_order_not_found" }
  | { ok: false; kind: "invalid_status"; status: string }
  | { ok: false; kind: "activation_failed"; detail: string }
  | { ok: false; kind: "payment_gate_block"; unsatisfiedGateIds: string[] }
  | { ok: false; kind: "invalid_applied_by" };

/**
 * Applies an approved Change Order to the job execution structure.
 * 1. Activates the CO draft version -> creates NEW Flow and RuntimeTasks.
 * 2. Reconciles with PREVIOUS active tasks for the same job.
 * 3. For every OLD task:
 *    - Marks as superseded by this CO.
 *    - If a task with the SAME packageTaskId exists in the NEW flow, transfers its executions.
 * 4. Checks Payment Gates: Blocks if any superseded task is targeted by an unsatisfied gate.
 */
export async function applyChangeOrderForJob(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    changeOrderId: string;
    appliedByUserId: string;
  },
): Promise<ApplyChangeOrderResult> {
  const actor = await prisma.user.findFirst({
    where: { id: params.appliedByUserId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!actor) {
    return { ok: false, kind: "invalid_applied_by" };
  }

  return prisma.$transaction(async (tx): Promise<ApplyChangeOrderResult> => {
    const co = await tx.changeOrder.findFirst({
      where: { id: params.changeOrderId, tenantId: params.tenantId },
      include: {
        draftQuoteVersion: true,
      },
    });

    if (!co) {
      return { ok: false, kind: "change_order_not_found" };
    }

    if (co.status === "APPLIED") {
      return { ok: false, kind: "invalid_status", status: co.status };
    }

    // Allow apply if SIGNED (commercial) or PM marked it READY_TO_APPLY
    if (co.status !== "READY_TO_APPLY" && co.draftQuoteVersion?.status !== "SIGNED") {
       return { ok: false, kind: "invalid_status", status: co.status };
    }

    const draftVersionId = co.draftQuoteVersionId;
    if (!draftVersionId) {
       return { ok: false, kind: "change_order_not_found" };
    }

    // 1. Activate the CO version
    const actResult = await activateQuoteVersionInTransaction(tx, {
      tenantId: params.tenantId,
      quoteVersionId: draftVersionId,
      activatedByUserId: actor.id,
    });

    if (!actResult.ok) {
      return { ok: false, kind: "activation_failed", detail: actResult.kind };
    }

    const newFlowId = actResult.data.flowId;

    // 2. Identify all currently active tasks for this job (from previous flows)
    const oldActiveTasks = await tx.runtimeTask.findMany({
      where: {
        tenantId: params.tenantId,
        flow: { jobId: co.jobId },
        flowId: { not: newFlowId },
        changeOrderIdSuperseded: null,
      },
      include: {
        taskExecutions: true,
      },
    });

    const oldTaskIds = oldActiveTasks.map(t => t.id);

    // 3. Check for unsatisfied payment gates targeting these tasks
    const unsatisfiedGates = await tx.paymentGate.findMany({
      where: {
        jobId: co.jobId,
        status: "UNSATISFIED",
        targets: {
          some: {
            taskId: { in: oldTaskIds },
            taskKind: "RUNTIME",
          }
        }
      },
      select: { id: true },
    });

    if (unsatisfiedGates.length > 0) {
      return {
        ok: false,
        kind: "payment_gate_block",
        unsatisfiedGateIds: unsatisfiedGates.map(g => g.id),
      };
    }

    // 4. Match and Transfer Executions
    const newTasks = await tx.runtimeTask.findMany({
      where: { flowId: newFlowId },
    });

    let transferredExecutionCount = 0;

    for (const oldTask of oldActiveTasks) {
      const newTask = newTasks.find(nt => nt.packageTaskId === oldTask.packageTaskId);
      
      if (newTask) {
        // Transfer executions to preserve progress
        for (const exec of oldTask.taskExecutions) {
          await tx.taskExecution.create({
            data: {
              tenantId: params.tenantId,
              flowId: newFlowId,
              taskKind: "RUNTIME",
              runtimeTaskId: newTask.id,
              eventType: exec.eventType,
              actorUserId: exec.actorUserId,
              notes: exec.notes ? `(Transferred from CO ${co.id}) ${exec.notes}` : `(Transferred from CO ${co.id})`,
              createdAt: exec.createdAt, // Preserve original timestamp
            }
          });
          transferredExecutionCount++;
        }
      }

      // Mark old as superseded
      await tx.runtimeTask.update({
        where: { id: oldTask.id },
        data: { changeOrderIdSuperseded: co.id },
      });
    }

    // Mark all new tasks as created by this CO
    await tx.runtimeTask.updateMany({
      where: { flowId: newFlowId },
      data: { changeOrderIdCreated: co.id },
    });

    // 5. Finalize CO
    const appliedAt = new Date();
    await tx.changeOrder.update({
      where: { id: co.id },
      data: {
        status: "APPLIED",
        appliedAt,
        appliedById: actor.id,
      },
    });

    return {
      ok: true,
      data: {
        changeOrderId: co.id,
        appliedAt: appliedAt.toISOString(),
        supersededTaskCount: oldActiveTasks.length,
        addedTaskCount: actResult.data.runtimeTaskCount,
        transferredExecutionCount,
      },
    };
  }, { timeout: 60000 });
}
