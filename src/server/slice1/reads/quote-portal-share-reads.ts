import type { PrismaClient } from "@prisma/client";

export type QuotePortalShareDeliveryListItemDto = {
  id: string;
  deliveredAtIso: string;
  deliveryMethod: string;
  recipientDetail: string | null;
  /** Short preview of the token snapshot at send time (not the live portal URL). */
  shareTokenPreview: string;
  providerStatus: string;
  /** Office-only: last provider error when status is FAILED. */
  providerError: string | null;
  /** Cumulative inline attempts on initial send; retries add further attempts in `retryQuotePortalShareDeliveryForTenant`. */
  retryCount: number;
  isFollowUp: boolean;
};

/**
 * Tenant-scoped office read: recent portal link deliveries for a quote version.
 */
export async function listQuotePortalShareDeliveriesForTenant(
  client: PrismaClient,
  params: { tenantId: string; quoteVersionId: string; limit?: number },
): Promise<QuotePortalShareDeliveryListItemDto[]> {
  const limit = Math.min(Math.max(params.limit ?? 8, 1), 25);

  const rows = await client.quotePortalShareDelivery.findMany({
    where: { tenantId: params.tenantId, quoteVersionId: params.quoteVersionId },
    orderBy: { deliveredAt: "desc" },
    take: limit,
    select: {
      id: true,
      deliveredAt: true,
      deliveryMethod: true,
      recipientDetail: true,
      shareToken: true,
      providerStatus: true,
      providerError: true,
      retryCount: true,
      isFollowUp: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    deliveredAtIso: r.deliveredAt.toISOString(),
    deliveryMethod: r.deliveryMethod,
    recipientDetail: r.recipientDetail,
    shareTokenPreview:
      r.shareToken.length > 10 ? `${r.shareToken.slice(0, 4)}…${r.shareToken.slice(-4)}` : "…",
    providerStatus: r.providerStatus,
    providerError: r.providerError,
    retryCount: r.retryCount,
    isFollowUp: r.isFollowUp,
  }));
}
