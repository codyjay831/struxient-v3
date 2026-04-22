import { describe, expect, it } from "vitest";
import { buildQuoteVersionCompareToPrior } from "./quote-version-history-reads";

function row(
  over: Partial<{
    id: string;
    versionNumber: number;
    pinnedWorkflowVersionId: string | null;
    planSnapshotSha256: string | null;
    packageSnapshotSha256: string | null;
    proposalGroups: number;
    quoteLineItems: number;
  }> = {},
) {
  const { proposalGroups = 1, quoteLineItems = 3, ...rest } = over;
  return {
    id: "qv_a",
    versionNumber: 2,
    pinnedWorkflowVersionId: null as string | null,
    planSnapshotSha256: null as string | null,
    packageSnapshotSha256: null as string | null,
    ...rest,
    _count: { proposalGroups, quoteLineItems },
  };
}

describe("buildQuoteVersionCompareToPrior", () => {
  it("computes count deltas from _count (newer − older)", () => {
    const newer = row({ id: "qv_b", versionNumber: 3, quoteLineItems: 5, proposalGroups: 2 });
    const older = row({ id: "qv_a", versionNumber: 2, quoteLineItems: 3, proposalGroups: 1 });
    expect(buildQuoteVersionCompareToPrior(newer, older)).toMatchObject({
      priorVersionId: "qv_a",
      priorVersionNumber: 2,
      lineItemCountDelta: 2,
      proposalGroupCountDelta: 1,
    });
  });

  it("returns frozenPlanAndPackageIdentical null when any snapshot hash is missing", () => {
    const newer = row({
      planSnapshotSha256: "p1",
      packageSnapshotSha256: null,
    });
    const older = row({
      id: "qv_old",
      versionNumber: 1,
      planSnapshotSha256: "p1",
      packageSnapshotSha256: "k1",
    });
    expect(buildQuoteVersionCompareToPrior(newer, older).frozenPlanAndPackageIdentical).toBeNull();
  });

  it("returns true when both sides have full hashes and they match", () => {
    const newer = row({
      planSnapshotSha256: "same_plan",
      packageSnapshotSha256: "same_pkg",
    });
    const older = row({
      id: "qv_old",
      versionNumber: 1,
      planSnapshotSha256: "same_plan",
      packageSnapshotSha256: "same_pkg",
    });
    expect(buildQuoteVersionCompareToPrior(newer, older).frozenPlanAndPackageIdentical).toBe(true);
  });

  it("returns false when both sides have full hashes and any differs", () => {
    const newer = row({
      planSnapshotSha256: "p2",
      packageSnapshotSha256: "k1",
    });
    const older = row({
      id: "qv_old",
      versionNumber: 1,
      planSnapshotSha256: "p1",
      packageSnapshotSha256: "k1",
    });
    expect(buildQuoteVersionCompareToPrior(newer, older).frozenPlanAndPackageIdentical).toBe(false);
  });

  it("detects pinned workflow id match including both unset", () => {
    const newer = row({ pinnedWorkflowVersionId: null });
    const older = row({ id: "qv_old", versionNumber: 1, pinnedWorkflowVersionId: null });
    expect(buildQuoteVersionCompareToPrior(newer, older).pinnedWorkflowVersionIdMatch).toBe(true);
  });

  it("detects pinned workflow id mismatch", () => {
    const newer = row({ pinnedWorkflowVersionId: "wf_2" });
    const older = row({ id: "qv_old", versionNumber: 1, pinnedWorkflowVersionId: "wf_1" });
    expect(buildQuoteVersionCompareToPrior(newer, older).pinnedWorkflowVersionIdMatch).toBe(false);
  });
});
