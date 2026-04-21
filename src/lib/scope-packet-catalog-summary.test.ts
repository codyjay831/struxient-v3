import { describe, expect, it } from "vitest";
import {
  clampScopePacketListLimit,
  SCOPE_PACKET_LIST_LIMIT_DEFAULTS,
  summarizeScopePacketRevisions,
  type ScopePacketRevisionForSummary,
} from "./scope-packet-catalog-summary";

function rev(
  id: string,
  revisionNumber: number,
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED",
  publishedAtIso: string,
): ScopePacketRevisionForSummary {
  return { id, revisionNumber, status, publishedAt: new Date(publishedAtIso) };
}

describe("summarizeScopePacketRevisions", () => {
  it("returns zero counts and null latest pointers for empty input", () => {
    expect(summarizeScopePacketRevisions([])).toEqual({
      revisionCount: 0,
      publishedRevisionCount: 0,
      supersededRevisionCount: 0,
      hasDraftRevision: false,
      latestPublishedRevisionId: null,
      latestPublishedRevisionNumber: null,
      latestPublishedAtIso: null,
    });
  });

  // Revision-2 evolution: a SUPERSEDED row is counted in revisionCount and
  // supersededRevisionCount, never in publishedRevisionCount, never selected
  // as latestPublished. Decision pack §6 / §11.
  it("counts SUPERSEDED rows separately and never as the latest published pointer", () => {
    const summary = summarizeScopePacketRevisions([
      rev("r1", 1, "SUPERSEDED", "2026-01-01T00:00:00Z"),
      rev("r2", 2, "PUBLISHED", "2026-02-01T00:00:00Z"),
    ]);
    expect(summary.revisionCount).toBe(2);
    expect(summary.publishedRevisionCount).toBe(1);
    expect(summary.supersededRevisionCount).toBe(1);
    expect(summary.hasDraftRevision).toBe(false);
    expect(summary.latestPublishedRevisionId).toBe("r2");
    expect(summary.latestPublishedRevisionNumber).toBe(2);
  });

  it("hasDraftRevision becomes true when any DRAFT row exists (multi-DRAFT UI gate input)", () => {
    const onlyPublished = summarizeScopePacketRevisions([
      rev("r1", 1, "PUBLISHED", "2026-01-01T00:00:00Z"),
    ]);
    expect(onlyPublished.hasDraftRevision).toBe(false);

    const oneDraft = summarizeScopePacketRevisions([
      rev("r1", 1, "PUBLISHED", "2026-01-01T00:00:00Z"),
      rev("r2", 2, "DRAFT", "2026-02-01T00:00:00Z"),
    ]);
    expect(oneDraft.hasDraftRevision).toBe(true);
  });

  it("counts all revisions but only published count toward publishedRevisionCount", () => {
    const summary = summarizeScopePacketRevisions([
      rev("r1", 1, "PUBLISHED", "2026-01-01T00:00:00Z"),
      rev("r2", 2, "DRAFT", "2026-02-01T00:00:00Z"),
    ]);
    expect(summary.revisionCount).toBe(2);
    expect(summary.publishedRevisionCount).toBe(1);
    expect(summary.latestPublishedRevisionId).toBe("r1");
    expect(summary.latestPublishedRevisionNumber).toBe(1);
    expect(summary.latestPublishedAtIso).toBe("2026-01-01T00:00:00.000Z");
  });

  it("picks the highest published revisionNumber regardless of input order or publishedAt", () => {
    const summary = summarizeScopePacketRevisions([
      rev("r2", 2, "PUBLISHED", "2026-01-01T00:00:00Z"),
      rev("r3", 3, "PUBLISHED", "2025-12-01T00:00:00Z"),
      rev("r1", 1, "PUBLISHED", "2026-03-01T00:00:00Z"),
    ]);
    expect(summary.publishedRevisionCount).toBe(3);
    expect(summary.latestPublishedRevisionId).toBe("r3");
    expect(summary.latestPublishedRevisionNumber).toBe(3);
    expect(summary.latestPublishedAtIso).toBe("2025-12-01T00:00:00.000Z");
  });

  it("ignores DRAFT revisions when picking latest published", () => {
    const summary = summarizeScopePacketRevisions([
      rev("r1", 1, "PUBLISHED", "2026-01-01T00:00:00Z"),
      rev("r2", 2, "DRAFT", "2026-02-01T00:00:00Z"),
      rev("r3", 3, "DRAFT", "2026-03-01T00:00:00Z"),
    ]);
    expect(summary.revisionCount).toBe(3);
    expect(summary.publishedRevisionCount).toBe(1);
    expect(summary.latestPublishedRevisionId).toBe("r1");
  });

  it("returns null latest pointers when no revision is published", () => {
    const summary = summarizeScopePacketRevisions([
      rev("r1", 1, "DRAFT", "2026-01-01T00:00:00Z"),
    ]);
    expect(summary.publishedRevisionCount).toBe(0);
    expect(summary.latestPublishedRevisionId).toBeNull();
    expect(summary.latestPublishedRevisionNumber).toBeNull();
    expect(summary.latestPublishedAtIso).toBeNull();
  });

  it("tolerates DRAFT rows with publishedAt = null (interim promotion canon amendment)", () => {
    // DRAFT revisions produced by the interim one-step promotion flow carry
    // publishedAt = null. The summary helper must skip them when picking the
    // latest published pointer rather than dereferencing the Date.
    const summary = summarizeScopePacketRevisions([
      { id: "r1", revisionNumber: 1, status: "DRAFT", publishedAt: null },
      { id: "r2", revisionNumber: 2, status: "PUBLISHED", publishedAt: new Date("2026-04-01T00:00:00Z") },
      { id: "r3", revisionNumber: 3, status: "DRAFT", publishedAt: null },
    ]);
    expect(summary.revisionCount).toBe(3);
    expect(summary.publishedRevisionCount).toBe(1);
    expect(summary.latestPublishedRevisionId).toBe("r2");
    expect(summary.latestPublishedAtIso).toBe("2026-04-01T00:00:00.000Z");
  });

  it("returns null latestPublishedAtIso when only DRAFT rows with null publishedAt exist", () => {
    const summary = summarizeScopePacketRevisions([
      { id: "r1", revisionNumber: 1, status: "DRAFT", publishedAt: null },
    ]);
    expect(summary.publishedRevisionCount).toBe(0);
    expect(summary.latestPublishedAtIso).toBeNull();
  });
});

describe("clampScopePacketListLimit", () => {
  it("returns the default when raw is null, empty, or unparseable", () => {
    expect(clampScopePacketListLimit(null)).toBe(SCOPE_PACKET_LIST_LIMIT_DEFAULTS.default);
    expect(clampScopePacketListLimit("")).toBe(SCOPE_PACKET_LIST_LIMIT_DEFAULTS.default);
    expect(clampScopePacketListLimit("not-a-number")).toBe(SCOPE_PACKET_LIST_LIMIT_DEFAULTS.default);
  });

  it("returns the default for non-positive values", () => {
    expect(clampScopePacketListLimit("0")).toBe(SCOPE_PACKET_LIST_LIMIT_DEFAULTS.default);
    expect(clampScopePacketListLimit("-5")).toBe(SCOPE_PACKET_LIST_LIMIT_DEFAULTS.default);
  });

  it("returns the requested value when within range", () => {
    expect(clampScopePacketListLimit("10")).toBe(10);
    expect(clampScopePacketListLimit("199")).toBe(199);
  });

  it("clamps to the max when the requested value is too large", () => {
    expect(clampScopePacketListLimit("9999")).toBe(SCOPE_PACKET_LIST_LIMIT_DEFAULTS.max);
  });
});
