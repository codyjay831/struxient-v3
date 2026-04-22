import type { Prisma, PrismaClient } from "@prisma/client";

export type QuotePortalPlanRowDto = {
  title: string;
  lineItemId: string;
  planTaskId: string;
};

export type QuotePortalPresentationReadModel = {
  quoteVersionId: string;
  status: "SENT" | "SIGNED";
  quoteNumber: string;
  customerName: string;
  versionNumber: number;
  sentAtIso: string;
  signedAtIso: string | null;
  signatureMethod: string | null;
  portalSignerLabel: string | null;
  planRows: QuotePortalPlanRowDto[];
  /** When this sent quote version is a change-order draft, surface frozen office-authored reason (Epic 37). */
  changeOrderSummary: { reason: string } | null;
};

function parseFrozenPlanRowsForPortal(generatedPlanSnapshot: Prisma.JsonValue): QuotePortalPlanRowDto[] {
  if (generatedPlanSnapshot === null || typeof generatedPlanSnapshot !== "object" || Array.isArray(generatedPlanSnapshot)) {
    return [];
  }
  const o = generatedPlanSnapshot as Record<string, unknown>;
  if (o.schemaVersion !== "generatedPlanSnapshot.v0") {
    return [];
  }
  const rowsRaw = o.rows;
  if (!Array.isArray(rowsRaw)) {
    return [];
  }
  const out: QuotePortalPlanRowDto[] = [];
  for (const r of rowsRaw) {
    if (r === null || typeof r !== "object" || Array.isArray(r)) continue;
    const row = r as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title : "";
    const lineItemId = typeof row.lineItemId === "string" ? row.lineItemId : "";
    const planTaskId = typeof row.planTaskId === "string" ? row.planTaskId : "";
    if (!title || !lineItemId || !planTaskId) continue;
    out.push({ title, lineItemId, planTaskId });
  }
  return out;
}

/**
 * Token-scoped read for customer portal: only `portalQuoteShareToken` + SENT/SIGNED + frozen plan JSON.
 * No draft rows; no tenant id in URL.
 */
export async function getQuotePortalPresentationByShareToken(
  client: PrismaClient,
  params: { shareToken: string },
): Promise<QuotePortalPresentationReadModel | null> {
  const token = params.shareToken.trim();
  if (!token) return null;

  const row = await client.quoteVersion.findFirst({
    where: {
      portalQuoteShareToken: token,
      /** VOID / SUPERSEDED excluded: portal must not treat withdrawn or replaced proposals as current (Epic 14). */
      status: { in: ["SENT", "SIGNED"] },
    },
    select: {
      id: true,
      status: true,
      versionNumber: true,
      sentAt: true,
      signedAt: true,
      generatedPlanSnapshot: true,
      quote: {
        select: {
          quoteNumber: true,
          customer: { select: { name: true } },
        },
      },
      quoteSignature: {
        select: { method: true, portalSignerLabel: true },
      },
    },
  });

  if (!row || row.sentAt == null || row.generatedPlanSnapshot == null) {
    return null;
  }

  const planRows = parseFrozenPlanRowsForPortal(row.generatedPlanSnapshot);

  const co = await client.changeOrder.findFirst({
    where: { draftQuoteVersionId: row.id },
    select: { reason: true },
  });

  return {
    quoteVersionId: row.id,
    status: row.status as "SENT" | "SIGNED",
    quoteNumber: row.quote.quoteNumber,
    customerName: row.quote.customer.name,
    versionNumber: row.versionNumber,
    sentAtIso: row.sentAt.toISOString(),
    signedAtIso: row.signedAt?.toISOString() ?? null,
    signatureMethod: row.quoteSignature?.method ?? null,
    portalSignerLabel: row.quoteSignature?.portalSignerLabel ?? null,
    planRows,
    changeOrderSummary: co ? { reason: co.reason } : null,
  };
}
