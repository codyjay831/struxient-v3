import type { PrismaClient } from "@prisma/client";
import {
  activateQuoteVersionInTransaction,
  AutoActivateAfterSignError,
  type ActivateQuoteVersionSuccessDto,
} from "./activate-quote-version";
import { advancePendingCustomerChangeOrderOnQuoteVersionSigned } from "./change-order-after-quote-signed";

const MAX_SIGNER_NAME = 120;
const MAX_SIGNER_EMAIL = 254;

export type SignQuoteVersionViaPortalRequestBody = {
  signerName: string;
  signerEmail: string;
  /** Must be true — explicit legal acceptance gate (Epic 54). */
  acceptTerms: boolean;
};

export type SignQuoteVersionViaPortalSuccessDto = {
  quoteVersionId: string;
  status: "SIGNED";
  signedAt: string;
  jobId: string;
  quoteSignatureId: string;
  idempotentReplay: boolean;
  activation?: ActivateQuoteVersionSuccessDto;
};

export type SignQuoteVersionViaPortalResult =
  | { ok: true; data: SignQuoteVersionViaPortalSuccessDto }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid_body"; message: string }
  | { ok: false; kind: "not_sent"; status: string }
  | { ok: false; kind: "signed_state_inconsistent" };

function assertSignerName(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.length > MAX_SIGNER_NAME) return null;
  return s;
}

function assertSignerEmail(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s || s.length > MAX_SIGNER_EMAIL) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

/**
 * Customer self-service: **SENT → SIGNED** using `QuoteVersion.portalQuoteShareToken` (no office session).
 * Persists `QuoteSignature` with `CUSTOMER_PORTAL_ACCEPTED` and a durable signer label snapshot.
 * When `Tenant.autoActivateOnSign` is true, activation is attributed to the quote **sender** (`sentById`).
 */
export async function signQuoteVersionViaPortalShareToken(
  prisma: PrismaClient,
  params: { shareToken: string; request: SignQuoteVersionViaPortalRequestBody },
): Promise<SignQuoteVersionViaPortalResult> {
  const token = params.shareToken.trim();
  if (!token) {
    return { ok: false, kind: "not_found" };
  }

  const name = assertSignerName(params.request.signerName);
  const email = assertSignerEmail(params.request.signerEmail);
  if (!params.request.acceptTerms) {
    return { ok: false, kind: "invalid_body", message: "You must accept the terms to sign." };
  }
  if (!name || !email) {
    return {
      ok: false,
      kind: "invalid_body",
      message: "Provide a valid signer name and email address.",
    };
  }

  const portalSignerLabel = `${name} <${email}>`;
  const portalAcceptPayloadJson = {
    acceptTerms: true,
    signerEmail: email,
    signerName: name,
  };

  let outcome: SignQuoteVersionViaPortalResult = { ok: false, kind: "not_found" };

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
          sentById: true,
          quote: { select: { tenantId: true, flowGroupId: true } },
        },
      });

      if (!locked) {
        outcome = { ok: false, kind: "not_found" };
        return;
      }

      if (locked.status === "SIGNED") {
        const sig = await tx.quoteSignature.findUnique({
          where: { quoteVersionId: locked.id },
          select: { id: true, signedAt: true },
        });
        const job = await tx.job.findUnique({
          where: { flowGroupId: locked.quote.flowGroupId },
          select: { id: true },
        });
        if (!sig || !job) {
          outcome = { ok: false, kind: "signed_state_inconsistent" };
          return;
        }
        await advancePendingCustomerChangeOrderOnQuoteVersionSigned(tx, locked.id);
        outcome = {
          ok: true,
          data: {
            quoteVersionId: locked.id,
            status: "SIGNED",
            signedAt: sig.signedAt.toISOString(),
            jobId: job.id,
            quoteSignatureId: sig.id,
            idempotentReplay: true,
          },
        };
        return;
      }

      if (locked.status !== "SENT") {
        outcome = { ok: false, kind: "not_sent", status: locked.status };
        return;
      }

      if (locked.sentById == null) {
        outcome = { ok: false, kind: "signed_state_inconsistent" };
        return;
      }

      const fg = await tx.flowGroup.findFirst({
        where: { id: locked.quote.flowGroupId, tenantId: locked.quote.tenantId },
        select: { id: true, tenantId: true },
      });
      if (!fg) {
        outcome = { ok: false, kind: "not_found" };
        return;
      }

      const tenantRow = await tx.tenant.findUnique({
        where: { id: locked.quote.tenantId },
        select: { autoActivateOnSign: true },
      });

      const job = await tx.job.upsert({
        where: { flowGroupId: fg.id },
        create: { tenantId: fg.tenantId, flowGroupId: fg.id },
        update: {},
        select: { id: true },
      });

      const sig = await tx.quoteSignature.create({
        data: {
          tenantId: locked.quote.tenantId,
          quoteVersionId: locked.id,
          method: "CUSTOMER_PORTAL_ACCEPTED",
          recordedById: null,
          portalSignerLabel,
          portalAcceptPayloadJson,
        },
        select: { id: true, signedAt: true },
      });

      const signedAt = new Date();

      await tx.quoteVersion.update({
        where: { id: locked.id },
        data: {
          status: "SIGNED",
          signedAt,
          signedById: null,
        },
      });

      await advancePendingCustomerChangeOrderOnQuoteVersionSigned(tx, locked.id);

      await tx.auditEvent.create({
        data: {
          tenantId: locked.quote.tenantId,
          eventType: "QUOTE_VERSION_SIGNED",
          actorId: null,
          targetQuoteVersionId: locked.id,
          payloadJson: {
            jobId: job.id,
            quoteSignatureId: sig.id,
            method: "CUSTOMER_PORTAL_ACCEPTED",
            portalSignerLabel,
          },
        },
      });

      let activation: ActivateQuoteVersionSuccessDto | undefined;
      if (tenantRow?.autoActivateOnSign) {
        const act = await activateQuoteVersionInTransaction(tx, {
          tenantId: locked.quote.tenantId,
          quoteVersionId: locked.id,
          activatedByUserId: locked.sentById,
        });
        if (!act.ok) {
          throw new AutoActivateAfterSignError(act);
        }
        activation = act.data;
      }

      outcome = {
        ok: true,
        data: {
          quoteVersionId: locked.id,
          status: "SIGNED",
          signedAt: signedAt.toISOString(),
          jobId: job.id,
          quoteSignatureId: sig.id,
          idempotentReplay: false,
          activation,
        },
      };
    },
    { timeout: 90_000 },
  );

  return outcome;
}
