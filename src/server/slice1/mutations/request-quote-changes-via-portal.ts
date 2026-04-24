import type { PrismaClient } from "@prisma/client";

const MAX_CHANGE_REQUEST_MESSAGE = 4000;

export type RequestQuoteChangesViaPortalRequestBody = {
  message: string;
};

export type RequestQuoteChangesViaPortalSuccessDto = {
  quoteVersionId: string;
  status: "SENT";
  portalChangeRequestedAt: string;
  idempotentReplay: boolean;
};

export type RequestQuoteChangesViaPortalResult =
  | { ok: true; data: RequestQuoteChangesViaPortalSuccessDto }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid_body"; message: string }
  | { ok: false; kind: "not_sent"; status: string }
  | { ok: false; kind: "sent_state_inconsistent" };

function assertChangeRequestMessage(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.length > MAX_CHANGE_REQUEST_MESSAGE) return null;
  return s;
}

/**
 * Customer self-service: record a **change request** on a **SENT** quote version via
 * `QuoteVersion.portalQuoteShareToken`. Status remains **SENT** (Epic 13 + 54).
 * Overwrites any prior stored message on the same version (single field v1).
 */
export async function requestQuoteChangesViaPortalShareToken(
  prisma: PrismaClient,
  params: { shareToken: string; request: RequestQuoteChangesViaPortalRequestBody },
): Promise<RequestQuoteChangesViaPortalResult> {
  const token = params.shareToken.trim();
  if (!token) {
    return { ok: false, kind: "not_found" };
  }

  const message = assertChangeRequestMessage(params.request.message);
  if (!message) {
    return {
      ok: false,
      kind: "invalid_body",
      message: `Provide a non-empty message (at most ${String(MAX_CHANGE_REQUEST_MESSAGE)} characters).`,
    };
  }

  let outcome: RequestQuoteChangesViaPortalResult = { ok: false, kind: "not_found" };

  await prisma.$transaction(
    async (tx) => {
      const row = await tx.quoteVersion.findFirst({
        where: { portalQuoteShareToken: token },
        select: { id: true },
      });
      if (!row) {
        outcome = { ok: false, kind: "not_found" };
        return;
      }

      await tx.$queryRaw`SELECT id FROM "QuoteVersion" WHERE id = ${row.id} FOR UPDATE`;

      const locked = await tx.quoteVersion.findFirst({
        where: { id: row.id },
        select: {
          id: true,
          status: true,
          sentAt: true,
          generatedPlanSnapshot: true,
          portalChangeRequestedAt: true,
          portalChangeRequestMessage: true,
          quoteSignature: { select: { id: true } },
          quote: { select: { tenantId: true } },
        },
      });

      if (!locked) {
        outcome = { ok: false, kind: "not_found" };
        return;
      }

      if (locked.status !== "SENT") {
        outcome = { ok: false, kind: "not_sent", status: locked.status };
        return;
      }

      if (locked.sentAt == null || locked.generatedPlanSnapshot == null) {
        outcome = { ok: false, kind: "sent_state_inconsistent" };
        return;
      }

      if (locked.quoteSignature != null) {
        outcome = { ok: false, kind: "sent_state_inconsistent" };
        return;
      }

      const priorMessage = locked.portalChangeRequestMessage?.trim() ?? "";
      const priorAt = locked.portalChangeRequestedAt;
      const isReplay =
        priorAt != null && priorMessage.length > 0 && priorMessage === message;

      if (isReplay) {
        outcome = {
          ok: true,
          data: {
            quoteVersionId: locked.id,
            status: "SENT",
            portalChangeRequestedAt: priorAt.toISOString(),
            idempotentReplay: true,
          },
        };
        return;
      }

      const requestedAt = new Date();

      await tx.quoteVersion.update({
        where: { id: locked.id },
        data: {
          portalChangeRequestedAt: requestedAt,
          portalChangeRequestMessage: message,
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId: locked.quote.tenantId,
          eventType: "QUOTE_VERSION_CHANGE_REQUESTED_PORTAL",
          actorId: null,
          targetQuoteVersionId: locked.id,
          payloadJson: {
            messageLength: message.length,
            isUpdate: priorAt != null && priorMessage.length > 0,
          },
        },
      });

      outcome = {
        ok: true,
        data: {
          quoteVersionId: locked.id,
          status: "SENT",
          portalChangeRequestedAt: requestedAt.toISOString(),
          idempotentReplay: false,
        },
      };
    },
    { timeout: 90_000 },
  );

  return outcome;
}
