import type { TaskDefinitionSummaryDto } from "@/server/slice1/reads/task-definition-reads";

/**
 * Pure, case-insensitive substring filter over TaskDefinition list results.
 *
 * Lives in src/lib so the picker UI can be exercised through unit tests without
 * React or DOM. The picker is intentionally client-side filtered — the existing
 * GET /api/task-definitions endpoint is already tenant-scoped, status-filterable,
 * and capped at 200 rows, which is plenty for a small narrow picker.
 */
export function filterTaskDefinitionSummariesByQuery(
  items: TaskDefinitionSummaryDto[],
  rawQuery: string,
): TaskDefinitionSummaryDto[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length === 0) return items;
  return items.filter((item) => {
    const key = item.taskKey.toLowerCase();
    const name = item.displayName.toLowerCase();
    return key.includes(q) || name.includes(q);
  });
}
