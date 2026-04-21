import type { PrismaClient } from "@prisma/client";

/**
 * Acknowledges receipt of the project-level verified evidence roll-up.
 */
export async function acknowledgeProjectShareReceipt(
  prisma: PrismaClient,
  params: { shareToken: string }
) {
  const fg = await prisma.flowGroup.findFirst({
    where: { 
      publicShareToken: params.shareToken, 
      publicShareStatus: "PUBLISHED",
      OR: [
        { publicShareExpiresAt: null },
        { publicShareExpiresAt: { gt: new Date() } }
      ]
    },
    select: { id: true, tenantId: true }
  });

  if (!fg) {
    throw new Error("Invalid or unpublished project share token.");
  }

  const now = new Date();
  await prisma.flowGroup.update({
    where: { id: fg.id },
    data: { publicShareReceiptAcknowledgedAt: now }
  });

  // Audit event
  await prisma.auditEvent.create({
    data: {
      tenantId: fg.tenantId,
      eventType: "PROJECT_SHARE_MANAGED",
      actorId: null,
      payloadJson: {
        action: "CUSTOMER_RECEIPT_ACKNOWLEDGED",
        flowGroupId: fg.id,
        timestamp: now.toISOString()
      }
    }
  });

  return { ok: true };
}

/**
 * Marks project portal response notifications as seen for an office user.
 */
export async function markProjectShareNotificationSeenForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; flowGroupId: string }
) {
  await prisma.flowGroup.update({
    where: { id: params.flowGroupId, tenantId: params.tenantId },
    data: { publicShareNotificationLastSeenAt: new Date() }
  });

  return { ok: true };
}

/**
 * Requests clarification on the project roll-up.
 */
export async function requestProjectShareClarification(
  prisma: PrismaClient,
  params: { shareToken: string; reason: string }
) {
  const fg = await prisma.flowGroup.findFirst({
    where: { 
      publicShareToken: params.shareToken, 
      publicShareStatus: "PUBLISHED",
      OR: [
        { publicShareExpiresAt: null },
        { publicShareExpiresAt: { gt: new Date() } }
      ]
    },
    select: { id: true, tenantId: true }
  });

  if (!fg) {
    throw new Error("Invalid or unpublished project share token.");
  }

  const now = new Date();
  await prisma.flowGroup.update({
    where: { id: fg.id },
    data: { 
      publicShareClarificationRequestedAt: now,
      publicShareClarificationReason: params.reason,
      publicShareClarificationResolvedAt: null,
      publicShareClarificationResolutionNote: null,
      publicShareClarificationEscalatedAt: null,
      // Reset acknowledgment when customer clarifies (they are saying the view is NOT correct/accepted)
      publicShareReceiptAcknowledgedAt: null
    }
  });

  // Audit event
  await prisma.auditEvent.create({
    data: {
      tenantId: fg.tenantId,
      eventType: "PROJECT_SHARE_MANAGED",
      actorId: null,
      payloadJson: {
        action: "CUSTOMER_CLARIFICATION_REQUESTED",
        flowGroupId: fg.id,
        reason: params.reason,
        timestamp: now.toISOString()
      }
    }
  });

  return { ok: true };
}

/**
 * Resolves a customer clarification request for the project.
 */
export async function resolveProjectShareClarificationForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; flowGroupId: string; note?: string }
) {
  const now = new Date();
  await prisma.flowGroup.update({
    where: { id: params.flowGroupId, tenantId: params.tenantId },
    data: { 
      publicShareClarificationResolvedAt: now,
      publicShareClarificationResolutionNote: params.note || null,
      // auto-mark notifications as seen when resolving
      publicShareNotificationLastSeenAt: now
    }
  });

  // Audit event
  await prisma.auditEvent.create({
    data: {
      tenantId: params.tenantId,
      eventType: "PROJECT_SHARE_MANAGED",
      actorId: null,
      payloadJson: {
        action: "CLARIFICATION_RESOLVED",
        flowGroupId: params.flowGroupId,
        note: params.note,
        timestamp: now.toISOString()
      }
    }
  });

  return { ok: true };
}

/**
 * Escalates a customer clarification request for the project.
 */
export async function escalateProjectShareClarificationForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; flowGroupId: string }
) {
  const now = new Date();
  await prisma.flowGroup.update({
    where: { id: params.flowGroupId, tenantId: params.tenantId },
    data: { 
      publicShareClarificationEscalatedAt: now,
    }
  });

  // Audit event
  await prisma.auditEvent.create({
    data: {
      tenantId: params.tenantId,
      eventType: "PROJECT_SHARE_MANAGED",
      actorId: null,
      payloadJson: {
        action: "CLARIFICATION_ESCALATED",
        flowGroupId: params.flowGroupId,
        timestamp: now.toISOString()
      }
    }
  });

  return { ok: true };
}
