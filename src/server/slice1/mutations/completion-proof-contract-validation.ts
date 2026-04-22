/**
 * Single canonical validation for completion proof vs frozen authored requirements + conditional rules.
 * Used by both RUNTIME and SKELETON complete mutations — keep logic identical to avoid drift.
 */

export type CompletionProofValidationInput = {
  note?: string | null;
  attachments?: { key: string; fileName: string; fileSize: number; contentType: string }[];
  checklist?: { label: string; status: "yes" | "no" | "na" }[];
  measurements?: { label: string; value: string; unit?: string }[];
  identifiers?: { label: string; value: string }[];
  overallResult?: string | null;
} | null | undefined;

export type CompletionProofValidationError = { message: string; field?: string };

function asRequirementArray(json: unknown): any[] {
  return Array.isArray(json) ? json : [];
}

/**
 * Returns a non-empty list when completion must be rejected (same semantics as legacy runtime path).
 */
export function validateCompletionProofAgainstContract(
  completionRequirementsJson: unknown,
  conditionalRulesJson: unknown,
  proof: CompletionProofValidationInput,
): CompletionProofValidationError[] {
  const requirements = asRequirementArray(completionRequirementsJson);
  const rules = asRequirementArray(conditionalRulesJson);
  const validationErrors: CompletionProofValidationError[] = [];

  for (const req of requirements) {
    if (req.required) {
      if (req.kind === "checklist") {
        const item = (proof?.checklist || []).find((c) => c.label === req.label);
        if (!item || (item.status !== "yes" && item.status !== "no" && item.status !== "na")) {
          validationErrors.push({
            message: `Required checklist item "${req.label}" is missing or unanswered.`,
            field: `checklist:${req.label}`,
          });
        }
      } else if (req.kind === "measurement") {
        const item = (proof?.measurements || []).find((m) => m.label === req.label);
        if (!item || !item.value.trim()) {
          validationErrors.push({
            message: `Required measurement "${req.label}" is missing.`,
            field: `measurement:${req.label}`,
          });
        }
      } else if (req.kind === "identifier") {
        const item = (proof?.identifiers || []).find((i) => i.label === req.label);
        if (!item || !item.value.trim()) {
          validationErrors.push({
            message: `Required identifier "${req.label}" is missing.`,
            field: `identifier:${req.label}`,
          });
        }
      } else if (req.kind === "result") {
        if (!proof?.overallResult) {
          validationErrors.push({
            message: "Overall task result is required.",
            field: "overallResult",
          });
        }
      } else if (req.kind === "note") {
        if (!proof?.note || !proof.note.trim()) {
          validationErrors.push({
            message: "A completion note is required.",
            field: "note",
          });
        }
      } else if (req.kind === "attachment") {
        if (!proof?.attachments || proof.attachments.length === 0) {
          validationErrors.push({
            message: "At least one photo or evidence attachment is required.",
            field: "attachments",
          });
        }
      }
    }
  }

  for (const rule of rules) {
    let triggered = false;
    const trigger = rule.trigger;
    if (trigger?.kind === "result") {
      if (proof?.overallResult === trigger.value) {
        triggered = true;
      }
    } else if (trigger?.kind === "checklist") {
      const item = (proof?.checklist || []).find((c) => c.label === trigger.label);
      if (item && item.status === trigger.value) {
        triggered = true;
      }
    }

    if (triggered) {
      const req = rule.require;
      if (req?.kind === "note") {
        if (!proof?.note || !proof.note.trim()) {
          validationErrors.push({
            message: req.message || `A note is required because of a conditional rule.`,
            field: "note",
          });
        }
      } else if (req?.kind === "attachment") {
        if (!proof?.attachments || proof.attachments.length === 0) {
          validationErrors.push({
            message: req.message || `An attachment is required because of a conditional rule.`,
            field: "attachments",
          });
        }
      } else if (req?.kind === "measurement") {
        const item = (proof?.measurements || []).find((m) => m.label === req.label);
        if (!item || !item.value.trim()) {
          validationErrors.push({
            message: req.message || `Required measurement "${req.label}" is missing because of a conditional rule.`,
            field: `measurement:${req.label}`,
          });
        }
      } else if (req?.kind === "identifier") {
        const item = (proof?.identifiers || []).find((i) => i.label === req.label);
        if (!item || !item.value.trim()) {
          validationErrors.push({
            message: req.message || `Required identifier "${req.label}" is missing because of a conditional rule.`,
            field: `identifier:${req.label}`,
          });
        }
      }
    }
  }

  return validationErrors;
}
