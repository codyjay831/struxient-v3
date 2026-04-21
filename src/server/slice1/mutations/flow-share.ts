import { Prisma, type PrismaClient, PublicShareStatus } from "@prisma/client";

function generateShareToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export type FlowShareAction = "PUBLISH" | "REVOKE" | "REGENERATE" | "SET_EXPIRATION";

export type FlowShareResult =
  | { ok: true; data: { flowId: string; publicShareToken: string | null; publicShareStatus: PublicShareStatus; publicShareExpiresAt: Date | null } }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid_actor" };

export async function manageFlowShareForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    flowId: string;
    actorUserId: string;
    action: FlowShareAction;
    expiresAt?: Date | null;
  },
): Promise<FlowShareResult> {
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
        publicShareToken: true, 
        publicShareStatus: true,
        job: { select: { flowGroupId: true } }
      },
    });
    if (!flow) {
      return { ok: false, kind: "not_found" };
    }

    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true, role: true },
    });
    if (!actor) {
      return { ok: false, kind: "invalid_actor" };
    }

    let nextToken = flow.publicShareToken;
    let nextStatus = flow.publicShareStatus;
    let nextGeneratedAt: Date | null = null;
    let nextExpiresAt: Date | null | undefined = undefined;
    let resetResponses = false;
    let resetParentRollup = false;

    if (params.action === "PUBLISH") {
      nextStatus = PublicShareStatus.PUBLISHED;
      if (!nextToken) {
        nextToken = generateShareToken();
        nextGeneratedAt = new Date();
      }
      resetParentRollup = true;
    } else if (params.action === "REVOKE") {
      nextStatus = PublicShareStatus.UNPUBLISHED;
      resetParentRollup = true;
    } else if (params.action === "REGENERATE") {
      nextToken = generateShareToken();
      nextGeneratedAt = new Date();
      resetResponses = true;
      resetParentRollup = true;
    } else if (params.action === "SET_EXPIRATION") {
      nextExpiresAt = params.expiresAt;
    }

    const updated = await tx.flow.update({
      where: { id: params.flowId },
      data: {
        publicShareToken: nextToken,
        publicShareStatus: nextStatus,
        publicShareTokenGeneratedAt: nextGeneratedAt || undefined,
        publicShareExpiresAt: nextExpiresAt,
        publicShareReceiptAcknowledgedAt: resetResponses ? null : undefined,
        publicShareClarificationRequestedAt: resetResponses ? null : undefined,
        publicShareClarificationReason: resetResponses ? null : undefined,
      },
      select: { id: true, publicShareToken: true, publicShareStatus: true, publicShareExpiresAt: true },
    });

    if (resetParentRollup) {
      await tx.flowGroup.update({
        where: { id: flow.job.flowGroupId },
        data: { publicShareReceiptAcknowledgedAt: null }
      });
    }

    // Audit the action
    await tx.auditEvent.create({
        data: {
          tenantId: params.tenantId,
          eventType: "FLOW_SHARE_MANAGED",
          actorId: actor.id,
          targetFlowId: params.flowId,
          payloadJson: {
            action: params.action,
            prevStatus: flow.publicShareStatus,
            nextStatus: updated.publicShareStatus,
            expiresAt: updated.publicShareExpiresAt,
          },
        },
      });

    return {
      ok: true,
      data: {
        flowId: updated.id,
        publicShareToken: updated.publicShareToken,
        publicShareStatus: updated.publicShareStatus,
        publicShareExpiresAt: updated.publicShareExpiresAt,
      },
    };
  });
}
