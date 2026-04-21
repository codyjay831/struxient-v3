import { PublicShareDeliveryMethod, PublicShareStatus, type PrismaClient, PublicShareDeliveryStatus } from "@prisma/client";
import { getCommsProvider } from "../../comms/get-comms-provider";
import { renderEmailContent, renderSmsContent } from "../../comms/delivery-content";

export type SendFlowShareRequestBody = {
  method: PublicShareDeliveryMethod;
  recipientDetail: string; // Email or Phone
  baseUrl: string; // Required to construct the portal link
  isFollowUp?: boolean;
};

export type FlowShareDeliveryResult =
  | { ok: true; data: { deliveryId: string } }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_published" }
  | { ok: false; kind: "invalid_actor" };

export async function sendFlowShareForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    flowId: string;
    actorUserId: string;
    request: SendFlowShareRequestBody;
  },
): Promise<FlowShareDeliveryResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) {
    return { ok: false, kind: "invalid_actor" };
  }

  return prisma.$transaction(async (tx) => {
    // 1. Lock flow and verify it belongs to tenant and is PUBLISHED
    const flow = await tx.flow.findFirst({
      where: { id: params.flowId, tenantId: params.tenantId },
      select: { 
        id: true, 
        publicShareToken: true, 
        publicShareStatus: true,
        tenant: { select: { name: true } },
        job: {
          select: {
            flowGroup: {
              select: {
                name: true,
                customer: { select: { name: true } }
              }
            }
          }
        }
      },
    });

    if (!flow) {
      return { ok: false, kind: "not_found" };
    }

    if (flow.publicShareStatus !== PublicShareStatus.PUBLISHED || !flow.publicShareToken) {
      return { ok: false, kind: "not_published" };
    }

    // 2. Verify actor
    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!actor) {
      return { ok: false, kind: "invalid_actor" };
    }

    // 2b. Idempotency Check: Prevent duplicate sends within a short window (e.g. 1 min)
    const recentDuplicate = await tx.flowShareDelivery.findFirst({
      where: {
        flowId: flow.id,
        deliveryMethod: params.request.method,
        recipientDetail: params.request.recipientDetail,
        isFollowUp: params.request.isFollowUp || false,
        deliveredAt: { gte: new Date(Date.now() - 60 * 1000) },
        providerStatus: { in: [PublicShareDeliveryStatus.QUEUED, PublicShareDeliveryStatus.SENDING, PublicShareDeliveryStatus.SENT] }
      },
      select: { id: true }
    });

    if (recentDuplicate) {
        return {
            ok: true,
            data: { deliveryId: recentDuplicate.id },
        };
    }

    // 3. Create delivery record (Audit history)
    const delivery = await tx.flowShareDelivery.create({
      data: {
        tenantId: params.tenantId,
        flowId: flow.id,
        deliveredById: actor.id,
        deliveryMethod: params.request.method,
        recipientDetail: params.request.recipientDetail,
        shareToken: flow.publicShareToken,
        providerStatus: PublicShareDeliveryStatus.QUEUED,
        isFollowUp: params.request.isFollowUp || false,
      },
      select: { id: true },
    });

    // 3b. Update Flow last follow-up timestamp if applicable
    if (params.request.isFollowUp) {
      await tx.flow.update({
        where: { id: flow.id },
        data: { publicShareLastFollowUpSentAt: new Date() }
      });
    }

    // 4. Create Audit Event
    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "FLOW_SHARE_DELIVERED",
        actorId: actor.id,
        targetFlowId: flow.id,
        payloadJson: {
          deliveryId: delivery.id,
          method: params.request.method,
          recipient: params.request.recipientDetail,
        },
      },
    });

    // 5. Execute Provider Delivery (with simple retries)
    const portalUrl = `${params.request.baseUrl}/portal/flows/${flow.publicShareToken}`;
    const provider = getCommsProvider();

    const vars = {
      customerName: flow.job.flowGroup.customer.name,
      projectName: flow.job.flowGroup.name,
      portalUrl,
      companyName: flow.tenant.name,
    };

    const maxAttempts = 3;
    let attempt = 0;
    let sendResult: any = { ok: false, error: "Initial state" };

    // Update status to SENDING
    await tx.flowShareDelivery.update({
      where: { id: delivery.id },
      data: { providerStatus: PublicShareDeliveryStatus.SENDING }
    });
    
    while (attempt < maxAttempts) {
      attempt++;
      if (params.request.method === "EMAIL") {
        const content = renderEmailContent(vars, params.request.isFollowUp);
        sendResult = await provider.sendEmail({
          to: params.request.recipientDetail,
          subject: content.subject,
          body: content.body,
          html: content.html
        });
      } else if (params.request.method === "SMS") {
        const content = renderSmsContent(vars, params.request.isFollowUp);
        sendResult = await provider.sendSms({
          to: params.request.recipientDetail,
          message: content.body
        });
      } else {
        sendResult = { ok: true, externalId: "manual" };
      }

      if (sendResult.ok) break;

      // Transient failure? (In a real system, we'd check if the error is retryable)
      // For now, simple delay between attempts
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }

    // 6. Update Delivery record with final outcome
    await tx.flowShareDelivery.update({
      where: { id: delivery.id },
      data: {
        providerStatus: sendResult.ok ? PublicShareDeliveryStatus.SENT : PublicShareDeliveryStatus.FAILED,
        providerExternalId: sendResult.ok ? sendResult.externalId : undefined,
        providerError: sendResult.ok ? undefined : sendResult.error,
        providerResponse: sendResult.response || undefined,
        retryCount: attempt - 1,
      }
    });

    return {
      ok: true,
      data: { deliveryId: delivery.id },
    };
  });
}

