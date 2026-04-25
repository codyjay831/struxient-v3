/**
 * Catalog trade inference — **prototype-only helper for Slice F**.
 *
 * ⚠️ Prototype-only inference. Replace with explicit trade metadata before
 *    production use.
 *
 * Why this exists:
 * The current data model has no `trade` column on `ScopePacket` or
 * `LineItemPreset`. Slice F adds a UI-only trade-chip filter to
 * `QuickAddLineItemPicker` so contractors can browse the catalog by
 * "kind of work" (Roofing, Electrical, Solar, HVAC, Gutters, General)
 * before we commit to a real schema field.
 *
 * Inference order (deterministic, first match wins):
 *   1. Exact `presetKey` match against the seeded demo catalog.
 *   2. Exact `defaultScopePacket.packetKey` match (a preset's linked work
 *      template is more authoritative than the preset's own name when both
 *      have explicit demo mappings).
 *   3. Substring rule walk over `presetKey` + `displayName` + the linked
 *      packet's `packetKey` + `displayName`, in defined rule order.
 *   4. Fallback: `"General"`.
 *
 * Properties:
 *   - **Pure / total.** Never throws; never reads I/O; never mutates.
 *   - **Stable.** Same input → same output, no hidden randomness.
 *   - **Deterministic.** Substring rules are walked in defined order so
 *     more-specific keywords (e.g. `"chimney"`) win over more-generic ones
 *     (e.g. `"roof"`) when both could match.
 *   - **No persistence.** The result is never written anywhere. The picker
 *     uses it for local UI filtering only.
 *
 * Conservative posture:
 *   - Unknown / ambiguous entries fall through to `"General"` rather than
 *     misclassifying. This keeps unmatched items visible (just under
 *     `General`) instead of hidden.
 *   - Adding a new substring rule is safe; removing one may move existing
 *     entries between buckets, so prefer adding over removing while the
 *     real `trade` field is still being designed.
 */

export type CatalogTrade =
  | "Roofing"
  | "Electrical"
  | "Solar"
  | "HVAC"
  | "Gutters"
  | "General";

/**
 * Display order for trade chips. `"General"` is intentionally last so it
 * reads as the catch-all bucket after the specific trades.
 */
export const CATALOG_TRADES: ReadonlyArray<CatalogTrade> = [
  "Roofing",
  "Electrical",
  "Solar",
  "HVAC",
  "Gutters",
  "General",
];

/**
 * Exact `presetKey` → trade mapping for the seeded demo catalog (Slice E).
 * Encodes the demo team's intent so the prototype filter behaves
 * predictably during user validation.
 */
const PRESET_KEY_TO_TRADE: Readonly<Record<string, CatalogTrade>> = {
  "solar-8kw-standard": "Solar",
  "service-panel-200a": "Electrical",
  "ev-charger-l2-install": "Electrical",
  "reroof-30sq-architectural": "Roofing",
  "chimney-flashing-repair": "Roofing",
  "commercial-bur-roof-patch": "Roofing",
  "hvac-condenser-changeout-3t": "HVAC",
  "gutter-replacement-5in": "Gutters",
  "permit-residential-standard": "General",
  "annual-roof-inspection-y1": "Roofing",
  "permit-fee-passthrough": "General",
  "travel-mobilization-out-of-region": "General",
};

/**
 * Exact `packetKey` → trade mapping for the seeded demo catalog (Slice E).
 * Used both for raw saved-work-template rows and (with priority) for the
 * `defaultScopePacket` a preset references.
 */
const PACKET_KEY_TO_TRADE: Readonly<Record<string, CatalogTrade>> = {
  "pkt-solar-8kw": "Solar",
  "pkt-panel-200a": "Electrical",
  "pkt-ev-charger-install": "Electrical",
  "pkt-reroof-30sq": "Roofing",
  "pkt-chimney-flash": "Roofing",
  "pkt-roof-builtup-repair": "Roofing",
  "pkt-hvac-condenser-3t": "HVAC",
  "pkt-gutter-replacement": "Gutters",
  "pkt-permit-residential": "General",
  "pkt-roof-annual-inspection": "Roofing",
};

/**
 * Substring fallback rules for entries that aren't in the exact-key maps
 * above. Order matters — more-specific keywords come first so they win
 * over more-generic synonyms (e.g. `"chimney"` before `"roof"`,
 * `"ev charger"` before `"panel"`, `"reroof"` before `"roof"`).
 *
 * All keywords are lowercase; the haystack is lowercased before matching.
 */
