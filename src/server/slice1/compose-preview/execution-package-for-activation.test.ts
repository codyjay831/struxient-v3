import { describe, expect, it } from "vitest";
import { parseExecutionPackageSnapshotV0ForActivation } from "./execution-package-for-activation";

/**
 * Direct unit coverage for the parser that drives activation-bound
 * RuntimeTask field provenance.
 *
 * Canon contract this guards (from `docs/canon/03-quote-to-execution-canon.md`
 * + `activate-quote-version.ts`):
 *
 *   - Activation must consume **frozen** snapshots only — never re-running
 *     compose. Every field that ends up on a `RuntimeTask` for a manifest
 *     slot must originate from the frozen `executionPackageSnapshot.v0`
 *     slot (`displayTitle`, `instructions`, `completionRequirementsJson`,
 *     `conditionalRulesJson`, `nodeId`, `packageTaskId`).
 *   - Workflow-skeleton slots are skipped (no duplicate RuntimeTask rows).
 *
 * We pin those guarantees here at the parser boundary so a regression in
 * the parser would surface as a focused unit failure long before it could
 * silently change activation behavior.
 */

function snapshot(over: {
  pinnedWorkflowVersionId?: string;
  slots?: unknown[];
  paymentGateIntent?: unknown;
} = {}): unknown {
  return {
    schemaVersion: "executionPackageSnapshot.v0",
    pinnedWorkflowVersionId: over.pinnedWorkflowVersionId ?? "wfv-1",
    composedAt: "2026-04-01T00:00:00.000Z",
    slots: over.slots ?? [],
    diagnostics: { errors: [], warnings: [] },
    ...(over.paymentGateIntent !== undefined
      ? { paymentGateIntent: over.paymentGateIntent }
      : {}),
  };
}

