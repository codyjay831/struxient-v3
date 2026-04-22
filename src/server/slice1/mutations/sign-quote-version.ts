import type { PrismaClient } from "@prisma/client";
import {
  activateQuoteVersionInTransaction,
  AutoActivateAfterSignError,
  type ActivateQuoteVersionSuccessDto,
} from "./activate-quote-version";
import { advancePendingCustomerChangeOrderOnQuoteVersionSigned } from "./change-order-after-quote-signed";

export type SignQuoteVersionSuccessDto = {
  quoteVersionId: string;
  status: "SIGNED";
  signedAt: string;
  jobId: string;
  quoteSignatureId: string;
  idempotentReplay: boolean;
  /** Present when tenant `autoActivateOnSign` and activation ran in the same transaction. */
  activation?: ActivateQuoteVersionSuccessDto;
};

export type SignQuoteVersionResult =
  | { ok: true; data: SignQuoteVersionSuccessDto }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_sent"; status: string }
  | { ok: false; kind: "invalid_recorded_by" }
  | { ok: false; kind: "signed_state_inconsistent" };

/**
 * Customer acceptance (office-recorded MVP): SENT → SIGNED, idempotent Job per FlowGroup, QuoteSignature, audit.
 * Optional tenant `autoActivateOnSign`: runs `activateQuoteVersionInTransaction` in the same DB transaction.
 * @see docs/decisions/04-job-anchor-timing-decision.md
 */
export async function signQuoteVersionForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    /** Server-derived actor (session user); must belong to tenant. */
    recordedByUserId: string;
  },
): Promise<SignQuoteVersionResult> {
  const recordedByUserId = params.recordedByUserId.trim();

  let outcome: SignQuoteVersionResult = { ok: false, kind: "not_found" };

  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "QuoteVersion" WHERE id = ${params.quoteVersionId} FOR UPDATE`;

      const locked = await tx.quoteVersion.findFirst({
        where: { id: params.quoteVersionId, quote: { tenantId: params.tenantId } },
        select: {
          id: true,
          status: true,
          createdById: true,
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

      const actor = await tx.user.findFirst({
        where: { id: recordedByUserId, tenantId: params.tenantId },
        select: { id: true },
      });
      if (!actor) {
        outcome = { ok: false, kind: "invalid_recorded_by" };
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
          method: "OFFICE_RECORDED",
          recordedById: actor.id,
        },
        select: { id: true, signedAt: true },
      });

      const signedAt = new Date();

      await tx.quoteVersion.update({
        where: { id: locked.id },
        data: {
          status: "SIGNED",
          signedAt,
          signedById: actor.id,
        },
      });

      await advancePendingCustomerChangeOrderOnQuoteVersionSigned(tx, locked.id);

      await tx.auditEvent.create({
        data: {
          tenantId: locked.quote.tenantId,
          eventType: "QUOTE_VERSION_SIGNED",
          actorId: actor.id,
          targetQuoteVersionId: locked.id,
          payloadJson: { jobId: job.id, quoteSignatureId: sig.id },
        },
      });

      let activation: ActivateQuoteVersionSuccessDto | undefined;
      if (tenantRow?.autoActivateOnSign) {
        const act = await activateQuoteVersionInTransaction(tx, {
          tenantId: params.tenantId,
          quoteVersionId: locked.id,
          activatedByUserId: actor.id,
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
