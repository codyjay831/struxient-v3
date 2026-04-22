import type {
  PrismaClient,
  QuoteLineItemExecutionMode,
  ScopePacketRevisionStatus,
} from "@prisma/client";
import { InvariantViolationError } from "../errors";
import { assertQuoteLineItemInvariants } from "../invariants/quote-line-item";
import { assertQuoteVersionDraft } from "../invariants/quote-version";
import { normalizePaymentGateTitleOverride } from "../compose-preview/derive-payment-gate-intent-for-freeze";
import { bumpComposePreviewStalenessToken } from "./compose-staleness";

const MAX_TITLE = 500;
const MAX_DESCRIPTION = 4000;

export type QuoteLineItemApiDto = {
  id: string;
  quoteVersionId: string;
  proposalGroupId: string;
  sortOrder: number;
  executionMode: QuoteLineItemExecutionMode;
  title: string;
  description: string | null;
  quantity: number;
  tierCode: string | null;
  scopePacketRevisionId: string | null;
  quoteLocalPacketId: string | null;
  unitPriceCents: number | null;
  lineTotalCents: number | null;
  paymentBeforeWork: boolean;
  paymentGateTitleOverride: string | null;
};

function assertNonNegativeIntCents(field: "unitPriceCents" | "lineTotalCents", value: number | null): void {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 0) {
    throw new InvariantViolationError(
      "INVALID_LINE_MONEY",
      `${field} must be a non-negative integer (cents).`,
      { [field]: value },
    );
  }
}

function assertLineTitle(title: string): string {
  const t = title.trim();
  if (!t) {
    throw new InvariantViolationError("INVALID_LINE_TITLE", "Line title must be non-empty after trim.");
  }
  if (t.length > MAX_TITLE) {
    throw new InvariantViolationError(
      "INVALID_LINE_TITLE",
      `Line title must be at most ${MAX_TITLE} characters.`,
    );
  }
  return t;
}

function normalizeDescription(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const d = value.trim();
  return d.length === 0 ? null : d;
}

function assertDescription(desc: string | null): void {
  if (desc && desc.length > MAX_DESCRIPTION) {
    throw new InvariantViolationError(
      "INVALID_LINE_DESCRIPTION",
      `Description must be at most ${MAX_DESCRIPTION} characters.`,
    );
  }
}

function assertQuantity(q: number): void {
  if (!Number.isInteger(q) || q < 1) {
    throw new InvariantViolationError("INVALID_LINE_QUANTITY", "quantity must be an integer ≥ 1.");
  }
}

function assertSortOrder(n: number): void {
  if (!Number.isInteger(n)) {
    throw new InvariantViolationError("INVALID_LINE_SORT_ORDER", "sortOrder must be an integer.");
  }
}

async function loadQuoteVersionDraftForTenant(
  client: PrismaClient,
  tenantId: string,
  quoteVersionId: string,
) {
  const qv = await client.quoteVersion.findFirst({
    where: { id: quoteVersionId, quote: { tenantId } },
    select: { id: true, status: true, quote: { select: { tenantId: true } } },
  });
  if (!qv) return null;
  assertQuoteVersionDraft({ status: qv.status, quoteVersionId: qv.id });
  return qv;
}

async function loadScopeAndLocalForInvariant(
  client: PrismaClient,
  scopePacketRevisionId: string | null,
  quoteLocalPacketId: string | null,
) {
  // `status` is required by `assertScopePacketRevisionIsPublishedForPin` so the
  // line-item invariant can enforce the canon picker contract (PUBLISHED-only).
  // Same query, one extra column.
  let scopePacketRevision: {
    id: string;
    status: ScopePacketRevisionStatus;
    scopePacket: { tenantId: string; id: string };
  } | null = null;

  if (scopePacketRevisionId) {
    const row = await client.scopePacketRevision.findFirst({
      where: { id: scopePacketRevisionId },
      select: {
        id: true,
        status: true,
        scopePacket: { select: { tenantId: true, id: true } },
      },
    });
    if (!row) {
      throw new InvariantViolationError(
        "SCOPE_PACKET_REVISION_NOT_FOUND",
        "scopePacketRevisionId does not reference an existing revision.",
        { scopePacketRevisionId },
      );
    }
    scopePacketRevision = row;
  }

  let quoteLocalPacket: { id: string; tenantId: string; quoteVersionId: string } | null = null;
  if (quoteLocalPacketId) {
    const row = await client.quoteLocalPacket.findFirst({
      where: { id: quoteLocalPacketId },
      select: { id: true, tenantId: true, quoteVersionId: true },
    });
    if (!row) {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_NOT_FOUND",
        "quoteLocalPacketId does not reference an existing quote-local packet.",
        { quoteLocalPacketId },
      );
    }
    quoteLocalPacket = row;
  }

  return { scopePacketRevision, quoteLocalPacket };
}

/**
 * Draft-only create. Enforces manifest XOR, tenant-safe pins, proposal group on version (epic 09, slice-1 `04`).
 */
