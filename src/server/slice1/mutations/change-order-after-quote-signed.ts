import type { Prisma } from "@prisma/client";

/**
 * When the change-order **draft** quote version becomes SIGNED (portal or office-recorded),
 * advance **PENDING_CUSTOMER** → **READY_TO_APPLY** so apply gates align with customer acceptance (Epic 37).
 */
export async function advancePendingCustomerChangeOrderOnQuoteVersionSigned(
  tx: Prisma.TransactionClient,
  draftQuoteVersionId: string,
): Promise<void> {
  await tx.changeOrder.updateMany({
    where: { draftQuoteVersionId, status: "PENDING_CUSTOMER" },
    data: { status: "READY_TO_APPLY" },
  });
}
