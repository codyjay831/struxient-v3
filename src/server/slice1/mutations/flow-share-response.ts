import type { PrismaClient } from "@prisma/client";

/**
 * Acknowledges receipt of the verified evidence.
 */
export async function acknowledgeFlowShareReceipt(
  prisma: PrismaClient,
  params: { shareToken: string }
) {
  const flow = await prisma.flow.findFirst({
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

  if (!flow) {
    throw new Error("Invalid or unpublished share token.");
  }

  const now = new Date();
  await prisma.flow.update({
    where: { id: flow.id },
    data: { publicShareReceiptAcknowledgedAt: now }
  });

  // Audit event
  await prisma.auditEvent.create({
    data: {
      tenantId: flow.tenantId,
      eventType: "FLOW_SHARE_MANAGED",
      actorId: null, // No internal user actor for customer portal actions
      targetFlowId: flow.id,
      payloadJson: {
        action: "CUSTOMER_RECEIPT_ACKNOWLEDGED",
        timestamp: now.toISOString()
      }
    }
  });

  return { ok: true };
}

/**
 * Requests clarification on the verified evidence.
 */
export async function requestFlowShareClarification(
  prisma: PrismaClient,
  params: { shareToken: string; reason: string }
) {
  const flow = await prisma.flow.findFirst({
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

  if (!flow) {
    throw new Error("Invalid or unpublished share token.");
  }

  const now = new Date();
  await prisma.flow.update({
    where: { id: flow.id },
    data: { 
      publicShareClarificationRequestedAt: now,
      publicShareClarificationReason: params.reason,
      // Clear resolved status when a NEW clarification is requested
      publicShareClarificationResolvedAt: null,
      publicShareClarificationResolutionNote: null
    }
  });

  // Audit event
  await prisma.auditEvent.create({
    data: {
      tenantId: flow.tenantId,
      eventType: "FLOW_SHARE_MANAGED",
      actorId: null,
      targetFlowId: flow.id,
      payloadJson: {
        action: "CUSTOMER_CLARIFICATION_REQUESTED",
        reason: params.reason,
        timestamp: now.toISOString()
      }
    }
  });

  return { ok: true };
}

/**
 * Marks portal response notifications as seen for an office user.
 */
export async function markFlowShareNotificationSeenForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; flowId: string }
) {
  await prisma.flow.update({
    where: { id: params.flowId, tenantId: params.tenantId },
    data: { publicShareNotificationLastSeenAt: new Date() }
  });

  return { ok: true };
}

/**
 * Resolves a customer clarification request.
 */
export async function resolveFlowShareClarificationForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; flowId: string; note?: string }
) {
  const now = new Date();
  await prisma.flow.update({
    where: { id: params.flowId, tenantId: params.tenantId },
    data: { 
      publicShareClarificationResolvedAt: now,
      publicShareClarificationResolutionNote: params.note || null,
      // We also auto-mark notifications as seen when resolving
      publicShareNotificationLastSeenAt: now
    }
  });

  // Audit event
  await prisma.auditEvent.create({
    data: {
      tenantId: params.tenantId,
      eventType: "FLOW_SHARE_MANAGED",
      actorId: null,
      targetFlowId: params.flowId,
      payloadJson: {
        action: "CLARIFICATION_RESOLVED",
        note: params.note,
        timestamp: now.toISOString()
      }
    }
  });

  return { ok: true };
}
