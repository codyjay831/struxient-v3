import type { PrismaClient } from "@prisma/client";
import { revertPendingCustomerChangeOrderOnQuoteVersionPortalDeclined } from "./change-order-after-quote-portal-declined";

const MAX_DECLINE_REASON = 4000;

export type DeclineQuoteVersionViaPortalRequestBody = {
  declineReason: string;
};

export type DeclineQuoteVersionViaPortalSuccessDto = {
  quoteVersionId: string;
  status: "DECLINED";
  portalDeclinedAt: string;
  idempotentReplay: boolean;
};

export type DeclineQuoteVersionViaPortalResult =
  | { ok: true; data: DeclineQuoteVersionViaPortalSuccessDto }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid_body"; message: string }
  | { ok: false; kind: "not_sent"; status: string }
  | { ok: false; kind: "declined_state_inconsistent" };

function assertDeclineReason(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.length > MAX_DECLINE_REASON) return null;
  return s;
}

/**
 * Customer self-service: **SENT → DECLINED** using `QuoteVersion.portalQuoteShareToken` (no office session).
 * Persists decline reason + timestamp, writes `QUOTE_VERSION_DECLINED_PORTAL` audit, and voids any
 * **PENDING_CUSTOMER** change order anchored on this draft version (Epic 37 alignment).
 */
export async function declineQuoteVersionViaPortalShareToken(
  prisma: PrismaClient,
  params: { shareToken: string; request: DeclineQuoteVersionViaPortalRequestBody },
): Promise<DeclineQuoteVersionViaPortalResult> {
  const token = params.shareToken.trim();
  if (!token) {
    return { ok: false, kind: "not_found" };
  }

  const reason = assertDeclineReason(params.request.declineReason);
  if (!reason) {
    return {
      ok: false,
      kind: "invalid_body",
      message: `Provide a non-empty decline reason (at most ${String(MAX_DECLINE_REASON)} characters).`,
    };
  }

  let outcome: DeclineQuoteVersionViaPortalResult = { ok: false, kind: "not_found" };

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
          portalDeclinedAt: true,
          portalDeclineReason: true,
          quoteSignature: { select: { id: true } },
          quote: { select: { tenantId: true } },
        },
      });

      if (!locked) {
        outcome = { ok: false, kind: "not_found" };
        return;
      }

      if (locked.status === "DECLINED") {
        if (
          locked.portalDeclinedAt == null ||
          locked.portalDeclineReason == null ||
          locked.quoteSignature != null
        ) {
          outcome = { ok: false, kind: "declined_state_inconsistent" };
          return;
        }
        outcome = {
          ok: true,
          data: {
            quoteVersionId: locked.id,
            status: "DECLINED",
            portalDeclinedAt: locked.portalDeclinedAt.toISOString(),
            idempotentReplay: true,
          },
        };
        return;
      }

      if (locked.status !== "SENT") {
        outcome = { ok: false, kind: "not_sent", status: locked.status };
        return;
      }

      if (locked.sentAt == null || locked.generatedPlanSnapshot == null) {
        outcome = { ok: false, kind: "declined_state_inconsistent" };
        return;
      }

      if (locked.quoteSignature != null) {
        outcome = { ok: false, kind: "declined_state_inconsistent" };
        return;
      }

      const declinedAt = new Date();

      await tx.quoteVersion.update({
        where: { id: locked.id },
        data: {
          status: "DECLINED",
          portalDeclinedAt: declinedAt,
          portalDeclineReason: reason,
        },
      });

      await revertPendingCustomerChangeOrderOnQuoteVersionPortalDeclined(tx, locked.id);

      await tx.auditEvent.create({
        data: {
          tenantId: locked.quote.tenantId,
          eventType: "QUOTE_VERSION_DECLINED_PORTAL",
          actorId: null,
          targetQuoteVersionId: locked.id,
          payloadJson: {
            declineReasonLength: reason.length,
          },
        },
      });

      outcome = {
        ok: true,
        data: {
          quoteVersionId: locked.id,
          status: "DECLINED",
          portalDeclinedAt: declinedAt.toISOString(),
          idempotentReplay: false,
        },
      };
    },
    { timeout: 90_000 },
  );

  return outcome;
}