export type RetryFlowShareDeliveryResult =
  | { ok: true; data: { deliveryId: string } }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_failed" }
  | { ok: false; kind: "invalid_actor" };

export async function retryFlowShareDeliveryForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    deliveryId: string;
    actorUserId: string;
    baseUrl: string;
  },
): Promise<RetryFlowShareDeliveryResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) return { ok: false, kind: "invalid_actor" };

  return prisma.$transaction(async (tx) => {
    const delivery = await tx.flowShareDelivery.findFirst({
      where: { id: params.deliveryId, tenantId: params.tenantId },
      include: {
        flow: {
          select: {
            id: true,
            publicShareToken: true,
            publicShareStatus: true,
            tenant: { select: { name: true } },
            job: {
              select: {
                flowGroup: {
                  select: {
                    name: true,
                    customer: { select: { name: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!delivery) return { ok: false, kind: "not_found" };
    if (delivery.providerStatus !== PublicShareDeliveryStatus.FAILED) {
      return { ok: false, kind: "not_failed" };
    }

    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!actor) return { ok: false, kind: "invalid_actor" };

    // Update status to SENDING before retry
    await tx.flowShareDelivery.update({
      where: { id: delivery.id },
      data: { providerStatus: PublicShareDeliveryStatus.SENDING }
    });

    const portalUrl = `${params.baseUrl}/portal/flows/${delivery.flow.publicShareToken}`;
    const provider = getCommsProvider();

    const vars = {
      customerName: delivery.flow.job.flowGroup.customer.name,
      projectName: delivery.flow.job.flowGroup.name,
      portalUrl,
      companyName: delivery.flow.tenant.name,
    };

    const maxAttempts = 3;
    let attempt = 0;
    let sendResult: any = { ok: false, error: "Initial state" };

    while (attempt < maxAttempts) {
      attempt++;
      if (delivery.deliveryMethod === "EMAIL") {
        const content = renderEmailContent(vars, delivery.isFollowUp);
        sendResult = await provider.sendEmail({
          to: delivery.recipientDetail!,
          subject: content.subject,
          body: content.body,
          html: content.html
        });
      } else if (delivery.deliveryMethod === "SMS") {
        const content = renderSmsContent(vars, delivery.isFollowUp);
        sendResult = await provider.sendSms({
          to: delivery.recipientDetail!,
          message: content.body
        });
      } else {
        sendResult = { ok: true, externalId: "manual" };
      }

      if (sendResult.ok) break;
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }

    await tx.flowShareDelivery.update({
      where: { id: delivery.id },
      data: {
        providerStatus: sendResult.ok ? PublicShareDeliveryStatus.SENT : PublicShareDeliveryStatus.FAILED,
        providerExternalId: sendResult.ok ? sendResult.externalId : delivery.providerExternalId,
        providerError: sendResult.ok ? null : sendResult.error,
        providerResponse: sendResult.response || delivery.providerResponse || undefined,
        retryCount: (delivery.retryCount || 0) + attempt,
        deliveredAt: new Date(), // Update timestamp on successful retry
      }
    });

    // Log the retry audit event
    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "FLOW_SHARE_DELIVERED",
        actorId: actor.id,
        targetFlowId: delivery.flowId,
        payloadJson: {
          deliveryId: delivery.id,
          retry: true,
          status: sendResult.ok ? "SENT" : "FAILED"
        }
      }
    });

    return { ok: true, data: { deliveryId: delivery.id } };
  });
}
