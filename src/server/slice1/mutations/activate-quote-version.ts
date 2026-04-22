import type { Prisma, PrismaClient } from "@prisma/client";
import { parseExecutionPackageSnapshotV0ForActivation } from "../compose-preview/execution-package-for-activation";
import { indexFrozenGeneratedPlanV0 } from "../compose-preview/frozen-plan-for-activation";
import { canonicalStringify, sha256HexUtf8 } from "../compose-preview/freeze-snapshots";
import { materializePaymentGateFromFrozenIntentIfAbsent } from "./materialize-payment-gate-from-frozen-intent";

export type ActivateQuoteVersionSuccessDto = {
  quoteVersionId: string;
  activationId: string;
  flowId: string;
  jobId: string;
  workflowVersionId: string;
  runtimeTaskCount: number;
  /** Package slots skipped as workflow skeleton (canon/03 — no duplicate RuntimeTask rows). */
  skippedSkeletonSlotCount: number;
  activatedAt: string;
  idempotentReplay: boolean;
};

export type ActivateQuoteVersionResult =
  | { ok: true; data: ActivateQuoteVersionSuccessDto }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_signed"; status: string }
  | { ok: false; kind: "job_missing" }
  | { ok: false; kind: "missing_freeze" }
  | { ok: false; kind: "plan_hash_mismatch" }
  | { ok: false; kind: "invalid_plan_snapshot"; code: string; message: string }
  | { ok: false; kind: "plan_slot_mismatch"; planTaskId: string; packageTaskId: string }
  | { ok: false; kind: "package_hash_mismatch" }
  | { ok: false; kind: "invalid_package"; code: string; message: string }
  | { ok: false; kind: "invalid_activated_by" }
  | { ok: false; kind: "workflow_pin_mismatch"; message: string }
  | { ok: false; kind: "payment_gate_materialization_failed"; message: string };

export type ActivateQuoteFailure = Extract<ActivateQuoteVersionResult, { ok: false }>;

/** Thrown from sign transaction when tenant `autoActivateOnSign` and activation fails (full rollback). */
export class AutoActivateAfterSignError extends Error {
  readonly activationFailure: ActivateQuoteFailure;

  constructor(activationFailure: ActivateQuoteFailure) {
    super("AUTO_ACTIVATE_AFTER_SIGN_FAILED");
    this.name = "AutoActivateAfterSignError";
    this.activationFailure = activationFailure;
  }
}

/**
 * Idempotent activation: **SIGNED** quote version → **Flow** + **RuntimeTask** rows from **frozen** snapshots only.
 *
 * Does **not** call `getQuoteVersionScopeReadModel` or `runComposeFromReadModel` — consumes persisted
 * `generatedPlanSnapshot` + `executionPackageSnapshot` + hashes (`canon/03`, `epic 33`).
 * Reuses **Job** from sign (`decisions/04`).
 */
