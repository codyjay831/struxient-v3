import {
  SCOPE_LINE_ITEM_MAX_DESCRIPTION,
  SCOPE_LINE_ITEM_MAX_TITLE,
} from "@/lib/quote-line-item-scope-form-validation";
import {
  assertSafeLineTotalCents,
  lineTotalCentsFromUnitAndQuantity,
  parseWorkspaceUnitPriceDollarsToCents,
} from "@/lib/workspace/quote-workspace-line-unit-price";

export type WorkspaceLineCreateFieldsInput = {
  title: string;
  quantity: string;
  description: string;
  /** Per-unit price in dollars; blank → no line amount (`lineTotalCents: null`). */
  unitPriceDollars: string;
};

export type ValidatedWorkspaceLineCreate = {
  title: string;
  description: string | null;
  quantity: number;
  lineTotalCents: number | null;
};

export type WorkspaceLineCreateFieldErrors = {
  title?: string;
  quantity?: string;
  description?: string;
  unitPrice?: string;
};

export type ValidateWorkspaceLineCreateResult =
  | { ok: true; value: ValidatedWorkspaceLineCreate }
  | { ok: false; errors: WorkspaceLineCreateFieldErrors };

/**
 * Client validation for adding a simple estimate-only line from the quote workspace.
 * Quantity must be ≥ 1 to match `assertQuantity` in `createQuoteLineItemForTenant`.
 *
 * `lineTotalCents` = rounded unit price (cents) × quantity; blank unit price → null total.
 * Per-unit dollars → cents: half-up via `Math.round(dollars * 100)`.
 */
export function validateWorkspaceLineCreateFields(
  input: WorkspaceLineCreateFieldsInput,
): ValidateWorkspaceLineCreateResult {
  const errors: WorkspaceLineCreateFieldErrors = {};

  const title = input.title.trim();
  if (!title) {
    errors.title = "Title is required.";
  } else if (title.length > SCOPE_LINE_ITEM_MAX_TITLE) {
    errors.title = `Title must be at most ${SCOPE_LINE_ITEM_MAX_TITLE} characters.`;
  }

  const descTrimmed = input.description.trim();
  if (descTrimmed.length > SCOPE_LINE_ITEM_MAX_DESCRIPTION) {
    errors.description = `Description must be at most ${SCOPE_LINE_ITEM_MAX_DESCRIPTION} characters.`;
  }

  const quantityRaw = input.quantity.trim();
  let quantity = 0;
  if (!quantityRaw) {
    errors.quantity = "Quantity is required.";
  } else if (!/^\d+$/.test(quantityRaw)) {
    errors.quantity = "Quantity must be a whole number.";
  } else {
    quantity = Number.parseInt(quantityRaw, 10);
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
      errors.quantity = "Quantity must be a whole number.";
    } else if (quantity < 1) {
      errors.quantity = "Quantity must be at least 1.";
    }
  }

  const unitParsed = parseWorkspaceUnitPriceDollarsToCents(input.unitPriceDollars);
  if (!unitParsed.ok) {
    errors.unitPrice = unitParsed.error;
  } else if (unitParsed.unitPriceCents != null && !errors.quantity) {
    const product = lineTotalCentsFromUnitAndQuantity(unitParsed.unitPriceCents, quantity);
    const unsafe = assertSafeLineTotalCents(product);
    if (unsafe) {
      errors.unitPrice = unsafe;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  if (!unitParsed.ok) {
    return { ok: false, errors: { unitPrice: unitParsed.error } };
  }

  const description: string | null = descTrimmed.length > 0 ? descTrimmed : null;
  const lineTotalCents: number | null =
    unitParsed.unitPriceCents == null
      ? null
      : lineTotalCentsFromUnitAndQuantity(unitParsed.unitPriceCents, quantity);

  return {
    ok: true,
    value: {
      title,
      description,
      quantity,
      lineTotalCents,
    },
  };
}

/**
 * JSON body for `POST /api/quote-versions/:quoteVersionId/line-items` when
 * creating a simple `SOLD_SCOPE` line with no packet pins (see `parseCreateBody`
 * in `src/app/api/quote-versions/[quoteVersionId]/line-items/route.ts`).
 */
export function buildSoldScopeLineItemCreateRequestBody(params: {
  proposalGroupId: string;
  sortOrder: number;
  value: ValidatedWorkspaceLineCreate;
}): Record<string, unknown> {
  const { proposalGroupId, sortOrder, value } = params;
  return {
    proposalGroupId,
    sortOrder,
    executionMode: "SOLD_SCOPE",
    title: value.title,
    description: value.description,
    quantity: value.quantity,
    tierCode: null,
    scopePacketRevisionId: null,
    quoteLocalPacketId: null,
    unitPriceCents: null,
    lineTotalCents: value.lineTotalCents,
    paymentBeforeWork: false,
    paymentGateTitleOverride: null,
  };
}
