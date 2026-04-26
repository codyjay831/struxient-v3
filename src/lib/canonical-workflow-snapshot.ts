/**
 * Canonical Workflow snapshot builder.
 *
 * Path B / Triangle Mode product direction:
 *   - The user never picks a "process template" — every tenant has a single
 *     auto-pinned canonical workflow whose nodes are the six canonical
 *     execution stages (`pre-work`, `design`, `permitting`, `install`,
 *     `final-inspection`, `closeout`).
 *   - The compose engine still validates `targetNodeKey` against this
 *     snapshot, so the canonical workflow's `nodes[]` list defines exactly
 *     the six stage keys (in canonical order) and nothing else.
 *
 * This module is pure (no Prisma, no I/O). Both the seed and the runtime
 * `ensure-canonical-workflow-version` helper consume it so dev DBs and
 * production tenants always agree on shape and key/version metadata.
 */

import {
  CANONICAL_EXECUTION_STAGES,
  CANONICAL_STAGE_KEYS,
} from "./canonical-execution-stages";

/**
 * Stable identifiers for the canonical workflow template/version row.
 *
 * - `templateKey` is unique per tenant (`@@unique([tenantId, templateKey])`)
 *   so this is a safe lookup key for the ensure helper.
 * - `versionNumber` stays at 1 because the canonical stage set is itself
 *   canonical: changing it would be a stage-vocabulary migration, not a
 *   workflow-version change. Future evolutions get a new version number
 *   only if/when we expand the canonical set.
 */
export const CANONICAL_WORKFLOW_TEMPLATE_KEY = "canonical-stages" as const;
export const CANONICAL_WORKFLOW_TEMPLATE_DISPLAY_NAME = "Standard Execution" as const;
export const CANONICAL_WORKFLOW_VERSION_NUMBER = 1 as const;

/**
 * Build the canonical `WorkflowVersion.snapshotJson` shape: a `nodes` array
 * whose entries are the six canonical execution stages, in canonical sort
 * order. Each node has `id` (raw stage key) and `displayName` (humanized
 * label) so `projectWorkflowNodeKeys` shows nice labels in the picker, and
 * `tasks: []` to match the existing minimal node shape used elsewhere
 * (e.g. seed.js / seed-demo-scenarios.ts) — there are no skeleton tasks.
 */
export function buildCanonicalWorkflowSnapshotJson(): {
  nodes: Array<{ id: string; displayName: string; tasks: never[] }>;
} {
  return {
    nodes: CANONICAL_STAGE_KEYS.map((k) => ({
      id: k,
      displayName: CANONICAL_EXECUTION_STAGES[k].label,
      tasks: [] as never[],
    })),
  };
}