export async function createQuoteLineItemForTenant(
  client: PrismaClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    proposalGroupId: string;
    sortOrder: number;
    executionMode: QuoteLineItemExecutionMode;
    title: string;
    description?: string | null;
    quantity: number;
    tierCode?: string | null;
    scopePacketRevisionId?: string | null;
    quoteLocalPacketId?: string | null;
    unitPriceCents?: number | null;
    lineTotalCents?: number | null;
    paymentBeforeWork?: boolean;
    paymentGateTitleOverride?: string | null;
  },
): Promise<QuoteLineItemApiDto | "not_found"> {
  const qv = await loadQuoteVersionDraftForTenant(client, params.tenantId, params.quoteVersionId);
  if (!qv) return "not_found";

  const pg = await client.proposalGroup.findFirst({
    where: { id: params.proposalGroupId, quoteVersionId: params.quoteVersionId },
    select: { id: true, quoteVersionId: true },
  });
  if (!pg) return "not_found";

  assertSortOrder(params.sortOrder);
  assertQuantity(params.quantity);
  const title = assertLineTitle(params.title);
  const description = normalizeDescription(params.description);
  assertDescription(description);
  assertNonNegativeIntCents("unitPriceCents", params.unitPriceCents ?? null);
  assertNonNegativeIntCents("lineTotalCents", params.lineTotalCents ?? null);

  const paymentBeforeWork = params.paymentBeforeWork === true;
  const rawOverride = normalizePaymentGateTitleOverride(params.paymentGateTitleOverride ?? null);
  const paymentGateTitleOverride = paymentBeforeWork ? rawOverride : null;

  const scopeId = params.scopePacketRevisionId ?? null;
  const localId = params.quoteLocalPacketId ?? null;

  const { scopePacketRevision, quoteLocalPacket } = await loadScopeAndLocalForInvariant(client, scopeId, localId);

  assertQuoteLineItemInvariants({
    quoteVersionId: params.quoteVersionId,
    proposalGroupId: pg.id,
    proposalGroupQuoteVersionId: pg.quoteVersionId,
    quoteTenantId: qv.quote.tenantId,
    executionMode: params.executionMode,
    scopePacketRevisionId: scopeId,
    quoteLocalPacketId: localId,
    scopePacketRevision,
    quoteLocalPacket,
  });

  const row = await client.quoteLineItem.create({
    data: {
      quoteVersionId: params.quoteVersionId,
      proposalGroupId: params.proposalGroupId,
      sortOrder: params.sortOrder,
      executionMode: params.executionMode,
      title,
      description,
      quantity: params.quantity,
      tierCode: params.tierCode ?? null,
      scopePacketRevisionId: scopeId,
      quoteLocalPacketId: localId,
      unitPriceCents: params.unitPriceCents ?? null,
      lineTotalCents: params.lineTotalCents ?? null,
      paymentBeforeWork,
      paymentGateTitleOverride,
    },
    select: {
      id: true,
      quoteVersionId: true,
      proposalGroupId: true,
      sortOrder: true,
      executionMode: true,
      title: true,
      description: true,
      quantity: true,
      tierCode: true,
      scopePacketRevisionId: true,
      quoteLocalPacketId: true,
      unitPriceCents: true,
      lineTotalCents: true,
      paymentBeforeWork: true,
      paymentGateTitleOverride: true,
    },
  });

  await bumpComposePreviewStalenessToken(client, params.quoteVersionId);

  return row;
}

export type QuoteLineItemPatch = {
  title?: string;
  description?: string | null;
  quantity?: number;
  sortOrder?: number;
  tierCode?: string | null;
  executionMode?: QuoteLineItemExecutionMode;
  scopePacketRevisionId?: string | null;
  quoteLocalPacketId?: string | null;
  unitPriceCents?: number | null;
  lineTotalCents?: number | null;
  proposalGroupId?: string;
  paymentBeforeWork?: boolean;
  paymentGateTitleOverride?: string | null;
};

/**
 * Draft-only partial update; re-validates full line invariants on merged state.
 */
