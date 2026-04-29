import {
  SCOPE_LINE_ITEM_MAX_DESCRIPTION,
  SCOPE_LINE_ITEM_MAX_TITLE,
} from "@/lib/quote-line-item-scope-form-validation";
import {
  assertSafeLineTotalCents,
  lineTotalCentsFromUnitAndQuantity,
  parseWorkspaceUnitPriceDollarsToCents,
} from "@/lib/workspace/quote-workspace-line-unit-price";

export type WorkspaceLineEditFieldsInput = {
  title: string;
  quantity: string;
  description: string;
  unitPriceDollars: string;
};

/** When quantity and unit price match these snapshots, `lineTotalCents` stays `baselineLineTotalCents` (no-op pricing). */
export type WorkspaceLineEditPricingSnapshot = {
  baselineLineTotalCents: number | null;
  baselineQuantity: number;
  initialUnitPriceDollarsSnapshot: string;
};

export type ValidatedWorkspaceLineEdit =
  | {
      ok: true;
      title: string;
      description: string | null;
      quantity: number;
      lineTotalCents: number | null;
    }
  | { ok: false; message: string };

/**
 * Narrow validation for quote workspace line edit (commercial fields only).
 * Mirrors server line title / description / quantity / non-negative cents rules.
 *
 * Optional `pricingSnapshot`: if quantity and trimmed unit price match the snapshot,
 * returns `baselineLineTotalCents` so indivisible totals round-trip without drift.
 */
export function validateWorkspaceLineEditFields(
  input: WorkspaceLineEditFieldsInput,
  pricingSnapshot?: WorkspaceLineEditPricingSnapshot | null,
): ValidatedWorkspaceLineEdit {
  const title = input.title.trim();
  if (!title) {
    return { ok: false, message: "Title is required." };
  }
  if (title.length > SCOPE_LINE_ITEM_MAX_TITLE) {
    return {
      ok: false,
      message: `Title must be at most ${SCOPE_LINE_ITEM_MAX_TITLE} characters.`,
    };
  }

  const descTrimmed = input.description.trim();
  if (descTrimmed.length > SCOPE_LINE_ITEM_MAX_DESCRIPTION) {
    return {
      ok: false,
      message: `Description must be at most ${SCOPE_LINE_ITEM_MAX_DESCRIPTION} characters.`,
    };
  }
  const description: string | null = descTrimmed.length > 0 ? descTrimmed : null;

  const quantity = Number.parseInt(input.quantity.trim(), 10);
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, message: "Quantity must be a whole number of at least 1." };
  }

  const unitTrim = input.unitPriceDollars.trim();
  const snapTrim = (pricingSnapshot?.initialUnitPriceDollarsSnapshot ?? "").trim();
  if (
    pricingSnapshot &&
    quantity === pricingSnapshot.baselineQuantity &&
    unitTrim === snapTrim
  ) {
    return {
      ok: true,
      title,
      description,
      quantity,
      lineTotalCents: pricingSnapshot.baselineLineTotalCents,
    };
  }

  const unitParsed = parseWorkspaceUnitPriceDollarsToCents(input.unitPriceDollars);
  if (!unitParsed.ok) {
    return { ok: false, message: unitParsed.error };
  }
  if (unitParsed.unitPriceCents == null) {
    return { ok: true, title, description, quantity, lineTotalCents: null };
  }

  const lineTotalCents = lineTotalCentsFromUnitAndQuantity(unitParsed.unitPriceCents, quantity);
  const unsafe = assertSafeLineTotalCents(lineTotalCents);
  if (unsafe) {
    return { ok: false, message: unsafe };
  }

  return { ok: true, title, description, quantity, lineTotalCents };
}
