import { describe, expect, it } from "vitest";
import {
  deriveNewestActivatedExecutionEntryTarget,
  type VersionRowForExecutionEntry,
} from "./derive-workspace-execution-entry-target";

describe("deriveNewestActivatedExecutionEntryTarget", () => {
  it("returns null when nothing is activated", () => {
    expect(deriveNewestActivatedExecutionEntryTarget([])).toBeNull();
    expect(
      deriveNewestActivatedExecutionEntryTarget([
        { id: "a", versionNumber: 1, hasActivation: false },
      ]),
    ).toBeNull();
  });

  it("returns newest activated row when head is draft", () => {
    const rows: VersionRowForExecutionEntry[] = [
      { id: "qv3", versionNumber: 3, hasActivation: false },
      { id: "qv2", versionNumber: 2, hasActivation: true },
      { id: "qv1", versionNumber: 1, hasActivation: true },
    ];
    expect(deriveNewestActivatedExecutionEntryTarget(rows)).toEqual({
      quoteVersionId: "qv2",
      versionNumber: 2,
    });
  });

  it("returns head when head is the only activated row", () => {
    const rows: VersionRowForExecutionEntry[] = [
      { id: "qv2", versionNumber: 2, hasActivation: true },
      { id: "qv1", versionNumber: 1, hasActivation: false },
    ];
    expect(deriveNewestActivatedExecutionEntryTarget(rows)?.quoteVersionId).toBe("qv2");
  });
});
