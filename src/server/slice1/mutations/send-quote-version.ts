import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { ComposeValidationItem } from "../compose-preview/compose-engine";
import { runComposeFromReadModel } from "../compose-preview/compose-engine";
import { derivePaymentGateIntentForFreeze } from "../compose-preview/derive-payment-gate-intent-for-freeze";
import {
  buildExecutionPackageSnapshotV0,
  buildGeneratedPlanSnapshotV0,
  canonicalStringify,
  sha256HexUtf8,
} from "../compose-preview/freeze-snapshots";
import { getQuoteVersionScopeReadModel } from "../reads/quote-version-scope";
import { ensureDraftQuoteVersionPinnedToCanonicalInTransaction } from "./ensure-draft-quote-version-canonical-pin";

export type SendQuoteVersionRequestBody = {
  clientStalenessToken?: string | null;
  sendClientRequestId?: string | null;
};

export type SendQuoteVersionSuccessDto = {
  quoteVersionId: string;
  status: "SENT";
  sentAt: string;
  planSnapshotSha256: string;
  packageSnapshotSha256: string;
  idempotentReplay: boolean;
  /** Customer portal review URL uses `/portal/quotes/{portalQuoteShareToken}` (Epic 54). */
  portalQuoteShareToken: string | null;
};

export type SendQuoteVersionResult =
  | { ok: true; data: SendQuoteVersionSuccessDto }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "idempotency_conflict"; message: string }
  | { ok: false; kind: "stale_client_token"; serverToken: string | null; clientToken: string | null }
  | { ok: false; kind: "compose_blocked"; errors: ComposeValidationItem[] }
  | { ok: false; kind: "invalid_sent_by_user" };

/**
 * Atomic draft → sent with freeze blobs (`06-send-freeze-transaction-design.md`).
 */
