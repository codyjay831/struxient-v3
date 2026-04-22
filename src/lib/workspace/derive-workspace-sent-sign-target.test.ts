import { describe, expect, it } from "vitest";
import { deriveNewestSentSignTarget, type VersionRowForSign } from "./derive-workspace-sent-sign-target";

describe("deriveNewestSentSignTarget", () => {
  it("returns null when no SENT", () => {
    expect(deriveNewestSentSignTarget([])).toBeNull();
    expect(
      deriveNewestSentSignTarget([
        { id: "a", versionNumber: 2, status: "DRAFT" },
        { id: "b", versionNumber: 1, status: "SIGNED" },
      ]),
    ).toBeNull();
  });

  it("returns newest SENT when head is DRAFT", () => {
    const rows: VersionRowForSign[] = [
      { id: "qv3", versionNumber: 3, status: "DRAFT" },
      { id: "qv2", versionNumber: 2, status: "SENT" },
      { id: "qv1", versionNumber: 1, status: "SIGNED" },
    ];
    expect(deriveNewestSentSignTarget(rows)).toEqual({
      quoteVersionId: "qv2",
      versionNumber: 2,
      portalQuoteShareToken: null,
    });
  });

  it("returns sole SENT when it is the head row", () => {
    const rows: VersionRowForSign[] = [
      { id: "qv2", versionNumber: 2, status: "SENT" },
      { id: "qv1", versionNumber: 1, status: "SIGNED" },
    ];
    expect(deriveNewestSentSignTarget(rows)).toEqual({
      quoteVersionId: "qv2",
      versionNumber: 2,
      portalQuoteShareToken: null,
    });
  });

  it("when multiple SENT (anomaly), picks first in list (highest versionNumber)", () => {
    const rows: VersionRowForSign[] = [
      { id: "qv3", versionNumber: 3, status: "SENT" },
      { id: "qv2", versionNumber: 2, status: "SENT" },
    ];
    expect(deriveNewestSentSignTarget(rows)?.quoteVersionId).toBe("qv3");
  });
});
