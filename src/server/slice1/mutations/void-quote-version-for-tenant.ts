import type { PrismaClient } from "@prisma/client";

const MAX_VOID_REASON = 4000;

export type VoidQuoteVersionRequestBody = {
  voidReason: string;
};

export type VoidQuoteVersionResult =
  | { ok: true; data: { quoteVersionId: string; status: "VOID"; voidedAt: string } }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid_actor" }
  | { ok: false; kind: "invalid_body"; message: string }
  | { ok: false; kind: "already_void" }
  | { ok: false; kind: "not_voidable_signed" }
  | { ok: false; kind: "not_voidable_activated" }
  | { ok: false; kind: "not_voidable_superseded" }
  | { ok: false; kind: "draft_only_version" };

/**
 * Pre-activation withdrawal: **SENT** (no activation) or **DRAFT** when another non-void version exists.
 * **SIGNED** and **SUPERSEDED** are refused. Snapshots are retained (Epic 14).
 */
export async function voidQuoteVersionForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    voidedByUserId: string;
    request: VoidQuoteVersionRequestBody;
  },
): Promise<VoidQuoteVersionResult> {
  const actorId = params.voidedByUserId.trim();
  if (!actorId) {
    return { ok: false, kind: "invalid_actor" };
  }

  const reason = params.request.voidReason.trim();
  if (!reason) {
    return { ok: false, kind: "invalid_body", message: "voidReason is required." };
  }
  if (reason.length > MAX_VOID_REASON) {
    return {
      ok: false,
      kind: "invalid_body",
      message: `voidReason must be at most ${String(MAX_VOID_REASON)} characters.`,
    };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "QuoteVersion" WHERE id = ${params.quoteVersionId} FOR UPDATE`;

    const qv = await tx.quoteVersion.findFirst({
      where: { id: params.quoteVersionId, quote: { tenantId: params.tenantId } },
      select: {
        id: true,
        quoteId: true,
        status: true,
        activation: { select: { id: true } },
      },
    });

    if (!qv) {
      return { ok: false, kind: "not_found" };
    }

    if (qv.status === "VOID") {
      return { ok: false, kind: "already_void" };
    }

    if (qv.status === "SUPERSEDED") {
      return { ok: false, kind: "not_voidable_superseded" };
    }

    if (qv.status === "SIGNED") {
      return { ok: false, kind: "not_voidable_signed" };
    }

    if (qv.activation) {
      return { ok: false, kind: "not_voidable_activated" };
    }

    if (qv.status === "DRAFT") {
      const otherActive = await tx.quoteVersion.count({
        where: {
          quoteId: qv.quoteId,
          id: { not: qv.id },
          status: { not: "VOID" },
        },
      });
      if (otherActive === 0) {
        return { ok: false, kind: "draft_only_version" };
      }
    }

    if (qv.status !== "SENT" && qv.status !== "DRAFT" && qv.status !== "DECLINED") {
      return { ok: false, kind: "invalid_body", message: `Version status ${qv.status} cannot be voided.` };
    }

    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!actor) {
      return { ok: false, kind: "invalid_actor" };
    }

    const voidedAt = new Date();

    await tx.quoteVersion.update({
      where: { id: qv.id },
      data: {
        status: "VOID",
        voidedAt,
        voidedById: actor.id,
        voidReason: reason,
      },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "QUOTE_VERSION_VOIDED",
        actorId: actor.id,
        targetQuoteVersionId: qv.id,
        payloadJson: {
          priorStatus: qv.status,
          voidReasonLength: reason.length,
        },
      },
    });

    return {
      ok: true,
      data: {
        quoteVersionId: qv.id,
        status: "VOID",
        voidedAt: voidedAt.toISOString(),
      },
    };
  });
}
