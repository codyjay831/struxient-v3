/**
 * Pure client validation for the office quote scope line-item form.
 * Mirrors `assertManifestScopePinXor` / commercial field rules so obvious
 * errors surface before POST/PATCH. Server remains authoritative.
 *
 * Line title: required (non-empty after trim), max length aligned with
 * `assertLineTitle` in quote-line-item-mutations.
 */

export type ManifestFieldWorkSetup =
  | "none"
  | "useSavedTaskPacket"
  | "createNewTasks"
  | "startFromSavedAndCustomize";

export type ScopeLineItemFormFieldsForValidation = {
  title: string;
  description: string;
  quantity: string;
  executionMode: "SOLD_SCOPE" | "MANIFEST";
  manifestFieldWorkSetup: ManifestFieldWorkSetup;
  scopePacketRevisionId: string;
  quoteLocalPacketId: string;
  unitPriceCents: string;
  paymentBeforeWork: boolean;
  paymentGateTitleOverride: string;
};

const MAX_GATE_TITLE_OVERRIDE = 120;

/** Kept in sync with `quote-line-item-mutations` MAX_DESCRIPTION. */
export const SCOPE_LINE_ITEM_MAX_DESCRIPTION = 4000;

/** Kept in sync with `quote-line-item-mutations` MAX_TITLE. */
export const SCOPE_LINE_ITEM_MAX_TITLE = 500;

export type ValidatedScopeLineItemFields =
  | {
      ok: true;
      title: string;
      description: string | null;
      quantity: number;
      unitPriceCents: number | null;
      paymentBeforeWork: boolean;
      paymentGateTitleOverride: string | null;
      scopePacketRevisionId: string | null;
      quoteLocalPacketId: string | null;
    }
  | { ok: false; message: string };

export function validateScopeLineItemFormFields(
  fields: ScopeLineItemFormFieldsForValidation,
): ValidatedScopeLineItemFields {
  const title = fields.title.trim();
  if (!title) {
    return { ok: false, message: "Line title is required." };
  }
  if (title.length > SCOPE_LINE_ITEM_MAX_TITLE) {
    return {
      ok: false,
      message: `Line title must be at most ${SCOPE_LINE_ITEM_MAX_TITLE} characters.`,
    };
  }
  const descTrimmed = fields.description.trim();
  if (descTrimmed.length > SCOPE_LINE_ITEM_MAX_DESCRIPTION) {
    return {
      ok: false,
      message: `Description must be at most ${SCOPE_LINE_ITEM_MAX_DESCRIPTION} characters.`,
    };
  }
  const description: string | null = descTrimmed.length > 0 ? descTrimmed : null;
  const quantity = Number.parseInt(fields.quantity, 10);
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, message: "Quantity must be a whole number of at least 1." };
  }

  let unitPriceCents: number | null = null;
  if (fields.unitPriceCents.trim()) {
    const parsed = Number.parseInt(fields.unitPriceCents.trim(), 10);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return { ok: false, message: "Per-unit amount must be a whole number of cents if provided." };
    }
    unitPriceCents = parsed;
  }

  const paymentBeforeWork = fields.paymentBeforeWork;
  const ov = fields.paymentGateTitleOverride.trim();
  if (ov.length > MAX_GATE_TITLE_OVERRIDE) {
    return {
      ok: false,
      message: `Gate title override must be at most ${MAX_GATE_TITLE_OVERRIDE} characters.`,
    };
  }
  const paymentGateTitleOverride = paymentBeforeWork ? (ov.length > 0 ? ov : null) : null;

  let scopePacketRevisionId: string | null = null;
  let quoteLocalPacketId: string | null = null;

  if (fields.executionMode === "MANIFEST") {
    const scopeId = fields.scopePacketRevisionId.trim();
    const localId = fields.quoteLocalPacketId.trim();
    const setup = fields.manifestFieldWorkSetup;

    if (setup === "none") {
      return {
        ok: false,
        message:
          "Choose how to set up crew work for this line — saved work, new internal tasks on this quote, or copy from saved work and customize.",
      };
    }

    if (scopeId.length > 0 && localId.length > 0) {
      return {
        ok: false,
        message:
          "This line can only attach one work source at a time — either saved work from your library or custom work on this quote, not both.",
      };
    }

    if (setup === "useSavedTaskPacket") {
      if (!scopeId) {
        return { ok: false, message: "Choose saved work from your library to attach to this line." };
      }
      if (localId) {
        return {
          ok: false,
          message:
            "Detach custom work on this quote before attaching saved work, or switch to a different work setup option.",
        };
      }
      scopePacketRevisionId = scopeId;
    } else if (setup === "createNewTasks" || setup === "startFromSavedAndCustomize") {
      if (!localId) {
        if (setup === "startFromSavedAndCustomize") {
          return {
            ok: false,
            message:
              "Pick saved work and use “Copy to this quote and attach”, or switch to another work setup option.",
          };
        }
        return {
          ok: false,
          message:
            "Choose custom work on this quote to attach, or create new custom work for this line first.",
        };
      }
      if (scopeId) {
        return {
          ok: false,
          message:
            "Detach saved work before using custom work on this quote for this line, or switch to a different work setup option.",
        };
      }
      quoteLocalPacketId = localId;
    }
  }

  return {
    ok: true,
    title,
    description,
    quantity,
    unitPriceCents,
    paymentBeforeWork,
    paymentGateTitleOverride,
    scopePacketRevisionId,
    quoteLocalPacketId,
  };
}
