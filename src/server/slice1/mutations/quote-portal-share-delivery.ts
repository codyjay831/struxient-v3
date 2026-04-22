import {
  PublicShareDeliveryMethod,
  PublicShareDeliveryStatus,
  type PrismaClient,
} from "@prisma/client";
import type { CommsSendResult } from "../../comms/comms-provider";
import { getCommsProvider } from "../../comms/get-comms-provider";
import { renderQuotePortalEmailContent, renderQuotePortalSmsContent } from "../../comms/delivery-content";

export type SendQuotePortalShareRequestBody = {
  method: PublicShareDeliveryMethod;
  recipientDetail: string;
  baseUrl: string;
  isFollowUp?: boolean;
};

export type SendQuotePortalShareResult =
  | { ok: true; data: { deliveryId: string } }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_sent" }
  | { ok: false; kind: "no_portal_token" }
  | { ok: false; kind: "invalid_actor" };

/**
 * Office-initiated delivery of the **quote customer portal** link (email/SMS/manual audit),
 * parallel to `sendFlowShareForTenant` but anchored on `QuoteVersion` + `portalQuoteShareToken`.
 */
export async function sendQuotePortalShareForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    actorUserId: string;
    request: SendQuotePortalShareRequestBody;
  },
): Promise<SendQuotePortalShareResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) {
    return { ok: false, kind: "invalid_actor" };
  }

  return prisma.$transaction(async (tx) => {
    const qv = await tx.quoteVersion.findFirst({
      where: { id: params.quoteVersionId, quote: { tenantId: params.tenantId } },
      select: {
        id: true,
        status: true,
        versionNumber: true,
        portalQuoteShareToken: true,
        quote: {
          select: {
            quoteNumber: true,
            customer: { select: { name: true } },
            tenant: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!qv) {
      return { ok: false, kind: "not_found" };
    }

    if (qv.status !== "SENT") {
      return { ok: false, kind: "not_sent" };
    }

    if (!qv.portalQuoteShareToken) {
      return { ok: false, kind: "no_portal_token" };
    }

    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!actor) {
      return { ok: false, kind: "invalid_actor" };
    }

    const isFollowUp = params.request.isFollowUp ?? false;
    const recentDuplicate = await tx.quotePortalShareDelivery.findFirst({
      where: {
        quoteVersionId: qv.id,
        deliveryMethod: params.request.method,
        recipientDetail: params.request.recipientDetail,
        isFollowUp,
        deliveredAt: { gte: new Date(Date.now() - 60 * 1000) },
        providerStatus: {
          in: [
            PublicShareDeliveryStatus.QUEUED,
            PublicShareDeliveryStatus.SENDING,
            PublicShareDeliveryStatus.SENT,
          ],
        },
      },
      select: { id: true },
    });

    if (recentDuplicate) {
      return { ok: true, data: { deliveryId: recentDuplicate.id } };
    }

    const delivery = await tx.quotePortalShareDelivery.create({
      data: {
        tenantId: params.tenantId,
        quoteVersionId: qv.id,
        deliveredById: actor.id,
        deliveryMethod: params.request.method,
        recipientDetail: params.request.recipientDetail,
        shareToken: qv.portalQuoteShareToken,
        providerStatus: PublicShareDeliveryStatus.QUEUED,
        isFollowUp,
      },
      select: { id: true },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "QUOTE_PORTAL_SHARE_DELIVERED",
        actorId: actor.id,
        targetQuoteVersionId: qv.id,
        payloadJson: {
          deliveryId: delivery.id,
          method: params.request.method,
          recipient: params.request.recipientDetail,
        },
      },
    });

    const base = params.request.baseUrl.replace(/\/$/, "");
    const portalUrl = `${base}/portal/quotes/${encodeURIComponent(qv.portalQuoteShareToken)}`;
    const provider = getCommsProvider();

    const vars = {
      customerName: qv.quote.customer.name,
      quoteNumber: qv.quote.quoteNumber,
      versionNumber: qv.versionNumber,
      portalUrl,
      companyName: qv.quote.tenant.name,
    };

    const maxAttempts = 3;
    let attempt = 0;
    let sendResult: CommsSendResult = { ok: false, error: "Initial state" };

    await tx.quotePortalShareDelivery.update({
      where: { id: delivery.id },
      data: { providerStatus: PublicShareDeliveryStatus.SENDING },
    });

    while (attempt < maxAttempts) {
      attempt++;
      if (params.request.method === PublicShareDeliveryMethod.EMAIL) {
        const content = renderQuotePortalEmailContent(vars, isFollowUp);
        sendResult = await provider.sendEmail({
          to: params.request.recipientDetail,
          subject: content.subject,
          body: content.body,
          html: content.html,
        });
      } else if (params.request.method === PublicShareDeliveryMethod.SMS) {
        const content = renderQuotePortalSmsContent(vars, isFollowUp);
        sendResult = await provider.sendSms({
          to: params.request.recipientDetail,
          message: content.body,
        });
      } else {
        sendResult = { ok: true, externalId: "manual" };
      }

      if (sendResult.ok) break;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 500));
      }
    }

    await tx.quotePortalShareDelivery.update({
      where: { id: delivery.id },
      data: {
        providerStatus: sendResult.ok ? PublicShareDeliveryStatus.SENT : PublicShareDeliveryStatus.FAILED,
        providerExternalId: sendResult.ok ? sendResult.externalId : undefined,
        providerError: sendResult.ok ? undefined : sendResult.error,
        providerResponse:
          sendResult.ok && sendResult.response != null ? (sendResult.response as object) : undefined,
        retryCount: attempt - 1,
      },
    });

    return { ok: true, data: { deliveryId: delivery.id } };
  });
}