describe("parseExecutionPackageSnapshotV0ForActivation — activation field provenance", () => {
  it("preserves displayTitle, instructions, requirements, and conditional rules verbatim from the frozen slot", () => {
    const reqs = [
      { kind: "checklist", label: "Lock out", required: true },
      { kind: "measurement", label: "Suction", unit: "psi", required: true },
    ];
    const rules = [{ when: "field=true", then: "show" }];
    const out = parseExecutionPackageSnapshotV0ForActivation(
      snapshot({
        slots: [
          {
            packageTaskId: "pkgt-A1",
            nodeId: "install-rooftop-unit",
            source: "MANIFEST",
            planTaskIds: ["plant-1", "plant-2"],
            skeletonTaskId: null,
            lineItemIds: ["li-1"],
            displayTitle: "Install RTU at site",
            completionRequirementsJson: reqs,
            conditionalRulesJson: rules,
            instructions: "Use ladder type B",
          },
        ],
      }),
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.slots).toHaveLength(1);
    const slot = out.slots[0]!;
    expect(slot.packageTaskId).toBe("pkgt-A1");
    expect(slot.nodeId).toBe("install-rooftop-unit");
    expect(slot.lineItemId).toBe("li-1");
    expect(slot.planTaskIds).toEqual(["plant-1", "plant-2"]);
    expect(slot.displayTitle).toBe("Install RTU at site");
    expect(slot.instructions).toBe("Use ladder type B");
    // These two fields are passed through unchanged so RuntimeTask hydrates
    // from the frozen contract — never from a re-derived authored source.
    expect(slot.completionRequirementsJson).toEqual(reqs);
    expect(slot.conditionalRulesJson).toEqual(rules);
  });

  it("skips workflow-skeleton slots and counts them separately (no duplicate RuntimeTask rows)", () => {
    const out = parseExecutionPackageSnapshotV0ForActivation(
      snapshot({
        slots: [
          {
            packageTaskId: "pkgt-skel-a",
            nodeId: "n-a",
            source: "WORKFLOW",
            planTaskIds: [],
            skeletonTaskId: null,
            lineItemIds: [],
            displayTitle: "Skeleton — survey",
          },
          {
            packageTaskId: "pkgt-skel-b",
            nodeId: "n-b",
            source: "MANIFEST",
            // skeletonTaskId being non-empty also marks this as skeleton.
            planTaskIds: ["plant-x"],
            skeletonTaskId: "sk-1",
            lineItemIds: ["li-1"],
            displayTitle: "Skeleton — install (re-projected)",
          },
          {
            packageTaskId: "pkgt-real",
            nodeId: "n-c",
            source: "MANIFEST",
            planTaskIds: ["plant-y"],
            skeletonTaskId: null,
            lineItemIds: ["li-2"],
            displayTitle: "Real manifest task",
          },
        ],
      }),
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.skippedSkeletonSlotCount).toBe(2);
    expect(out.slots).toHaveLength(1);
    expect(out.slots[0]!.packageTaskId).toBe("pkgt-real");
  });

  it("falls back to top-level lineItemId when lineItemIds[] is absent (legacy frozen shape)", () => {
    const out = parseExecutionPackageSnapshotV0ForActivation(
      snapshot({
        slots: [
          {
            packageTaskId: "pkgt-A",
            nodeId: "n-1",
            source: "MANIFEST",
            planTaskIds: ["plant-1"],
            skeletonTaskId: null,
            lineItemId: "li-legacy",
            displayTitle: "Legacy shape",
          },
        ],
      }),
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.slots[0]!.lineItemId).toBe("li-legacy");
  });

  it("rejects missing packageTaskId / nodeId / planTaskIds (invariants the activator depends on)", () => {
    const noPackageTaskId = parseExecutionPackageSnapshotV0ForActivation(
      snapshot({
        slots: [
          {
            nodeId: "n-1",
            source: "MANIFEST",
            planTaskIds: ["plant-1"],
            skeletonTaskId: null,
            lineItemIds: ["li-1"],
          },
        ],
      }),
    );
    expect(noPackageTaskId.ok).toBe(false);

    const noNode = parseExecutionPackageSnapshotV0ForActivation(
      snapshot({
        slots: [
          {
            packageTaskId: "pkgt-1",
            source: "MANIFEST",
            planTaskIds: ["plant-1"],
            skeletonTaskId: null,
            lineItemIds: ["li-1"],
          },
        ],
      }),
    );
    expect(noNode.ok).toBe(false);

    const emptyPlanTaskIds = parseExecutionPackageSnapshotV0ForActivation(
      snapshot({
        slots: [
          {
            packageTaskId: "pkgt-1",
            nodeId: "n-1",
            source: "MANIFEST",
            planTaskIds: [],
            skeletonTaskId: null,
            lineItemIds: ["li-1"],
          },
        ],
      }),
    );
    expect(emptyPlanTaskIds.ok).toBe(false);
  });

  it("rejects unknown schema version (UNSUPPORTED_PACKAGE_VERSION)", () => {
    const out = parseExecutionPackageSnapshotV0ForActivation({
      schemaVersion: "executionPackageSnapshot.v999",
      pinnedWorkflowVersionId: "wfv-1",
      slots: [],
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.code).toBe("UNSUPPORTED_PACKAGE_VERSION");
  });

  it("validates paymentGateIntent against manifest slot ids only (not skeleton ids)", () => {
    const out = parseExecutionPackageSnapshotV0ForActivation(
      snapshot({
        slots: [
          {
            packageTaskId: "pkgt-real",
            nodeId: "n-c",
            source: "MANIFEST",
            planTaskIds: ["plant-1"],
            skeletonTaskId: null,
            lineItemIds: ["li-1"],
            displayTitle: "Real",
          },
          {
            packageTaskId: "pkgt-skel",
            nodeId: "n-d",
            source: "WORKFLOW",
            planTaskIds: [],
            skeletonTaskId: null,
            lineItemIds: [],
            displayTitle: "Skel",
          },
        ],
        paymentGateIntent: {
          schemaVersion: "paymentGateIntent.v0",
          title: "Deposit",
          targetPackageTaskIds: ["pkgt-skel"],
        },
      }),
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.code).toBe("INVALID_PAYMENT_GATE_INTENT");
    expect(out.message).toContain("pkgt-skel");
  });

  it("returns a clean paymentGateIntent when targets reference only manifest slots", () => {
    const out = parseExecutionPackageSnapshotV0ForActivation(
      snapshot({
        slots: [
          {
            packageTaskId: "pkgt-A",
            nodeId: "n-a",
            source: "MANIFEST",
            planTaskIds: ["plant-1"],
            skeletonTaskId: null,
            lineItemIds: ["li-1"],
            displayTitle: "A",
          },
          {
            packageTaskId: "pkgt-B",
            nodeId: "n-b",
            source: "MANIFEST",
            planTaskIds: ["plant-2"],
            skeletonTaskId: null,
            lineItemIds: ["li-2"],
            displayTitle: "B",
          },
        ],
        paymentGateIntent: {
          schemaVersion: "paymentGateIntent.v0",
          title: "Mobilization deposit",
          targetPackageTaskIds: ["pkgt-A", "pkgt-B", "pkgt-A"],
        },
      }),
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.paymentGateIntent).toEqual({
      schemaVersion: "paymentGateIntent.v0",
      title: "Mobilization deposit",
      targetPackageTaskIds: ["pkgt-A", "pkgt-B"],
    });
  });
});
