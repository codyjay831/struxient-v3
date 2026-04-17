import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

/**
 * Bump preview staleness after draft graph mutations (`05-compose-preview-contract.md`).
 */
export async function bumpComposePreviewStalenessToken(
  client: PrismaClient,
  quoteVersionId: string,
): Promise<void> {
  await client.quoteVersion.updateMany({
    where: { id: quoteVersionId, status: "DRAFT" },
    data: { composePreviewStalenessToken: randomBytes(12).toString("hex") },
  });
}
