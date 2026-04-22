import type { PrismaClient } from "@prisma/client";
import { InvariantViolationError } from "../errors";

const MAX_HOLD_REASON = 4000;

function assertHoldReason(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new InvariantViolationError("HOLD_INVALID_REASON", "Hold reason must be a non-empty string.", {});
  }
  const s = raw.trim();
  if (s.length === 0 || s.length > MAX_HOLD_REASON) {
    throw new InvariantViolationError(
      "HOLD_INVALID_REASON",
      `Hold reason must be 1–${MAX_HOLD_REASON} characters.`,
      {},
    );
  }
  return s;
}

export type CreateOperationalHoldInput = {
  tenantId: string;
  jobId: string;
  createdById: string;
  reason: unknown;
  /** When set, hold applies only to this runtime task (must belong to `jobId`). */
  runtimeTaskId?: string | null;
};

export async function createOperationalHoldForJob(
  prisma: PrismaClient,
  input: CreateOperationalHoldInput,
): Promise<{ id: string }> {
  const reason = assertHoldReason(input.reason);
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!job) {
    throw new InvariantViolationError("HOLD_NOT_FOUND", "Job not found for tenant.", { jobId: input.jobId });
  }

  const actor = await prisma.user.findFirst({
    where: { id: input.createdById, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!actor) {
    throw new InvariantViolationError("HOLD_NOT_FOUND", "Creating user not found in tenant.", {});
  }

  let runtimeTaskId: string | null =
    input.runtimeTaskId === undefined || input.runtimeTaskId === null || input.runtimeTaskId === ""
      ? null
      : String(input.runtimeTaskId).trim() || null;

  if (runtimeTaskId) {
    const rt = await prisma.runtimeTask.findFirst({
      where: { id: runtimeTaskId, tenantId: input.tenantId, flow: { jobId: input.jobId } },
      select: { id: true },
    });
    if (!rt) {
      throw new InvariantViolationError(
        "HOLD_RUNTIME_TASK_NOT_ON_JOB",
        "Runtime task not found on this job for tenant.",
        { runtimeTaskId },
      );
    }
  }

  const row = await prisma.hold.create({
    data: {
      tenantId: input.tenantId,
      jobId: input.jobId,
      runtimeTaskId,
      holdType: "OPERATIONAL_CUSTOM",
      status: "ACTIVE",
      reason,
      createdById: actor.id,
    },
    select: { id: true },
  });
  return { id: row.id };
}

export async function releaseHoldForTenant(
  prisma: PrismaClient,
  input: { tenantId: string; holdId: string; releasedById: string },
): Promise<void> {
  const actor = await prisma.user.findFirst({
    where: { id: input.releasedById, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!actor) {
    throw new InvariantViolationError("HOLD_NOT_FOUND", "Releasing user not found in tenant.", {});
  }

  const hold = await prisma.hold.findFirst({
    where: { id: input.holdId, tenantId: input.tenantId },
    select: { id: true, status: true },
  });
  if (!hold) {
    throw new InvariantViolationError("HOLD_NOT_FOUND", "Hold not found for tenant.", { holdId: input.holdId });
  }
  if (hold.status !== "ACTIVE") {
    throw new InvariantViolationError(
      "HOLD_RELEASE_NOT_ACTIVE",
      "Only an ACTIVE hold can be released.",
      { holdId: hold.id, status: hold.status },
    );
  }

  await prisma.hold.update({
    where: { id: hold.id },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
      releasedById: actor.id,
    },
  });
}
