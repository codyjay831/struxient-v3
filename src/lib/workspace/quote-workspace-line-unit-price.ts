/**
 * Workspace line-item unit pricing helpers (dollars in UI → cents on wire).
 *
 * Per-unit dollars are rounded half-up to integer cents via `Math.round(dollars * 100)`.
 * Line total cents = `unitPriceCents * quantity` (canonical persisted field for workspace).
 */

/** Initial unit-price string for edit forms so unchanged pricing round-trips `lineTotalCents`. */
export function workspaceUnitPriceDollarsSnapshotFromLine(
  lineTotalCents: number | null,
  quantity: number,
): string {
  if (lineTotalCents == null || quantity < 1) return "";
  const dollars = lineTotalCents / quantity / 100;
  if (!Number.isFinite(dollars)) return "";
  const fixed = dollars.toFixed(10);
  // Drop trailing fractional zeros (e.g. 5.0000000000 → 5) while keeping non-trivial decimals.
  return fixed.replace(/\.?0+$/, "");
}

export type ParseUnitPriceDollarsResult =
  | { ok: true; unitPriceCents: number | null }
  | { ok: false; error: string };

/**
 * Optional unit price: blank → null cents.
 * Otherwise non-negative dollars, rounded half-up to per-unit cents.
 */
export function parseWorkspaceUnitPriceDollarsToCents(raw: string): ParseUnitPriceDollarsResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, unitPriceCents: null };
  const dollars = Number.parseFloat(trimmed);
  if (!Number.isFinite(dollars) || dollars < 0) {
    return { ok: false, error: "Unit price must be a non-negative number." };
  }
  const cents = Math.round(dollars * 100);
  if (!Number.isInteger(cents) || cents < 0) {
    return { ok: false, error: "Unit price must be a valid amount." };
  }
  return { ok: true, unitPriceCents: cents };
}

export function lineTotalCentsFromUnitAndQuantity(unitPriceCents: number, quantity: number): number {
  return unitPriceCents * quantity;
}

export function assertSafeLineTotalCents(lineTotalCents: number): string | null {
  if (!Number.isSafeInteger(lineTotalCents)) {
    return "Line total is too large for this quantity and unit price.";
  }
  return null;
}

export type WorkspaceComputedLineTotalKind = "no_amount" | "invalid" | "amount";

/**
 * Read-only line total helper for workspace UI (not authoritative validation).
 * Blank unit price → `no_amount`. Non-blank unit needs quantity integer ≥ 1 to show an amount.
 */
export function workspaceComputedLineTotalKind(
  unitPriceDollars: string,
  quantityStr: string,
): { kind: WorkspaceComputedLineTotalKind; cents?: number } {
  const unitParsed = parseWorkspaceUnitPriceDollarsToCents(unitPriceDollars);
  if (!unitParsed.ok) return { kind: "invalid" };
  if (unitParsed.unitPriceCents == null) return { kind: "no_amount" };

  const quantityRaw = quantityStr.trim();
  if (!quantityRaw || !/^\d+$/.test(quantityRaw)) return { kind: "invalid" };
  const quantity = Number.parseInt(quantityRaw, 10);
  if (!Number.isFinite(quantity) || quantity < 1) return { kind: "invalid" };

  const cents = lineTotalCentsFromUnitAndQuantity(unitParsed.unitPriceCents, quantity);
  if (assertSafeLineTotalCents(cents)) return { kind: "invalid" };
  return { kind: "amount", cents };
}
