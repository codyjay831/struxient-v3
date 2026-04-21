/**
 * Authored conditional-rules contract for `TaskDefinition`.
 *
 * This is the durable shape of `TaskDefinition.conditionalRulesJson`.
 * It is the *authored truth* layer; runtime enforcement reads the snapshot at
 * `RuntimeTask.conditionalRulesJson`, which is frozen at activation.
 *
 * The shape mirrors what the production runtime validator already accepts in
 * `src/server/slice1/mutations/runtime-task-execution.ts` (the engine is NOT
 * widened by this slice). Authored values are constrained to exactly the set
 * the engine can match against — anything outside that set is rejected at
 * authoring time so it cannot become a silent dead rule after activation.
 *
 * Canon constraints:
 * - Bounded discriminated union; not a freeform rule language.
 * - One trigger per rule (no AND/OR composition).
 * - `trigger.value` for `result` is one of: PASS | FAIL | INCOMPLETE
 *   (matches the only values the field UI's overall-result selector emits).
 * - `trigger.value` for `checklist` is one of: yes | no | na
 *   (matches the runtime validator's checklist match set).
 * - `require.kind` is one of: note | attachment | measurement | identifier
 *   (matches the runtime validator's existing branches).
 * - `trigger.label` (checklist) and `require.label` (measurement|identifier)
 *   must reference real authored items in the same TaskDefinition's
 *   `completionRequirements`. This is enforced when the parser is given a
 *   `knownLabelsByKind` cross-validation context.
 */

import type { CompletionRequirement } from "./task-definition-authored-requirements";

export type ConditionalRuleTriggerKind = "result" | "checklist";
export type ConditionalRuleRequireKind = "note" | "attachment" | "measurement" | "identifier";

export const RESULT_TRIGGER_VALUES = ["PASS", "FAIL", "INCOMPLETE"] as const;
export type ResultTriggerValue = (typeof RESULT_TRIGGER_VALUES)[number];

export const CHECKLIST_TRIGGER_VALUES = ["yes", "no", "na"] as const;
export type ChecklistTriggerValue = (typeof CHECKLIST_TRIGGER_VALUES)[number];

export const CONDITIONAL_RULE_TRIGGER_KINDS: readonly ConditionalRuleTriggerKind[] = [
  "result",
  "checklist",
] as const;

export const CONDITIONAL_RULE_REQUIRE_KINDS: readonly ConditionalRuleRequireKind[] = [
  "note",
  "attachment",
  "measurement",
  "identifier",
] as const;

export type ResultTrigger = { kind: "result"; value: ResultTriggerValue };
export type ChecklistTrigger = { kind: "checklist"; label: string; value: ChecklistTriggerValue };
export type ConditionalRuleTrigger = ResultTrigger | ChecklistTrigger;

export type NoteRequire = { kind: "note"; message?: string };
export type AttachmentRequire = { kind: "attachment"; message?: string };
export type MeasurementRequire = { kind: "measurement"; label: string; message?: string };
export type IdentifierRequire = { kind: "identifier"; label: string; message?: string };
export type ConditionalRuleRequire =
  | NoteRequire
  | AttachmentRequire
  | MeasurementRequire
  | IdentifierRequire;

export type ConditionalRule = {
  /** Stable per-tenant rule id (caller-assigned string). Not currently used by the
   *  runtime engine but reserved for diff/edit affordances and future referencing. */
  id: string;
  trigger: ConditionalRuleTrigger;
  require: ConditionalRuleRequire;
};

export const MAX_CONDITIONAL_RULES_COUNT = 25;
export const MAX_RULE_MESSAGE_LENGTH = 280;
export const MAX_RULE_ID_LENGTH = 64;
const RULE_ID_REGEX = /^[A-Za-z0-9._\-:]{1,64}$/;

export type ParseConditionalRulesError = {
  index: number;
  message: string;
};

export type ParseConditionalRulesResult =
  | { ok: true; value: ConditionalRule[] }
  | { ok: false; errors: ParseConditionalRulesError[] };

