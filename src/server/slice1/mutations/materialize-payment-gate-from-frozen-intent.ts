import type { Prisma } from "@prisma/client";
import type { FrozenPaymentGateIntentV0 } from "../compose-preview/execution-package-for-activation";

export type MaterializePaymentGateFromFrozenIntentResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Creates a job-scoped `PaymentGate` + RUNTIME targets from frozen `paymentGateIntent.v0` when absent.
 * Idempotent per `quoteVersionId` (unique). Targets resolve via stable `packageTaskId` → activated `RuntimeTask.id`.
 */
export async function materializePaymentGateFromFrozenIntentIfAbsent(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    jobId: string;
    quoteVersionId: string;
    intent: FrozenPaymentGateIntentV0;
    runtimeTaskIdByPackageTaskId: Map<string, string>;
  },
): Promise<MaterializePaymentGateFromFrozenIntentResult> {
  const existing = await tx.paymentGate.findFirst({
    where: { quoteVersionId: params.quoteVersionId },
    select: { id: true },
  });
  if (existing) {
    return { ok: true };
  }

  const targetCreates: { taskKind: "RUNTIME"; taskId: string }[] = [];
  for (const pkg of params.intent.targetPackageTaskIds) {
    const taskId = params.runtimeTaskIdByPackageTaskId.get(pkg);
    if (!taskId) {
      return {
        ok: false,
        message: `Frozen paymentGateIntent references packageTaskId "${pkg}" with no runtime task in this flow.`,
      };
    }
    targetCreates.push({ taskKind: "RUNTIME", taskId });
  }

  await tx.paymentGate.create({
    data: {
      tenantId: params.tenantId,
      jobId: params.jobId,
      quoteVersionId: params.quoteVersionId,
      title: params.intent.title,
      status: "UNSATISFIED",
      targets: { create: targetCreates },
    },
  });

  return { ok: true };
}