export async function activateQuoteVersionInTransaction(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    /** Server-derived actor (session user); must belong to tenant. */
    activatedByUserId: string;
  },
): Promise<ActivateQuoteVersionResult> {
  const activatedByUserId = params.activatedByUserId.trim();

  await tx.$queryRaw`SELECT id FROM "QuoteVersion" WHERE id = ${params.quoteVersionId} FOR UPDATE`;

  const locked = await tx.quoteVersion.findFirst({
    where: { id: params.quoteVersionId, quote: { tenantId: params.tenantId } },
    select: {
      id: true,
      status: true,
      createdById: true,
      signedById: true,
      pinnedWorkflowVersionId: true,
      planSnapshotSha256: true,
      generatedPlanSnapshot: true,
      packageSnapshotSha256: true,
      executionPackageSnapshot: true,
      quote: { select: { tenantId: true, flowGroupId: true } },
    },
  });

  if (!locked) {
    return { ok: false, kind: "not_found" };
  }

  const existingAct = await tx.activation.findFirst({
    where: { quoteVersionId: locked.id },
    include: {
      flow: { include: { _count: { select: { runtimeTasks: true } } } },
    },
  });

  if (existingAct?.flow) {
    let skippedSkeletonSlotCount = 0;
    let reparsedForGate: ReturnType<typeof parseExecutionPackageSnapshotV0ForActivation> | null = null;
    if (locked.executionPackageSnapshot != null) {
      const reparsed = parseExecutionPackageSnapshotV0ForActivation(locked.executionPackageSnapshot);
      if (reparsed.ok) {
        skippedSkeletonSlotCount = reparsed.skippedSkeletonSlotCount;
        reparsedForGate = reparsed;
      }
    }
    // Repair: snapshot has `paymentGateIntent` but gate row missing (partial legacy / migration).
    if (reparsedForGate?.ok && reparsedForGate.paymentGateIntent) {
      const gateRow = await tx.paymentGate.findFirst({
        where: { quoteVersionId: locked.id },
        select: { id: true },
      });
      if (!gateRow) {
        const rts = await tx.runtimeTask.findMany({
          where: { flowId: existingAct.flowId },
          select: { id: true, packageTaskId: true },
        });
        const runtimeTaskIdByPackageTaskId = new Map(rts.map((r) => [r.packageTaskId, r.id]));
        const mat = await materializePaymentGateFromFrozenIntentIfAbsent(tx, {
          tenantId: locked.quote.tenantId,
          jobId: existingAct.jobId,
          quoteVersionId: locked.id,
          intent: reparsedForGate.paymentGateIntent,
          runtimeTaskIdByPackageTaskId,
        });
        if (!mat.ok) {
          return { ok: false, kind: "payment_gate_materialization_failed", message: mat.message };
        }
      }
    }
    return {
      ok: true,
      data: {
        quoteVersionId: locked.id,
        activationId: existingAct.id,
        flowId: existingAct.flowId,
        jobId: existingAct.jobId,
        workflowVersionId: existingAct.flow.workflowVersionId,
        runtimeTaskCount: existingAct.flow._count.runtimeTasks,
        skippedSkeletonSlotCount,
        activatedAt: existingAct.activatedAt.toISOString(),
        idempotentReplay: true,
      },
    };
  }

  if (locked.status !== "SIGNED") {
    return { ok: false, kind: "not_signed", status: locked.status };
  }

  if (
    locked.pinnedWorkflowVersionId == null ||
    locked.planSnapshotSha256 == null ||
    locked.generatedPlanSnapshot == null ||
    locked.packageSnapshotSha256 == null ||
    locked.executionPackageSnapshot == null
  ) {
    return { ok: false, kind: "missing_freeze" };
  }

  const planComputedHash = sha256HexUtf8(canonicalStringify(locked.generatedPlanSnapshot));
  if (planComputedHash !== locked.planSnapshotSha256) {
    return { ok: false, kind: "plan_hash_mismatch" };
  }

  const planIndex = indexFrozenGeneratedPlanV0(locked.generatedPlanSnapshot, locked.id);
  if (!planIndex.ok) {
    return {
      ok: false,
      kind: "invalid_plan_snapshot",
      code: planIndex.code,
      message: planIndex.message,
    };
  }

  const computedPkgHash = sha256HexUtf8(canonicalStringify(locked.executionPackageSnapshot));
  if (computedPkgHash !== locked.packageSnapshotSha256) {
    return { ok: false, kind: "package_hash_mismatch" };
  }

  const parsed = parseExecutionPackageSnapshotV0ForActivation(locked.executionPackageSnapshot);
  if (!parsed.ok) {
    return { ok: false, kind: "invalid_package", code: parsed.code, message: parsed.message };
  }

  if (parsed.pinnedWorkflowVersionId !== locked.pinnedWorkflowVersionId) {
    return {
      ok: false,
      kind: "workflow_pin_mismatch",
      message: "Frozen package pinnedWorkflowVersionId does not match quote version pin.",
    };
  }

  for (const s of parsed.slots) {
    for (const ptid of s.planTaskIds) {
      if (!planIndex.planTaskIds.has(ptid)) {
        return {
          ok: false,
          kind: "plan_slot_mismatch",
          planTaskId: ptid,
          packageTaskId: s.packageTaskId,
        };
      }
    }
  }

  const job = await tx.job.findUnique({
    where: { flowGroupId: locked.quote.flowGroupId },
    select: { id: true },
  });
  if (!job) {
    return { ok: false, kind: "job_missing" };
  }

  const actor = await tx.user.findFirst({
    where: { id: activatedByUserId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!actor) {
    return { ok: false, kind: "invalid_activated_by" };
  }

  const flow = await tx.flow.create({
    data: {
      tenantId: locked.quote.tenantId,
      jobId: job.id,
      workflowVersionId: locked.pinnedWorkflowVersionId,
      quoteVersionId: locked.id,
    },
    select: { id: true },
  });

  const runtimeTaskIdByPackageTaskId = new Map<string, string>();
  for (const s of parsed.slots) {
    const rt = await tx.runtimeTask.create({
      data: {
        tenantId: locked.quote.tenantId,
        flowId: flow.id,
        packageTaskId: s.packageTaskId,
        nodeId: s.nodeId,
        quoteVersionId: locked.id,
        lineItemId: s.lineItemId,
        planTaskIds: s.planTaskIds,
        displayTitle: s.displayTitle,
        completionRequirementsJson: s.completionRequirementsJson,
        conditionalRulesJson: s.conditionalRulesJson,
        instructions: s.instructions,
      },
      select: { id: true },
    });
    runtimeTaskIdByPackageTaskId.set(s.packageTaskId, rt.id);
  }

  if (parsed.paymentGateIntent) {
    const mat = await materializePaymentGateFromFrozenIntentIfAbsent(tx, {
      tenantId: locked.quote.tenantId,
      jobId: job.id,
      quoteVersionId: locked.id,
      intent: parsed.paymentGateIntent,
      runtimeTaskIdByPackageTaskId,
    });
    if (!mat.ok) {
      return { ok: false, kind: "payment_gate_materialization_failed", message: mat.message };
    }
  }

  const activation = await tx.activation.create({
    data: {
      tenantId: locked.quote.tenantId,
      quoteVersionId: locked.id,
      jobId: job.id,
      flowId: flow.id,
      packageSnapshotSha256: locked.packageSnapshotSha256,
      activatedById: actor.id,
    },
    select: { id: true, activatedAt: true },
  });

  await tx.auditEvent.create({
    data: {
      tenantId: locked.quote.tenantId,
      eventType: "QUOTE_VERSION_ACTIVATED",
      actorId: actor.id,
      targetQuoteVersionId: locked.id,
      payloadJson: {
        activationId: activation.id,
        flowId: flow.id,
        jobId: job.id,
        runtimeTaskCount: parsed.slots.length,
        skippedSkeletonSlotCount: parsed.skippedSkeletonSlotCount,
        packageSnapshotSha256: locked.packageSnapshotSha256,
        planSnapshotSha256: locked.planSnapshotSha256,
      },
    },
  });

  return {
    ok: true,
    data: {
      quoteVersionId: locked.id,
      activationId: activation.id,
      flowId: flow.id,
      jobId: job.id,
      workflowVersionId: locked.pinnedWorkflowVersionId,
      runtimeTaskCount: parsed.slots.length,
      skippedSkeletonSlotCount: parsed.skippedSkeletonSlotCount,
      activatedAt: activation.activatedAt.toISOString(),
      idempotentReplay: false,
    },
  };
}

export async function activateQuoteVersionForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    activatedByUserId: string;
  },
): Promise<ActivateQuoteVersionResult> {
  return prisma.$transaction(
    (tx) => activateQuoteVersionInTransaction(tx, params),
    { timeout: 60_000 },
  );
}

/** Alias emphasizing idempotent ensure semantics (`epic 33`). */
export const ensureActivationForSignedQuoteVersion = activateQuoteVersionForTenant;