type SubstringRule = { keyword: string; trade: CatalogTrade };
const SUBSTRING_RULES: ReadonlyArray<SubstringRule> = [
  // ── Solar ─────────────────────────────────────────────────────────────────
  { keyword: "solar", trade: "Solar" },
  { keyword: "photovoltaic", trade: "Solar" },
  // ── HVAC ──────────────────────────────────────────────────────────────────
  { keyword: "hvac", trade: "HVAC" },
  { keyword: "condenser", trade: "HVAC" },
  { keyword: "furnace", trade: "HVAC" },
  { keyword: "ductwork", trade: "HVAC" },
  { keyword: "heat pump", trade: "HVAC" },
  { keyword: "mini-split", trade: "HVAC" },
  { keyword: "ac unit", trade: "HVAC" },
  // ── Gutters ───────────────────────────────────────────────────────────────
  { keyword: "gutter", trade: "Gutters" },
  { keyword: "downspout", trade: "Gutters" },
  // ── Electrical (placed before "panel" so EV-specific keywords win) ───────
  { keyword: "ev charger", trade: "Electrical" },
  { keyword: "ev-charger", trade: "Electrical" },
  { keyword: "service panel", trade: "Electrical" },
  { keyword: "sub-panel", trade: "Electrical" },
  { keyword: "subpanel", trade: "Electrical" },
  { keyword: "wiring", trade: "Electrical" },
  { keyword: "electrical", trade: "Electrical" },
  { keyword: "panel", trade: "Electrical" },
  // ── Roofing (specific terms first; "reroof" before "roof") ───────────────
  { keyword: "reroof", trade: "Roofing" },
  { keyword: "shingle", trade: "Roofing" },
  { keyword: "chimney", trade: "Roofing" },
  { keyword: "flashing", trade: "Roofing" },
  { keyword: "underlayment", trade: "Roofing" },
  { keyword: "deck-prep", trade: "Roofing" },
  { keyword: "tear-off", trade: "Roofing" },
  { keyword: "tear off", trade: "Roofing" },
  { keyword: "roof", trade: "Roofing" },
  // ── General (admin / fees / passthrough / inspections) ───────────────────
  { keyword: "permit", trade: "General" },
  { keyword: "travel", trade: "General" },
  { keyword: "mobilization", trade: "General" },
  { keyword: "inspection", trade: "General" },
  { keyword: "passthrough", trade: "General" },
  { keyword: "pass-through", trade: "General" },
];

/** Structural input for inferring a saved-line preset's trade. */
export type PresetTradeInferenceInput = {
  presetKey: string | null;
  displayName: string;
  defaultScopePacket: {
    packetKey: string;
    displayName: string;
  } | null;
};

/** Structural input for inferring a saved-work-template (packet) trade. */
export type PacketTradeInferenceInput = {
  packetKey: string;
  displayName: string;
};

function matchSubstring(haystack: string): CatalogTrade | null {
  const h = haystack.toLowerCase();
  for (const rule of SUBSTRING_RULES) {
    if (h.includes(rule.keyword)) return rule.trade;
  }
  return null;
}

/**
 * Infer the trade for a saved-line preset.
 *
 * Order:
 *   1. Exact `presetKey` map.
 *   2. Exact `defaultScopePacket.packetKey` map (linked template wins over
 *      free-text fallbacks).
 *   3. Substring scan over preset + linked-packet text fields.
 *   4. `"General"` fallback.
 */
export function inferPresetTrade(input: PresetTradeInferenceInput): CatalogTrade {
  if (input.presetKey != null) {
    const hit = PRESET_KEY_TO_TRADE[input.presetKey];
    if (hit) return hit;
  }
  if (input.defaultScopePacket != null) {
    const hit = PACKET_KEY_TO_TRADE[input.defaultScopePacket.packetKey];
    if (hit) return hit;
  }
  const haystack = [
    input.presetKey ?? "",
    input.displayName,
    input.defaultScopePacket?.packetKey ?? "",
    input.defaultScopePacket?.displayName ?? "",
  ].join(" ");
  return matchSubstring(haystack) ?? "General";
}

/**
 * Infer the trade for a saved-work-template (raw `ScopePacket`).
 *
 * Order:
 *   1. Exact `packetKey` map.
 *   2. Substring scan over `packetKey` + `displayName`.
 *   3. `"General"` fallback.
 */
export function inferPacketTrade(input: PacketTradeInferenceInput): CatalogTrade {
  const exact = PACKET_KEY_TO_TRADE[input.packetKey];
  if (exact) return exact;
  return matchSubstring(`${input.packetKey} ${input.displayName}`) ?? "General";
}
