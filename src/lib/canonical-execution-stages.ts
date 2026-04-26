/**
 * Canonical Execution Stage Vocabulary for Struxient v3.
 *
 * This vocabulary is the single source of truth for task/packet placement
 * during the execution lifecycle. Workflow nodes and packet target keys
 * should align with these keys for optimal routing and grouping.
 */

export type CanonicalExecutionStageKey =
  | "pre-work"
  | "design"
  | "permitting"
  | "install"
  | "final-inspection"
  | "closeout";

export interface CanonicalExecutionStage {
  key: CanonicalExecutionStageKey;
  label: string;
  description: string;
  examples: string[];
  sortOrder: number;
}

export const CANONICAL_EXECUTION_STAGES: Record<
  CanonicalExecutionStageKey,
  CanonicalExecutionStage
> = {
  "pre-work": {
    key: "pre-work",
    label: "Pre-work",
    description: "Early customer/job prep before design, permitting, or install.",
    examples: ["Site visit", "Photo intake", "Customer access", "Initial measurements"],
    sortOrder: 1,
  },
  design: {
    key: "design",
    label: "Design",
    description: "Plans, engineering, drafting, calculations, technical prep.",
    examples: ["Drafting", "Structural engineering", "CAD review", "Calculations"],
    sortOrder: 2,
  },
  permitting: {
    key: "permitting",
    label: "Permitting",
    description: "Permit application, AHJ review, permit approval, permit corrections before install.",
    examples: ["Submit to AHJ", "Correction notice", "Permit pickup"],
    sortOrder: 3,
  },
  install: {
    key: "install",
    label: "Install",
    description: "Field production work, rough-in, mounting, wiring, equipment install, mid-job checks.",
    examples: ["Rough-in", "Mounting", "Wiring", "Mid-job inspection"],
    sortOrder: 4,
  },
  "final-inspection": {
    key: "final-inspection",
    label: "Final Inspection",
    description: "Formal final approval gate after install.",
    examples: ["Final AHJ inspection", "Customer walkthrough", "Final sign-off"],
    sortOrder: 5,
  },
  closeout: {
    key: "closeout",
    label: "Closeout",
    description: "Customer handoff, final docs, warranties, payment wrap-up, internal archive.",
    examples: ["Final documents", "Warranty delivery", "Payment wrap-up"],
    sortOrder: 6,
  },
};

export const CANONICAL_STAGE_KEYS: CanonicalExecutionStageKey[] = [
  "pre-work",
  "design",
  "permitting",
  "install",
  "final-inspection",
  "closeout",
];

export function listCanonicalExecutionStages(): CanonicalExecutionStage[] {
  return CANONICAL_STAGE_KEYS.map((k) => CANONICAL_EXECUTION_STAGES[k]);
}

export function isCanonicalExecutionStageKey(key: string): key is CanonicalExecutionStageKey {
  return key in CANONICAL_EXECUTION_STAGES;
}

export function getCanonicalExecutionStage(key: string): CanonicalExecutionStage | null {
  return isCanonicalExecutionStageKey(key) ? CANONICAL_EXECUTION_STAGES[key] : null;
}

export function humanizeCanonicalExecutionStageKey(key: string): string {
  const stage = getCanonicalExecutionStage(key);
  if (stage) return stage.label;
  
  // Fallback to basic capitalization for unknown keys
  return key
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