/**
 * Cross-validation context. When provided, the parser checks that
 * `trigger.label` (checklist) and `require.label` (measurement|identifier)
 * reference real authored requirements on the same TaskDefinition.
 *
 * Pass `null` to skip the cross-check (e.g., parsing legacy data for read-only
 * inspection); the mutation path always passes it.
 */
export type RequirementsContext = {
  knownChecklistLabels: ReadonlySet<string>;
  knownMeasurementLabels: ReadonlySet<string>;
  knownIdentifierLabels: ReadonlySet<string>;
};

export function buildRequirementsContext(
  requirements: readonly CompletionRequirement[],
): RequirementsContext {
  const checklist = new Set<string>();
  const measurement = new Set<string>();
  const identifier = new Set<string>();
  for (const r of requirements) {
    if (r.kind === "checklist") checklist.add(r.label);
    else if (r.kind === "measurement") measurement.add(r.label);
    else if (r.kind === "identifier") identifier.add(r.label);
  }
  return {
    knownChecklistLabels: checklist,
    knownMeasurementLabels: measurement,
    knownIdentifierLabels: identifier,
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

function normalizeMessage(value: unknown, errors: ParseConditionalRulesError[], index: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    errors.push({ index, message: "require.message must be a string when set." });
    return undefined;
  }
  const t = value.trim();
  if (!t) return undefined;
  if (t.length > MAX_RULE_MESSAGE_LENGTH) {
    errors.push({
      index,
      message: `require.message must be at most ${MAX_RULE_MESSAGE_LENGTH} characters.`,
    });
    return undefined;
  }
  return t;
}

function normalizeRuleId(raw: unknown, index: number, errors: ParseConditionalRulesError[]): string {
  // Accept a caller-supplied id when valid; otherwise auto-assign a deterministic
  // index-based id so existing engine code that ignores id is unaffected and so
  // round-trips don't surprise the editor with new strings.
  if (raw === undefined || raw === null || raw === "") {
    return `rule-${index + 1}`;
  }
  if (typeof raw !== "string" || !RULE_ID_REGEX.test(raw)) {
    errors.push({
      index,
      message: `id must be 1-${MAX_RULE_ID_LENGTH} chars: letters, digits, '.', '_', '-', ':'.`,
    });
    return `rule-${index + 1}`;
  }
  return raw;
}

/**
 * Parse + normalize a raw `conditionalRulesJson` value. Idempotent.
 * Pass `requirementsContext` to enforce that referenced labels exist in the
 * accompanying authored completion requirements.
 */
export function parseConditionalRules(
  raw: unknown,
  requirementsContext: RequirementsContext | null = null,
): ParseConditionalRulesResult {
  if (raw === null || raw === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ index: -1, message: "conditionalRules must be an array." }],
    };
  }
  if (raw.length > MAX_CONDITIONAL_RULES_COUNT) {
    return {
      ok: false,
      errors: [
        {
          index: -1,
          message: `conditionalRules must contain at most ${MAX_CONDITIONAL_RULES_COUNT} items.`,
        },
      ],
    };
  }

  const errors: ParseConditionalRulesError[] = [];
  const out: ConditionalRule[] = [];
  const seenIds = new Set<string>();
  // Dedup on the (trigger, require) signature so authoring can't quietly duplicate
  // an identical rule that would fire twice in the runtime validator.
  const seenSignatures = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const obj = asObject(raw[i]);
    if (!obj) {
      errors.push({ index: i, message: "Item must be an object." });
      continue;
    }
    const id = normalizeRuleId(obj.id, i, errors);
    if (seenIds.has(id)) {
      errors.push({ index: i, message: `Duplicate rule id "${id}".` });
      continue;
    }
    seenIds.add(id);

    const triggerObj = asObject(obj.trigger);
    if (!triggerObj) {
      errors.push({ index: i, message: "trigger is required and must be an object." });
      continue;
    }
    const triggerKindRaw = triggerObj.kind;
    if (
      typeof triggerKindRaw !== "string" ||
      !CONDITIONAL_RULE_TRIGGER_KINDS.includes(triggerKindRaw as ConditionalRuleTriggerKind)
    ) {
      errors.push({
        index: i,
        message: `trigger.kind must be one of: ${CONDITIONAL_RULE_TRIGGER_KINDS.join(", ")}.`,
      });
      continue;
    }
    const triggerKind = triggerKindRaw as ConditionalRuleTriggerKind;

    let trigger: ConditionalRuleTrigger;
    if (triggerKind === "result") {
      const v = triggerObj.value;
      if (typeof v !== "string" || !(RESULT_TRIGGER_VALUES as readonly string[]).includes(v)) {
        errors.push({
          index: i,
          message: `result trigger.value must be one of: ${RESULT_TRIGGER_VALUES.join(", ")}.`,
        });
        continue;
      }
      trigger = { kind: "result", value: v as ResultTriggerValue };
    } else {
      const label = trimmedString(triggerObj.label);
      if (!label) {
        errors.push({ index: i, message: "checklist trigger.label is required." });
        continue;
      }
      const v = triggerObj.value;
      if (typeof v !== "string" || !(CHECKLIST_TRIGGER_VALUES as readonly string[]).includes(v)) {
        errors.push({
          index: i,
          message: `checklist trigger.value must be one of: ${CHECKLIST_TRIGGER_VALUES.join(", ")}.`,
        });
        continue;
      }
      if (
        requirementsContext &&
        !requirementsContext.knownChecklistLabels.has(label)
      ) {
        errors.push({
          index: i,
          message: `checklist trigger.label "${label}" does not match any authored checklist requirement.`,
        });
        continue;
      }
      trigger = { kind: "checklist", label, value: v as ChecklistTriggerValue };
    }

    const requireObj = asObject(obj.require);
    if (!requireObj) {
      errors.push({ index: i, message: "require is required and must be an object." });
      continue;
    }
    const requireKindRaw = requireObj.kind;
    if (
      typeof requireKindRaw !== "string" ||
      !CONDITIONAL_RULE_REQUIRE_KINDS.includes(requireKindRaw as ConditionalRuleRequireKind)
    ) {
      errors.push({
        index: i,
        message: `require.kind must be one of: ${CONDITIONAL_RULE_REQUIRE_KINDS.join(", ")}.`,
      });
      continue;
    }
    const requireKind = requireKindRaw as ConditionalRuleRequireKind;
    const message = normalizeMessage(requireObj.message, errors, i);

    let require: ConditionalRuleRequire;
    if (requireKind === "note") {
      require = message ? { kind: "note", message } : { kind: "note" };
    } else if (requireKind === "attachment") {
      require = message ? { kind: "attachment", message } : { kind: "attachment" };
    } else {
      // measurement | identifier — both label-bearing
      const label = trimmedString(requireObj.label);
      if (!label) {
        errors.push({ index: i, message: `${requireKind} require.label is required.` });
        continue;
      }
      if (requirementsContext) {
        const known =
          requireKind === "measurement"
            ? requirementsContext.knownMeasurementLabels
            : requirementsContext.knownIdentifierLabels;
        if (!known.has(label)) {
          errors.push({
            index: i,
            message: `${requireKind} require.label "${label}" does not match any authored ${requireKind} requirement.`,
          });
          continue;
        }
      }
      if (requireKind === "measurement") {
        require = message
          ? { kind: "measurement", label, message }
          : { kind: "measurement", label };
      } else {
        require = message
          ? { kind: "identifier", label, message }
          : { kind: "identifier", label };
      }
    }

    const signature = signatureOf(trigger, require);
    if (seenSignatures.has(signature)) {
      errors.push({
        index: i,
        message: "A rule with the same trigger and require already exists.",
      });
      continue;
    }
    seenSignatures.add(signature);

    out.push({ id, trigger, require });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: out };
}

function signatureOf(trigger: ConditionalRuleTrigger, require: ConditionalRuleRequire): string {
  const tPart =
    trigger.kind === "result"
      ? `t:result:${trigger.value}`
      : `t:checklist:${trigger.label}:${trigger.value}`;
  const rPart =
    require.kind === "note" || require.kind === "attachment"
      ? `r:${require.kind}`
      : `r:${require.kind}:${require.label}`;
  return `${tPart}|${rPart}`;
}
