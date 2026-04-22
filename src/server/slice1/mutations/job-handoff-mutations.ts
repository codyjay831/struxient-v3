import type { Prisma, PrismaClient } from "@prisma/client";
import { canAcknowledgeJobHandoff } from "@/lib/jobs/job-handoff-ack-rules";
import { parseAssignedUserIdsJson } from "../reads/job-handoff-reads";

const MAX_ASSIGNEES = 50;
const MAX_BRIEFING_CHARS = 24_000;

export type UpsertJobHandoffDraftInput = {
  briefingNotes?: string | null;
  assignedUserIds?: string[];
};

export type UpsertJobHandoffDraftResult =
  | { ok: true }
  | { ok: false; kind: "job_not_found" | "not_activated" | "invalid_assignees" | "not_editable" | "briefing_too_long" };

export type SendJobHandoffResult =
  | { ok: true }
  | { ok: false; kind: "job_not_found" | "handoff_not_found" | "not_draft" };

export type AcknowledgeJobHandoffResult =
  | { ok: true }
  | {
      ok: false;
      kind: "job_not_found" | "handoff_not_found" | "not_sent" | "not_eligible";
    };

async function validateAssignees(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ids: string[],
): Promise<boolean> {
  if (ids.length > MAX_ASSIGNEES) return false;
  const unique = [...new Set(ids)];
  if (unique.length === 0) return true;
  const n = await tx.user.count({
    where: { tenantId, id: { in: unique } },
  });
  return n === unique.length;
}

function normalizeBriefing(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  return t.length === 0 ? null : t;
}

/**
 * Create (if missing) or update a `DRAFT` handoff for an activated job.
 * Does not send or acknowledge — office-only (`office_mutate`).
 */
export async function upsertJobHandoffDraftForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    jobId: string;
    actorUserId: string;
    input: UpsertJobHandoffDraftInput;
  },
): Promise<UpsertJobHandoffDraftResult> {
  const briefingIn = params.input.briefingNotes;
  if (briefingIn !== undefined) {
    const briefing = normalizeBriefing(briefingIn);
    if (briefing != null && briefing.length > MAX_BRIEFING_CHARS) {
      return { ok: false, kind: "briefing_too_long" };
    }
  }
  const assigneesInput = params.input.assignedUserIds;

  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({
      where: { id: params.jobId, tenantId: params.tenantId },
      select: { id: true, flowGroupId: true },
    });
    if (!job) return { ok: false, kind: "job_not_found" } as const;

    const activation = await tx.activation.findFirst({
      where: { jobId: job.id },
      orderBy: { activatedAt: "asc" },
      select: {
        quoteVersionId: true,
        flowId: true,
        quoteVersion: { select: { quote: { select: { flowGroupId: true } } } },
      },
    });
    if (!activation) {
      return { ok: false, kind: "not_activated" } as const;
    }
    if (activation.quoteVersion.quote.flowGroupId !== job.flowGroupId) {
      return { ok: false, kind: "not_activated" } as const;
    }

    const assignees = assigneesInput ?? [];
    if (!(await validateAssignees(tx, params.tenantId, assignees))) {
      return { ok: false, kind: "invalid_assignees" } as const;
    }

    const existing = await tx.jobHandoff.findFirst({
      where: { jobId: job.id, tenantId: params.tenantId },
      select: { id: true, status: true },
    });

    const jsonAssignees = assignees as unknown as Prisma.InputJsonValue;
    const briefingForCreate =
      briefingIn === undefined ? null : normalizeBriefing(briefingIn);

    if (!existing) {
      await tx.jobHandoff.create({
        data: {
          tenantId: params.tenantId,
          jobId: job.id,
          quoteVersionId: activation.quoteVersionId,
          status: "DRAFT",
          briefingNotes: briefingForCreate,
          assignedUserIds: jsonAssignees,
          createdByUserId: params.actorUserId,
        },
      });
      return { ok: true } as const;
    }

    if (existing.status !== "DRAFT") {
      return { ok: false, kind: "not_editable" } as const;
    }

    const updateData: { briefingNotes?: string | null; assignedUserIds?: Prisma.InputJsonValue } = {};
    if (briefingIn !== undefined) {
      updateData.briefingNotes = normalizeBriefing(briefingIn);
    }
    if (assigneesInput !== undefined) {
      updateData.assignedUserIds = jsonAssignees;
    }

    await tx.jobHandoff.update({
      where: { id: existing.id },
      data: updateData,
    });
    return { ok: true } as const;
  });
}

export async function sendJobHandoffForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; jobId: string; actorUserId: string },
): Promise<SendJobHandoffResult> {
  const jobOk = await prisma.job.findFirst({
    where: { id: params.jobId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!jobOk) {
    return { ok: false, kind: "job_not_found" };
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.jobHandoff.findFirst({
      where: { jobId: params.jobId, tenantId: params.tenantId },
      select: { id: true, status: true, quoteVersionId: true, job: { select: { id: true } } },
    });
    if (!row) return { ok: false, kind: "handoff_not_found" } as const;
    if (row.status !== "DRAFT") return { ok: false, kind: "not_draft" } as const;

    await tx.jobHandoff.update({
      where: { id: row.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sentByUserId: params.actorUserId,
      },
    });

    const activation = await tx.activation.findFirst({
      where: { jobId: params.jobId },
      select: { flowId: true },
      orderBy: { activatedAt: "asc" },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "JOB_HANDOFF_SENT",
        actorId: params.actorUserId,
        targetQuoteVersionId: row.quoteVersionId,
        targetFlowId: activation?.flowId ?? null,
        payloadJson: {
          jobId: params.jobId,
          jobHandoffId: row.id,
        },
      },
    });

    return { ok: true } as const;
  });
}

export async function acknowledgeJobHandoffForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    jobId: string;
    actorUserId: string;
    canFieldExecute: boolean;
  },
): Promise<AcknowledgeJobHandoffResult> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({
      where: { id: params.jobId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!job) return { ok: false, kind: "job_not_found" } as const;

    const row = await tx.jobHandoff.findFirst({
      where: { jobId: params.jobId, tenantId: params.tenantId },
      select: { id: true, status: true, quoteVersionId: true, assignedUserIds: true },
    });
    if (!row) return { ok: false, kind: "handoff_not_found" } as const;
    if (row.status !== "SENT") return { ok: false, kind: "not_sent" } as const;

    const assigned = parseAssignedUserIdsJson(row.assignedUserIds);
    if (
      !canAcknowledgeJobHandoff({
        status: row.status,
        assignedUserIds: assigned,
        principalUserId: params.actorUserId,
        hasFieldExecuteCapability: params.canFieldExecute,
      })
    ) {
      return { ok: false, kind: "not_eligible" } as const;
    }

    await tx.jobHandoff.update({
      where: { id: row.id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedByUserId: params.actorUserId,
      },
    });

    const activation = await tx.activation.findFirst({
      where: { jobId: params.jobId },
      select: { flowId: true },
      orderBy: { activatedAt: "asc" },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "JOB_HANDOFF_ACKNOWLEDGED",
        actorId: params.actorUserId,
        targetQuoteVersionId: row.quoteVersionId,
        targetFlowId: activation?.flowId ?? null,
        payloadJson: {
          jobId: params.jobId,
          jobHandoffId: row.id,
        },
      },
    });

    return { ok: true } as const;
  });
}
