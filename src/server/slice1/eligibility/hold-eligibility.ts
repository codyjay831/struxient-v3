/** Active hold row shape used for start blocking (Epic 29 backbone). */
export type ActiveHoldScope = { runtimeTaskId: string | null };

/**
 * True when an ACTIVE operational hold blocks **starting** this runtime task:
 * job-wide (`runtimeTaskId` null) or scoped to this task id.
 */
export function runtimeTaskBlockedByActiveHolds(holds: ActiveHoldScope[], runtimeTaskId: string): boolean {
  return holds.some((h) => h.runtimeTaskId == null || h.runtimeTaskId === runtimeTaskId);
}

/** Job-wide hold blocks skeleton task starts on that job (task-scoped holds do not target skeleton ids in v1). */
export function skeletonStartBlockedByActiveHolds(holds: ActiveHoldScope[]): boolean {
  return holds.some((h) => h.runtimeTaskId == null);
}
