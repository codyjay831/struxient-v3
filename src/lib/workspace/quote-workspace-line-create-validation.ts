import {
  SCOPE_LINE_ITEM_MAX_DESCRIPTION,
  SCOPE_LINE_ITEM_MAX_TITLE,
} from "@/lib/quote-line-item-scope-form-validation";

export type WorkspaceLineCreateFieldsInput = {
  title: string;
  quantity: string;
  description: string;
  lineTotalDollars: string;
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
  lineTotal?: string;
};

export type ValidateWorkspaceLineCreateResult =
  | { ok: true; value: ValidatedWorkspaceLineCreate }
  | { ok: false; errors: WorkspaceLineCreateFieldErrors };

/**
 * Client validation for adding a simple estimate-only line from the quote workspace.
 * Quantity must be ≥ 1 to match `assertQuantity` in `createQuoteLineItemForTenant`.
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
  if (!quantityRaw) {
    errors.quantity = "Quantity is required.";
  } else if (!/^\d+$/.test(quantityRaw)) {
    // `Number.parseInt("1.5", 10)` is 1 — reject fractional / scientific input explicitly.
    errors.quantity = "Quantity must be a whole number.";
  } else {
    const quantity = Number.parseInt(quantityRaw, 10);
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
      errors.quantity = "Quantity must be a whole number.";
    } else if (quantity < 1) {
      errors.quantity = "Quantity must be at least 1.";
    }
  }

  const amt = input.lineTotalDollars.trim();
  let lineTotalCents: number | null = null;
  if (amt.length > 0) {
    const dollars = Number.parseFloat(amt);
    if (!Number.isFinite(dollars) || dollars < 0) {
      errors.lineTotal = "Line total must be a non-negative number.";
    } else {
      const cents = Math.round(dollars * 100);
      if (!Number.isInteger(cents) || cents < 0) {
        errors.lineTotal = "Line total must be a non-negative amount.";
      } else {
        lineTotalCents = cents;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const description: string | null = descTrimmed.length > 0 ? descTrimmed : null;
  const quantity = Number.parseInt(quantityRaw, 10);

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