export async function updateQuoteLineItemForTenant(
  client: PrismaClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    lineItemId: string;
    patch: QuoteLineItemPatch;
  },
): Promise<QuoteLineItemApiDto | "not_found"> {
  const qv = await loadQuoteVersionDraftForTenant(client, params.tenantId, params.quoteVersionId);
  if (!qv) return "not_found";

  const existing = await client.quoteLineItem.findFirst({
    where: {
      id: params.lineItemId,
      quoteVersionId: params.quoteVersionId,
      quoteVersion: { quote: { tenantId: params.tenantId } },
    },
    select: {
      id: true,
      proposalGroupId: true,
      sortOrder: true,
      executionMode: true,
      title: true,
      description: true,
      quantity: true,
      tierCode: true,
      scopePacketRevisionId: true,
      quoteLocalPacketId: true,
      unitPriceCents: true,
      lineTotalCents: true,
      paymentBeforeWork: true,
      paymentGateTitleOverride: true,
    },
  });
  if (!existing) return "not_found";

  const merged = {
    proposalGroupId: params.patch.proposalGroupId ?? existing.proposalGroupId,
    sortOrder: params.patch.sortOrder ?? existing.sortOrder,
    executionMode: params.patch.executionMode ?? existing.executionMode,
    title: params.patch.title !== undefined ? params.patch.title : existing.title,
    description:
      params.patch.description !== undefined ? normalizeDescription(params.patch.description) : existing.description,
    quantity: params.patch.quantity ?? existing.quantity,
    tierCode: params.patch.tierCode !== undefined ? params.patch.tierCode : existing.tierCode,
    scopePacketRevisionId:
      params.patch.scopePacketRevisionId !== undefined
        ? params.patch.scopePacketRevisionId
        : existing.scopePacketRevisionId,
    quoteLocalPacketId:
      params.patch.quoteLocalPacketId !== undefined ? params.patch.quoteLocalPacketId : existing.quoteLocalPacketId,
    unitPriceCents:
      params.patch.unitPriceCents !== undefined ? params.patch.unitPriceCents : existing.unitPriceCents,
    lineTotalCents: params.patch.lineTotalCents !== undefined ? params.patch.lineTotalCents : existing.lineTotalCents,
    paymentBeforeWork:
      params.patch.paymentBeforeWork !== undefined ? params.patch.paymentBeforeWork : existing.paymentBeforeWork,
    paymentGateTitleOverride:
      params.patch.paymentGateTitleOverride !== undefined
        ? normalizePaymentGateTitleOverride(params.patch.paymentGateTitleOverride)
        : existing.paymentGateTitleOverride,
  };

  const paymentGateTitleOverrideEffective = merged.paymentBeforeWork ? merged.paymentGateTitleOverride : null;

  assertSortOrder(merged.sortOrder);
  assertQuantity(merged.quantity);
  const title = assertLineTitle(merged.title);
  assertDescription(merged.description);
  assertNonNegativeIntCents("unitPriceCents", merged.unitPriceCents);
  assertNonNegativeIntCents("lineTotalCents", merged.lineTotalCents);

  const pgRow = await client.proposalGroup.findFirst({
    where: { id: merged.proposalGroupId, quoteVersionId: params.quoteVersionId },
    select: { id: true, quoteVersionId: true },
  });
  if (!pgRow) return "not_found";

  const { scopePacketRevision, quoteLocalPacket } = await loadScopeAndLocalForInvariant(
    client,
    merged.scopePacketRevisionId,
    merged.quoteLocalPacketId,
  );

  assertQuoteLineItemInvariants({
    quoteLineItemId: existing.id,
    quoteVersionId: params.quoteVersionId,
    proposalGroupId: merged.proposalGroupId,
    proposalGroupQuoteVersionId: pgRow.quoteVersionId,
    quoteTenantId: qv.quote.tenantId,
    executionMode: merged.executionMode,
    scopePacketRevisionId: merged.scopePacketRevisionId,
    quoteLocalPacketId: merged.quoteLocalPacketId,
    scopePacketRevision,
    quoteLocalPacket,
  });

  const updated = await client.quoteLineItem.update({
    where: { id: existing.id },
    data: {
      proposalGroupId: merged.proposalGroupId,
      sortOrder: merged.sortOrder,
      executionMode: merged.executionMode,
      title,
      description: merged.description,
      quantity: merged.quantity,
      tierCode: merged.tierCode,
      scopePacketRevisionId: merged.scopePacketRevisionId,
      quoteLocalPacketId: merged.quoteLocalPacketId,
      unitPriceCents: merged.unitPriceCents,
      lineTotalCents: merged.lineTotalCents,
      paymentBeforeWork: merged.paymentBeforeWork,
      paymentGateTitleOverride: paymentGateTitleOverrideEffective,
    },
    select: {
      id: true,
      quoteVersionId: true,
      proposalGroupId: true,
      sortOrder: true,
      executionMode: true,
      title: true,
      description: true,
      quantity: true,
      tierCode: true,
      scopePacketRevisionId: true,
      quoteLocalPacketId: true,
      unitPriceCents: true,
      lineTotalCents: true,
      paymentBeforeWork: true,
      paymentGateTitleOverride: true,
    },
  });

  await bumpComposePreviewStalenessToken(client, params.quoteVersionId);

  return updated;
}

/** Draft-only hard delete (epic 09 §12). */
export async function deleteQuoteLineItemForTenant(
  client: PrismaClient,
  params: { tenantId: string; quoteVersionId: string; lineItemId: string },
): Promise<"deleted" | "not_found"> {
  const qv = await loadQuoteVersionDraftForTenant(client, params.tenantId, params.quoteVersionId);
  if (!qv) return "not_found";

  const row = await client.quoteLineItem.findFirst({
    where: {
      id: params.lineItemId,
      quoteVersionId: params.quoteVersionId,
      quoteVersion: { quote: { tenantId: params.tenantId } },
    },
    select: { id: true },
  });
  if (!row) return "not_found";

  await client.quoteLineItem.delete({ where: { id: row.id } });
  await bumpComposePreviewStalenessToken(client, params.quoteVersionId);
  return "deleted";
}
