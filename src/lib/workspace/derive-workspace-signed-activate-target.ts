/**
 * Chooses which quote version is the workspace **activate** candidate from version history.
 * History is expected **newest-first** (same as `GET …/workspace` / `…/versions`).
 */

export type VersionRowForActivate = {
  id: string;
  versionNumber: number;
  status: string;
  /** From workspace/history DTO — `Activation` row exists. */
  hasActivation: boolean;
  /** Plan or package snapshot hash recorded (freeze path signal on history row). */
  hasFrozenArtifacts: boolean;
};

export type SignedActivatableTarget = {
  quoteVersionId: string;
  versionNumber: number;
  hasFrozenArtifacts: boolean;
};

/**
 * **Rule:** the first row with `status === "SIGNED"` and `!hasActivation` in newest-first order — i.e. the
 * **highest `versionNumber`** among signed-but-not-yet-activated versions. Does not use head-only logic when
 * multiple signed rows exist.
 *
 * Server-side activation can still fail (job missing, freeze/hash/snapshot invariants, etc.); this only picks the
 * candidate id for `POST …/activate`.
 */
export function deriveNewestSignedWithoutActivationTarget(
  versionsOrderedNewestFirst: VersionRowForActivate[],
): SignedActivatableTarget | null {
  const row = versionsOrderedNewestFirst.find((v) => v.status === "SIGNED" && !v.hasActivation);
  if (!row) {
    return null;
  }
  return {
    quoteVersionId: row.id,
    versionNumber: row.versionNumber,
    hasFrozenArtifacts: row.hasFrozenArtifacts,
  };
}
