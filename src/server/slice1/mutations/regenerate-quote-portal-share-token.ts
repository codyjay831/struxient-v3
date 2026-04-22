import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export type RegenerateQuotePortalShareTokenResult =
  | { ok: true; data: { portalQuoteShareToken: string } }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_sent" }
  | { ok: false; kind: "no_portal_token" }
  | { ok: false; kind: "invalid_actor" };

/**
 * Rotates `QuoteVersion.portalQuoteShareToken` while the version is still **SENT** (before customer sign).
 * Invalidates previously shared links; office must re-share.
 */
export async function regenerateQuotePortalShareTokenForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; quoteVersionId: string; actorUserId: string },
): Promise<RegenerateQuotePortalShareTokenResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) return { ok: false, kind: "invalid_actor" };

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "QuoteVersion" WHERE id = ${params.quoteVersionId} FOR UPDATE`;

    const qv = await tx.quoteVersion.findFirst({
      where: { id: params.quoteVersionId, quote: { tenantId: params.tenantId } },
      select: { id: true, status: true, portalQuoteShareToken: true },
    });

    if (!qv) return { ok: false, kind: "not_found" };
    if (qv.status !== "SENT") return { ok: false, kind: "not_sent" };
    if (!qv.portalQuoteShareToken) return { ok: false, kind: "no_portal_token" };

    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!actor) return { ok: false, kind: "invalid_actor" };

    const portalQuoteShareToken = randomUUID();

    await tx.quoteVersion.update({
      where: { id: qv.id },
      data: { portalQuoteShareToken },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "QUOTE_PORTAL_LINK_REGENERATED",
        actorId: actor.id,
        targetQuoteVersionId: qv.id,
        payloadJson: {
          previousTokenLength: qv.portalQuoteShareToken.length,
        },
      },
    });

    return { ok: true, data: { portalQuoteShareToken } };
  });
}
