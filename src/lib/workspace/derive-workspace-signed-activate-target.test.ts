import { describe, expect, it } from "vitest";
import {
  deriveNewestSignedWithoutActivationTarget,
  type VersionRowForActivate,
} from "./derive-workspace-signed-activate-target";

describe("deriveNewestSignedWithoutActivationTarget", () => {
  it("returns null when no signed-without-activation row", () => {
    expect(deriveNewestSignedWithoutActivationTarget([])).toBeNull();
    expect(
      deriveNewestSignedWithoutActivationTarget([
        { id: "a", versionNumber: 2, status: "DRAFT", hasActivation: false, hasFrozenArtifacts: false },
      ]),
    ).toBeNull();
    expect(
      deriveNewestSignedWithoutActivationTarget([
        { id: "a", versionNumber: 2, status: "SIGNED", hasActivation: true, hasFrozenArtifacts: true },
      ]),
    ).toBeNull();
  });

  it("returns newest signed without activation when head is draft", () => {
    const rows: VersionRowForActivate[] = [
      { id: "qv3", versionNumber: 3, status: "DRAFT", hasActivation: false, hasFrozenArtifacts: false },
      {
        id: "qv2",
        versionNumber: 2,
        status: "SIGNED",
        hasActivation: false,
        hasFrozenArtifacts: true,
      },
      { id: "qv1", versionNumber: 1, status: "SIGNED", hasActivation: true, hasFrozenArtifacts: true },
    ];
    expect(deriveNewestSignedWithoutActivationTarget(rows)).toEqual({
      quoteVersionId: "qv2",
      versionNumber: 2,
      hasFrozenArtifacts: true,
    });
  });

  it("skips signed-with-activation to reach older signed row needing activation", () => {
    const rows: VersionRowForActivate[] = [
      { id: "qv2", versionNumber: 2, status: "SIGNED", hasActivation: true, hasFrozenArtifacts: true },
      { id: "qv1", versionNumber: 1, status: "SIGNED", hasActivation: false, hasFrozenArtifacts: true },
    ];
    expect(deriveNewestSignedWithoutActivationTarget(rows)).toEqual({
      quoteVersionId: "qv1",
      versionNumber: 1,
      hasFrozenArtifacts: true,
    });
  });

  it("when multiple signed without activation (anomaly), picks first in list", () => {
    const rows: VersionRowForActivate[] = [
      { id: "b", versionNumber: 3, status: "SIGNED", hasActivation: false, hasFrozenArtifacts: true },
      { id: "a", versionNumber: 2, status: "SIGNED", hasActivation: false, hasFrozenArtifacts: true },
    ];
    expect(deriveNewestSignedWithoutActivationTarget(rows)?.quoteVersionId).toBe("b");
  });
});
