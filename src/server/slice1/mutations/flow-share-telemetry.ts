import type { PrismaClient } from "@prisma/client";

/**
 * Records a valid public share portal access.
 * Increments view count and updates first/last viewed timestamps.
 */
export async function recordFlowShareAccess(
  client: PrismaClient,
  params: { flowId: string }
) {
  const now = new Date();
  
  // 1. Increment count and update last viewed
  const row = await client.flow.update({
    where: { id: params.flowId },
    data: {
      publicShareViewCount: { increment: 1 },
      publicShareLastViewedAt: now,
    },
    select: { publicShareFirstViewedAt: true }
  });

  // 2. Set first viewed ONLY if it was never set before
  if (!row.publicShareFirstViewedAt) {
    await client.flow.update({
      where: { id: params.flowId },
      data: { publicShareFirstViewedAt: now }
    });
  }
}
