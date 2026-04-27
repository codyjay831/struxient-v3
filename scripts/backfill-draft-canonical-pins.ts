/**
 * One-time / dev backfill: set `pinnedWorkflowVersionId` on DRAFT `QuoteVersion`
 * rows where it is null, using each row's tenant canonical workflow (same
 * logic as `ensureDraftQuoteVersionPinnedToCanonicalForTenant`).
 *
 * Usage (from repo root, with DATABASE_URL set):
 *   npx tsx scripts/backfill-draft-canonical-pins.ts
 *
 * Does not modify SENT/SIGNED/frozen versions. Safe to re-run (idempotent).
 */
import { PrismaClient } from "@prisma/client";
import { ensureCanonicalWorkflowVersionForTenant } from "../src/server/slice1/mutations/ensure-canonical-workflow-version";
import { randomBytes } from "node:crypto";

async function main() {
  const prisma = new PrismaClient();
  try {
    const drafts = await prisma.quoteVersion.findMany({
      where: { status: "DRAFT", pinnedWorkflowVersionId: null },
      select: {
        id: true,
        quote: { select: { tenantId: true } },
      },
    });
    let updated = 0;
    for (const row of drafts) {
      const tenantId = row.quote.tenantId;
      const { workflowVersionId } = await ensureCanonicalWorkflowVersionForTenant(prisma, {
        tenantId,
      });
      const token = randomBytes(12).toString("hex");
      await prisma.quoteVersion.update({
        where: { id: row.id },
        data: {
          pinnedWorkflowVersionId: workflowVersionId,
          composePreviewStalenessToken: token,
        },
      });
      updated += 1;
    }
    console.log(`Backfill complete: updated ${String(updated)} draft quote version(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
