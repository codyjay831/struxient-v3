import {
  SCOPE_LINE_ITEM_MAX_DESCRIPTION,
  SCOPE_LINE_ITEM_MAX_TITLE,
} from "@/lib/quote-line-item-scope-form-validation";

export type WorkspaceLineEditFieldsInput = {
  title: string;
  quantity: string;
  description: string;
  lineTotalDollars: string;
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
 */
export function validateWorkspaceLineEditFields(
  input: WorkspaceLineEditFieldsInput,
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

  const amt = input.lineTotalDollars.trim();
  let lineTotalCents: number | null = null;
  if (amt.length > 0) {
    const dollars = Number.parseFloat(amt);
    if (!Number.isFinite(dollars) || dollars < 0) {
      return { ok: false, message: "Line total must be a non-negative number." };
    }
    lineTotalCents = Math.round(dollars * 100);
    if (!Number.isInteger(lineTotalCents) || lineTotalCents < 0) {
      return { ok: false, message: "Line total must be a non-negative amount." };
    }
  }

  return { ok: true, title, description, quantity, lineTotalCents };
}
