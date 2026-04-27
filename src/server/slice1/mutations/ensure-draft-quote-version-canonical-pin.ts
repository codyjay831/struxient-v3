import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { ensureCanonicalWorkflowVersionInTransaction } from "./ensure-canonical-workflow-version";

export type EnsureDraftCanonicalPinResult =
  | {
      ok: true;
      quoteVersionId: string;
      /** Always the effective pin id after the call (null only if skipped non-draft). */
      pinnedWorkflowVersionId: string | null;
      /** True when this call wrote `pinnedWorkflowVersionId` from null. */
      repaired: boolean;
      /** True when the row was not DRAFT or not found — caller should not treat as error. */
      skipped: boolean;
    }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "ensure_canonical_failed"; message: string };

/**
 * Path B lazy repair: DRAFT quote versions with no workflow pin get the tenant's
 * published canonical execution-stages workflow pinned automatically.
 *
 * - Only mutates `QuoteVersion` rows in `DRAFT` status.
 * - Never assigns a non-canonical workflow (only `ensureCanonicalWorkflowVersionInTransaction`).
 * - Bumps `composePreviewStalenessToken` when a repair write occurs so clients
 *   cannot send with a pre-repair preview token.
 */
export async function ensureDraftQuoteVersionPinnedToCanonicalInTransaction(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; quoteVersionId: string },
): Promise<EnsureDraftCanonicalPinResult> {
  const row = await tx.quoteVersion.findFirst({
    where: { id: params.quoteVersionId, quote: { tenantId: params.tenantId } },
    select: { id: true, status: true, pinnedWorkflowVersionId: true },
  });

  if (!row) {
    return { ok: false, kind: "not_found" };
  }

  if (row.status !== "DRAFT") {
    return {
      ok: true,
      quoteVersionId: row.id,
      pinnedWorkflowVersionId: row.pinnedWorkflowVersionId,
      repaired: false,
      skipped: true,
    };
  }

  if (row.pinnedWorkflowVersionId != null && row.pinnedWorkflowVersionId !== "") {
    return {
      ok: true,
      quoteVersionId: row.id,
      pinnedWorkflowVersionId: row.pinnedWorkflowVersionId,
      repaired: false,
      skipped: false,
    };
  }

  try {
    const { workflowVersionId } = await ensureCanonicalWorkflowVersionInTransaction(tx, {
      tenantId: params.tenantId,
    });
    const newToken = randomBytes(12).toString("hex");
    await tx.quoteVersion.update({
      where: { id: row.id },
      data: {
        pinnedWorkflowVersionId: workflowVersionId,
        composePreviewStalenessToken: newToken,
      },
    });
    return {
      ok: true,
      quoteVersionId: row.id,
      pinnedWorkflowVersionId: workflowVersionId,
      repaired: true,
      skipped: false,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, kind: "ensure_canonical_failed", message };
  }
}

export async function ensureDraftQuoteVersionPinnedToCanonicalForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; quoteVersionId: string },
): Promise<EnsureDraftCanonicalPinResult> {
  return prisma.$transaction((tx) => ensureDraftQuoteVersionPinnedToCanonicalInTransaction(tx, params));
}
