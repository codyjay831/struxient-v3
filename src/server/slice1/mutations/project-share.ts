import { Prisma, type PrismaClient, PublicShareStatus } from "@prisma/client";

function generateShareToken(): string {
  return "PRJ-" + Math.random().toString(36).substring(2, 15);
}

export type ProjectShareAction = "PUBLISH" | "REVOKE" | "REGENERATE" | "SET_EXPIRATION";

export async function manageProjectShareForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    flowGroupId: string;
    actorUserId: string;
    action: ProjectShareAction;
    expiresAt?: Date | null;
  }
) {
  const actorId = params.actorUserId.trim();
  if (!actorId) throw new Error("Invalid actor");

  return prisma.$transaction(async (tx) => {
    const fg = await tx.flowGroup.findFirst({
      where: { id: params.flowGroupId, tenantId: params.tenantId },
      select: { id: true, publicShareToken: true, publicShareStatus: true }
    });
    if (!fg) throw new Error("Flow group not found");

    let nextToken = fg.publicShareToken;
    let nextStatus = fg.publicShareStatus;
    let nextGeneratedAt: Date | null = null;
    let nextExpiresAt: Date | null | undefined = undefined;

    if (params.action === "PUBLISH") {
      nextStatus = PublicShareStatus.PUBLISHED;
      if (!nextToken) {
        nextToken = generateShareToken();
        nextGeneratedAt = new Date();
      }
    } else if (params.action === "REVOKE") {
      nextStatus = PublicShareStatus.UNPUBLISHED;
    } else if (params.action === "REGENERATE") {
      nextToken = generateShareToken();
      nextGeneratedAt = new Date();
    } else if (params.action === "SET_EXPIRATION") {
      nextExpiresAt = params.expiresAt;
    }

    const updated = await tx.flowGroup.update({
      where: { id: params.flowGroupId },
      data: {
        publicShareToken: nextToken,
        publicShareStatus: nextStatus,
        publicShareTokenGeneratedAt: nextGeneratedAt || undefined,
        publicShareExpiresAt: nextExpiresAt,
        publicShareReceiptAcknowledgedAt: params.action === "REGENERATE" ? null : undefined,
      },
      select: { id: true, publicShareToken: true, publicShareStatus: true, publicShareExpiresAt: true, publicShareReceiptAcknowledgedAt: true }
    });

    // Audit
    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "PROJECT_SHARE_MANAGED",
        actorId: actorId,
        payloadJson: {
          action: params.action,
          flowGroupId: params.flowGroupId,
          nextStatus: updated.publicShareStatus
        }
      }
    });

    return { ok: true, data: updated };
  });
}