export async function sendQuoteVersionForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    /** Server-derived actor (session user); must belong to tenant. */
    sentByUserId: string;
    request: SendQuoteVersionRequestBody;
  },
): Promise<SendQuoteVersionResult> {
  const clientTok = params.request.clientStalenessToken ?? null;
  const sendKey = params.request.sendClientRequestId?.trim() || null;
  const sentByUserId = params.sentByUserId.trim();

  let outcome: SendQuoteVersionResult = { ok: false, kind: "not_found" };

  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "QuoteVersion" WHERE id = ${params.quoteVersionId} FOR UPDATE`;

      const locked = await tx.quoteVersion.findFirst({
        where: { id: params.quoteVersionId, quote: { tenantId: params.tenantId } },
        select: {
          id: true,
          status: true,
          createdById: true,
          composePreviewStalenessToken: true,
          sendClientRequestId: true,
          pinnedWorkflowVersionId: true,
          sentAt: true,
          planSnapshotSha256: true,
          packageSnapshotSha256: true,
          portalQuoteShareToken: true,
        },
      });

      if (!locked) {
        outcome = { ok: false, kind: "not_found" };
        return;
      }

      if (locked.status === "SIGNED") {
        outcome = {
          ok: false,
          kind: "idempotency_conflict",
          message:
            "Quote version is already SIGNED; send is not applicable. Use GET …/freeze for frozen payloads.",
        };
        return;
      }

      if (locked.status === "SENT") {
        if (sendKey != null && locked.sendClientRequestId === sendKey) {
          outcome = {
            ok: true,
            data: {
              quoteVersionId: locked.id,
              status: "SENT",
              sentAt: locked.sentAt!.toISOString(),
              planSnapshotSha256: locked.planSnapshotSha256!,
              packageSnapshotSha256: locked.packageSnapshotSha256!,
              idempotentReplay: true,
              portalQuoteShareToken: locked.portalQuoteShareToken ?? null,
            },
          };
          return;
        }
        outcome = {
          ok: false,
          kind: "idempotency_conflict",
          message:
            "Quote version is already SENT. Retry with the same sendClientRequestId, or use a new quote version.",
        };
        return;
      }

      if (locked.status !== "DRAFT") {
        outcome = {
          ok: false,
          kind: "idempotency_conflict",
          message:
            locked.status === "VOID" || locked.status === "SUPERSEDED" || locked.status === "DECLINED"
              ? `This quote version is ${locked.status.toLowerCase()} and cannot be sent. Open a draft revision or review version history.`
              : `Quote version status ${locked.status} cannot be sent; only draft rows are sendable.`,
        };
        return;
      }

      const pinEnsure = await ensureDraftQuoteVersionPinnedToCanonicalInTransaction(tx, {
        tenantId: params.tenantId,
        quoteVersionId: params.quoteVersionId,
      });
      if (!pinEnsure.ok) {
        if (pinEnsure.kind === "not_found") {
          outcome = { ok: false, kind: "not_found" };
          return;
        }
        outcome = {
          ok: false,
          kind: "compose_blocked",
          errors: [
            {
              code: "CANONICAL_WORKFLOW_ENSURE_FAILED",
              message: pinEnsure.message,
            },
          ],
        };
        return;
      }

      const tokenAfterPin = await tx.quoteVersion.findFirst({
        where: { id: locked.id },
        select: { composePreviewStalenessToken: true },
      });
      const serverTok = tokenAfterPin?.composePreviewStalenessToken ?? null;
      if (clientTok !== serverTok) {
        outcome = {
          ok: false,
          kind: "stale_client_token",
          serverToken: serverTok,
          clientToken: clientTok,
        };
        return;
      }

      const model = await getQuoteVersionScopeReadModel(tx, {
        tenantId: params.tenantId,
        quoteVersionId: params.quoteVersionId,
      });
      if (!model) {
        outcome = { ok: false, kind: "not_found" };
        return;
      }

      const compose = await runComposeFromReadModel(tx, model);

      if (compose.errors.length > 0) {
        outcome = { ok: false, kind: "compose_blocked", errors: compose.errors };
        return;
      }

      if (compose.planRows.length === 0) {
        outcome = {
          ok: false,
          kind: "compose_blocked",
          errors: [
            {
              code: "PLAN_SNAPSHOT_EMPTY",
              message:
                "Compose produced zero plan rows; generatedPlanSnapshot.v0 requires a non-empty rows array (add MANIFEST scope lines or define SOLD_SCOPE expansion).",
            },
          ],
        };
        return;
      }

      if (compose.packageSlots.length === 0) {
        outcome = {
          ok: false,
          kind: "compose_blocked",
          errors: [
            {
              code: "PACKAGE_SNAPSHOT_EMPTY",
              message: "Compose produced zero package slots; executionPackageSnapshot.v0 requires non-empty slots.",
            },
          ],
        };
        return;
      }

      const pinnedId = model.pinnedWorkflowVersionId;
      if (!pinnedId) {
        outcome = {
          ok: false,
          kind: "compose_blocked",
          errors: [{ code: "WORKFLOW_NOT_PINNED", message: "Pinned workflow is required to send." }],
        };
        return;
      }

      const gateDerived = derivePaymentGateIntentForFreeze({
        orderedLineItems: model.orderedLineItems.map((l) => ({
          id: l.id,
          title: l.title,
          paymentBeforeWork: l.paymentBeforeWork,
          paymentGateTitleOverride: l.paymentGateTitleOverride,
        })),
        packageSlots: compose.packageSlots,
      });
      if (!gateDerived.ok) {
        outcome = { ok: false, kind: "compose_blocked", errors: gateDerived.errors };
        return;
      }

      const actor = await tx.user.findFirst({
        where: { id: sentByUserId, tenantId: params.tenantId },
        select: { id: true },
      });
      if (!actor) {
        outcome = { ok: false, kind: "invalid_sent_by_user" };
        return;
      }

      const generatedAtIso = new Date().toISOString();
      const planJson = buildGeneratedPlanSnapshotV0({
        quoteVersionId: model.id,
        pinnedWorkflowVersionId: pinnedId,
        generatedAtIso,
        planRows: compose.planRows,
      });
      const pkgJson = buildExecutionPackageSnapshotV0({
        quoteVersionId: model.id,
        pinnedWorkflowVersionId: pinnedId,
        composedAtIso: generatedAtIso,
        packageSlots: compose.packageSlots,
        diagnostics: { errors: [], warnings: compose.warnings },
        paymentGateIntent: gateDerived.intent,
      });

      const planHash = sha256HexUtf8(canonicalStringify(planJson));
      const pkgHash = sha256HexUtf8(canonicalStringify(pkgJson));

      const sentAt = new Date();
      const portalQuoteShareToken = locked.portalQuoteShareToken ?? randomUUID();

      await tx.quoteVersion.update({
        where: { id: locked.id },
        data: {
          status: "SENT",
          sentAt,
          sentById: actor.id,
          sendClientRequestId: sendKey ?? undefined,
          planSnapshotSha256: planHash,
          packageSnapshotSha256: pkgHash,
          generatedPlanSnapshot: planJson,
          executionPackageSnapshot: pkgJson,
          composePreviewStalenessToken: null,
          portalQuoteShareToken,
        },
      });

      /** Epic 37: sending the CO draft quote is the office “customer acceptance requested” moment (DRAFT → PENDING_CUSTOMER). */
      await tx.changeOrder.updateMany({
        where: { draftQuoteVersionId: locked.id, status: "DRAFT" },
        data: { status: "PENDING_CUSTOMER" },
      });

      const priorSupersedable = await tx.quoteVersion.findMany({
        where: {
          quoteId: model.quoteId,
          id: { not: locked.id },
          status: { in: ["SENT", "DECLINED"] },
          versionNumber: { lt: model.versionNumber },
        },
        select: { id: true },
      });
      if (priorSupersedable.length > 0) {
        await tx.quoteVersion.updateMany({
          where: { id: { in: priorSupersedable.map((r) => r.id) } },
          data: { status: "SUPERSEDED" },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: model.quote.tenantId,
            eventType: "QUOTE_VERSION_SUPERSEDED",
            actorId: actor.id,
            targetQuoteVersionId: locked.id,
            payloadJson: {
              supersededQuoteVersionIds: priorSupersedable.map((r) => r.id),
              newSentQuoteVersionId: locked.id,
            },
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          tenantId: model.quote.tenantId,
          eventType: "QUOTE_VERSION_SENT",
          actorId: actor.id,
          targetQuoteVersionId: locked.id,
          payloadJson: {
            planSnapshotSha256: planHash,
            packageSnapshotSha256: pkgHash,
            sendClientRequestId: sendKey,
            supersededQuoteVersionIds: priorSupersedable.map((r) => r.id),
          },
        },
      });

      outcome = {
        ok: true,
        data: {
          quoteVersionId: locked.id,
          status: "SENT",
          sentAt: sentAt.toISOString(),
          planSnapshotSha256: planHash,
          packageSnapshotSha256: pkgHash,
          idempotentReplay: false,
          portalQuoteShareToken,
        },
      };
    },
    { timeout: 30_000 },
  );

  return outcome;
}
