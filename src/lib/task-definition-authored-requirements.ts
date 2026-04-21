/**
 * Authored completion-requirements contract for `TaskDefinition`.
 *
 * This is the durable shape of `TaskDefinition.completionRequirementsJson`.
 * It is the *authored truth* the field UI/validator pre-shapes itself against.
 * It is *not* runtime/execution truth — runtime validation reads the snapshot
 * stored on `RuntimeTask.completionRequirementsJson` (frozen at activation).
 *
 * Canon constraints:
 * - Bounded discriminated union — not a generic widget framework.
 * - One `result` requirement at most (overall PASS/FAIL gate).
 * - One `note` requirement at most.
 * - One `attachment` requirement at most.
 * - `checklist`, `measurement`, `identifier` items must have unique non-empty labels
 *   within their kind (the runtime validator looks up by `(kind, label)`).
 */

export type CompletionRequirementKind =
  | "checklist"
  | "measurement"
  | "identifier"
  | "result"
  | "note"
  | "attachment";

export const COMPLETION_REQUIREMENT_KINDS: readonly CompletionRequirementKind[] = [
  "checklist",
  "measurement",
  "identifier",
  "result",
  "note",
  "attachment",
] as const;

export type ChecklistRequirement = {
  kind: "checklist";
  label: string;
  required: boolean;
};

export type MeasurementRequirement = {
  kind: "measurement";
  label: string;
  /** Optional unit hint surfaced to the field tech (e.g. "psi", "in"). */
  unit?: string;
  required: boolean;
};

export type IdentifierRequirement = {
  kind: "identifier";
  label: string;
  required: boolean;
};

export type ResultRequirement = {
  kind: "result";
  required: boolean;
};

export type NoteRequirement = {
  kind: "note";
  required: boolean;
};

export type AttachmentRequirement = {
  kind: "attachment";
  required: boolean;
};

export type CompletionRequirement =
  | ChecklistRequirement
  | MeasurementRequirement
  | IdentifierRequirement
  | ResultRequirement
  | NoteRequirement
  | AttachmentRequirement;

export const MAX_REQUIREMENT_LABEL_LENGTH = 200;
export const MAX_REQUIREMENT_UNIT_LENGTH = 32;
export const MAX_REQUIREMENTS_COUNT = 50;

export type ParseRequirementsError = {
  index: number;
  message: string;
};

export type ParseRequirementsResult =
  | { ok: true; value: CompletionRequirement[] }
  | { ok: false; errors: ParseRequirementsError[] };

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

/**
 * Parse + normalize a raw `completionRequirementsJson` value (from JSON column or API body).
 * Returns a structured error list or the normalized array. Idempotent: parse(parse(x)) === parse(x).
 */
export function parseCompletionRequirements(raw: unknown): ParseRequirementsResult {
  if (raw === null || raw === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, errors: [{ index: -1, message: "completionRequirements must be an array." }] };
  }
  if (raw.length > MAX_REQUIREMENTS_COUNT) {
    return {
      ok: false,
      errors: [
        {
          index: -1,
          message: `completionRequirements must contain at most ${MAX_REQUIREMENTS_COUNT} items.`,
        },
      ],
    };
  }

  const errors: ParseRequirementsError[] = [];
  const out: CompletionRequirement[] = [];
  const seenLabelByKind: Partial<Record<CompletionRequirementKind, Set<string>>> = {};
  const seenSingletonKinds = new Set<CompletionRequirementKind>();
  const SINGLETON_KINDS: ReadonlySet<CompletionRequirementKind> = new Set([
    "result",
    "note",
    "attachment",
  ]);

  for (let i = 0; i < raw.length; i++) {
    const obj = asObject(raw[i]);
    if (!obj) {
      errors.push({ index: i, message: "Item must be an object." });
      continue;
    }
    const kindRaw = obj.kind;
    if (typeof kindRaw !== "string" || !COMPLETION_REQUIREMENT_KINDS.includes(kindRaw as CompletionRequirementKind)) {
      errors.push({
        index: i,
        message: `kind must be one of: ${COMPLETION_REQUIREMENT_KINDS.join(", ")}.`,
      });
      continue;
    }
    const kind = kindRaw as CompletionRequirementKind;
    const required = obj.required === true;

    if (SINGLETON_KINDS.has(kind)) {
      if (seenSingletonKinds.has(kind)) {
        errors.push({ index: i, message: `Only one "${kind}" requirement is permitted.` });
        continue;
      }
      seenSingletonKinds.add(kind);

      if (kind === "result") {
        out.push({ kind: "result", required });
      } else if (kind === "note") {
        out.push({ kind: "note", required });
      } else if (kind === "attachment") {
        out.push({ kind: "attachment", required });
      }
      continue;
    }

    const label = trimmedString(obj.label);
    if (!label) {
      errors.push({ index: i, message: `${kind} item requires a non-empty "label".` });
      continue;
    }
    if (label.length > MAX_REQUIREMENT_LABEL_LENGTH) {
      errors.push({
        index: i,
        message: `${kind} label must be at most ${MAX_REQUIREMENT_LABEL_LENGTH} characters.`,
      });
      continue;
    }
    const labelSet = seenLabelByKind[kind] ?? new Set<string>();
    if (labelSet.has(label)) {
      errors.push({ index: i, message: `${kind} label "${label}" is duplicated.` });
      continue;
    }
    labelSet.add(label);
    seenLabelByKind[kind] = labelSet;

    if (kind === "checklist") {
      out.push({ kind: "checklist", label, required });
    } else if (kind === "identifier") {
      out.push({ kind: "identifier", label, required });
    } else if (kind === "measurement") {
      const unitRaw = obj.unit;
      let unit: string | undefined;
      if (unitRaw !== undefined && unitRaw !== null) {
        if (typeof unitRaw !== "string") {
          errors.push({ index: i, message: "measurement unit must be a string when set." });
          continue;
        }
        const u = unitRaw.trim();
        if (u.length === 0) {
          unit = undefined;
        } else if (u.length > MAX_REQUIREMENT_UNIT_LENGTH) {
          errors.push({
            index: i,
            message: `measurement unit must be at most ${MAX_REQUIREMENT_UNIT_LENGTH} characters.`,
          });
          continue;
        } else {
          unit = u;
        }
      }
      const item: MeasurementRequirement = unit
        ? { kind: "measurement", label, unit, required }
        : { kind: "measurement", label, required };
      out.push(item);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: out };
}

/**
 * Convenience: throws a thin Error if invalid. Prefer `parseCompletionRequirements` in API code
 * so we can map structured errors. Used in narrow internal callsites where input is trusted.
 */
export function normalizeCompletionRequirementsOrThrow(raw: unknown): CompletionRequirement[] {
  const r = parseCompletionRequirements(raw);
  if (!r.ok) {
    throw new Error(`Invalid completionRequirements: ${r.errors.map((e) => e.message).join("; ")}`);
  }
  return r.value;
}
