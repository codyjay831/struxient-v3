import type { PrismaClient } from "@prisma/client";

/**
 * Records a valid project share viewer access.
 */
export async function recordProjectShareAccess(
  prisma: PrismaClient,
  params: { flowGroupId: string }
) {
  const now = new Date();

  // 1. Increment count and update last viewed
  const row = await prisma.flowGroup.update({
    where: { id: params.flowGroupId },
    data: {
      publicShareViewCount: { increment: 1 },
      publicShareLastViewedAt: now,
    },
    select: { publicShareFirstViewedAt: true }
  });

  // 2. Set first viewed ONLY if it was never set before
  if (!row.publicShareFirstViewedAt) {
    await prisma.flowGroup.update({
      where: { id: params.flowGroupId },
      data: { publicShareFirstViewedAt: now }
    });
  }
}
