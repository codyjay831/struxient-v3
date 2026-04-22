/**
 * Runtime-task "required-state" helpers for the field-tech execution UI.
 *
 * The field UI must visually mark Note / Attachment as required when EITHER
 *  (a) the activation-frozen `RuntimeTask.completionRequirementsJson` carries
 *      an authored baseline singleton requirement of that kind with
 *      `required: true`, OR
 *  (b) a conditional rule is currently triggered that requires that kind.
 *
 * These helpers operate on the snapshot JSON exactly as it is rendered to the
 * client (`unknown`-typed) so they tolerate legacy / malformed data without
 * throwing. They never mutate. They are deliberately bounded to the kinds the
 * shared completion validator enforces — see
 * `src/server/slice1/mutations/completion-proof-contract-validation.ts`.
 */

export type SingletonRequirementKind = "note" | "attachment" | "result";

/**
 * Does the activation-frozen authored requirements snapshot contain a
 * baseline singleton requirement of `kind` with `required: true`?
 *
 * Returns `false` for null/undefined/non-array snapshots and for items that
 * don't match the expected shape — the runtime validator is the source of
 * truth, the UI hint is just a best-effort visual cue.
 */
export function isBaselineRequired(
  requirementsJson: unknown,
  kind: SingletonRequirementKind,
): boolean {
  if (!Array.isArray(requirementsJson)) return false;
  for (const raw of requirementsJson) {
    if (raw === null || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    if (obj.kind !== kind) continue;
    if (obj.required === true) return true;
  }
  return false;
}
