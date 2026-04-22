import type { ComposePackageSlotDto, ComposeValidationItem } from "./compose-engine";
import type { FrozenPaymentGateIntentV0 } from "./execution-package-for-activation";

const MAX_GATE_TITLE_OVERRIDE = 120;
const MAX_LINE_TITLE_IN_DEFAULT = 80;

export type QuoteLineItemForPaymentGateIntent = {
  id: string;
  title: string;
  paymentBeforeWork: boolean;
  paymentGateTitleOverride: string | null;
};

export function normalizePaymentGateTitleOverride(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.length > MAX_GATE_TITLE_OVERRIDE) {
    return t.slice(0, MAX_GATE_TITLE_OVERRIDE);
  }
  return t;
}

function pickFrozenPaymentGateTitle(
  flaggedInOrder: Array<{ title: string; paymentGateTitleOverride: string | null }>,
): string {
  for (const line of flaggedInOrder) {
    const o = line.paymentGateTitleOverride?.trim();
    if (o) return o.length > MAX_GATE_TITLE_OVERRIDE ? o.slice(0, MAX_GATE_TITLE_OVERRIDE) : o;
  }
  if (flaggedInOrder.length === 1) {
    const t = flaggedInOrder[0]!.title.trim();
    const short = t.length > MAX_LINE_TITLE_IN_DEFAULT ? `${t.slice(0, MAX_LINE_TITLE_IN_DEFAULT)}…` : t;
    return `Payment before work — ${short}`;
  }
  return "Payment required before field work";
}

/**
 * Deterministic bridge from commercial line flags + compose slots → optional `paymentGateIntent.v0`.
 * Call only after compose succeeded with non-empty `packageSlots`.
 */
export function derivePaymentGateIntentForFreeze(params: {
  orderedLineItems: QuoteLineItemForPaymentGateIntent[];
  packageSlots: ComposePackageSlotDto[];
}): { ok: true; intent: FrozenPaymentGateIntentV0 | null } | { ok: false; errors: ComposeValidationItem[] } {
  const flaggedInOrder = params.orderedLineItems.filter((l) => l.paymentBeforeWork);
  if (flaggedInOrder.length === 0) {
    return { ok: true, intent: null };
  }

  const flaggedIds = new Set(flaggedInOrder.map((l) => l.id));
  const errors: ComposeValidationItem[] = [];

  for (const line of flaggedInOrder) {
    const slotsForLine = params.packageSlots.filter((s) => s.lineItemId === line.id);
    if (slotsForLine.length === 0) {
      errors.push({
        code: "PAYMENT_GATE_NO_PACKAGE_TASKS",
        message:
          "This line is marked “payment before work” but compose produced no execution package slots for it. Attach scope that expands to field tasks, or clear the flag.",
        lineItemId: line.id,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const idSet = new Set<string>();
  for (const s of params.packageSlots) {
    if (flaggedIds.has(s.lineItemId)) {
      idSet.add(s.packageTaskId);
    }
  }
  const targetPackageTaskIds = [...idSet].sort((a, b) => a.localeCompare(b));

  const title = pickFrozenPaymentGateTitle(flaggedInOrder);

  return {
    ok: true,
    intent: {
      schemaVersion: "paymentGateIntent.v0",
      title,
      targetPackageTaskIds,
    },
  };
}
