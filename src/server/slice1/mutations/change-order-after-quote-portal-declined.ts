import type { Prisma } from "@prisma/client";

/**
 * When the change-order **draft** quote version is declined on the portal, void any
 * **PENDING_CUSTOMER** change order so office state matches customer outcome (Epic 37).
 */
export async function revertPendingCustomerChangeOrderOnQuoteVersionPortalDeclined(
  tx: Prisma.TransactionClient,
  draftQuoteVersionId: string,
): Promise<void> {
  await tx.changeOrder.updateMany({
    where: { draftQuoteVersionId, status: "PENDING_CUSTOMER" },
    data: { status: "VOID" },
  });
}
