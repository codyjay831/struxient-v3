/**
 * Index frozen generatedPlanSnapshot.v0 for activation integrity.
 * Activation must not materialize runtime rows from package slots that reference plan tasks outside the frozen plan.
 * @see docs/canon/03-quote-to-execution-canon.md — consume freeze truth, not live draft.
 */

export type FrozenPlanIndexResult =
  | { ok: true; planTaskIds: Set<string> }
  | { ok: false; code: string; message: string };

export function indexFrozenGeneratedPlanV0(
  json: unknown,
  expectedQuoteVersionId: string,
): FrozenPlanIndexResult {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return { ok: false, code: "INVALID_PLAN", message: "generatedPlanSnapshot must be an object." };
  }
  const o = json as Record<string, unknown>;
  if (o.schemaVersion !== "generatedPlanSnapshot.v0") {
    return {
      ok: false,
      code: "UNSUPPORTED_PLAN_VERSION",
      message: `Expected generatedPlanSnapshot.v0, got ${String(o.schemaVersion)}.`,
    };
  }
  const qv = o.quoteVersionId;
  if (typeof qv !== "string" || qv !== expectedQuoteVersionId) {
    return {
      ok: false,
      code: "PLAN_QUOTE_MISMATCH",
      message: "generatedPlanSnapshot.quoteVersionId does not match this quote version.",
    };
  }
  const rows = o.rows;
  if (!Array.isArray(rows)) {
    return { ok: false, code: "INVALID_PLAN", message: "generatedPlanSnapshot.rows must be an array." };
  }
  const planTaskIds = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r === null || typeof r !== "object" || Array.isArray(r)) {
      continue;
    }
    const pid = (r as Record<string, unknown>).planTaskId;
    if (typeof pid === "string" && pid !== "") {
      planTaskIds.add(pid);
    }
  }
  return { ok: true, planTaskIds };
}
