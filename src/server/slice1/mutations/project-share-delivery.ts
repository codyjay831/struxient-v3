import { PublicShareDeliveryMethod, PublicShareStatus, type PrismaClient, PublicShareDeliveryStatus } from "@prisma/client";
import { getCommsProvider } from "../../comms/get-comms-provider";
import { renderProjectEmailContent, renderProjectSmsContent } from "../../comms/delivery-content";

export type SendProjectShareRequestBody = {
  method: PublicShareDeliveryMethod;
  recipientDetail: string; // Email or Phone
  baseUrl: string; // Required to construct the portal link
};

export type ProjectShareDeliveryResult =
  | { ok: true; data: { deliveryId: string } }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_published" }
  | { ok: false; kind: "invalid_actor" };

export async function sendProjectShareForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    flowGroupId: string;
    actorUserId: string;
    request: SendProjectShareRequestBody;
  },
): Promise<ProjectShareDeliveryResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) {
    return { ok: false, kind: "invalid_actor" };
  }

  return prisma.$transaction(async (tx) => {
    // 1. Lock flow group and verify it belongs to tenant and is PUBLISHED
    const flowGroup = await tx.flowGroup.findFirst({
      where: { id: params.flowGroupId, tenantId: params.tenantId },
      select: { 
        id: true, 
        publicShareToken: true, 
        publicShareStatus: true,
        name: true,
        customer: { select: { name: true } },
        tenant: { select: { name: true } }
      },
    });

    if (!flowGroup) {
      return { ok: false, kind: "not_found" };
    }

    if (flowGroup.publicShareStatus !== PublicShareStatus.PUBLISHED || !flowGroup.publicShareToken) {
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
    const recentDuplicate = await tx.projectShareDelivery.findFirst({
      where: {
        flowGroupId: flowGroup.id,
        deliveryMethod: params.request.method,
        recipientDetail: params.request.recipientDetail,
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
    const delivery = await tx.projectShareDelivery.create({
      data: {
        tenantId: params.tenantId,
        flowGroupId: flowGroup.id,
        deliveredById: actor.id,
        deliveryMethod: params.request.method,
        recipientDetail: params.request.recipientDetail,
        shareToken: flowGroup.publicShareToken,
        providerStatus: PublicShareDeliveryStatus.QUEUED,
      },
      select: { id: true },
    });

    // 4. Create Audit Event
    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "PROJECT_SHARE_DELIVERED",
        actorId: actor.id,
        payloadJson: {
          deliveryId: delivery.id,
          flowGroupId: flowGroup.id,
          method: params.request.method,
          recipient: params.request.recipientDetail,
        },
      },
    });

    // 5. Execute Provider Delivery
    const portalUrl = `${params.request.baseUrl}/portal/projects/${flowGroup.publicShareToken}`;
    const provider = getCommsProvider();

    const vars = {
      customerName: flowGroup.customer.name,
      projectName: flowGroup.name,
      portalUrl,
      companyName: flowGroup.tenant.name,
    };

    const maxAttempts = 3;
    let attempt = 0;
    let sendResult: any = { ok: false, error: "Initial state" };

    // Update status to SENDING
    await tx.projectShareDelivery.update({
      where: { id: delivery.id },
      data: { providerStatus: PublicShareDeliveryStatus.SENDING }
    });
    
    while (attempt < maxAttempts) {
      attempt++;
      if (params.request.method === "EMAIL") {
        const content = renderProjectEmailContent(vars);
        sendResult = await provider.sendEmail({
          to: params.request.recipientDetail,
          subject: content.subject,
          body: content.body,
          html: content.html
        });
      } else if (params.request.method === "SMS") {
        const content = renderProjectSmsContent(vars);
        sendResult = await provider.sendSms({
          to: params.request.recipientDetail,
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

    // 6. Update Delivery record with final outcome
    await tx.projectShareDelivery.update({
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
