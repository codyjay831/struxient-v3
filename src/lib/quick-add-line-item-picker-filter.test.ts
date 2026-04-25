import { describe, expect, it } from "vitest";
import {
  computeRecentLibraryPacketIds,
  filterLibraryPacketsByQuery,
  filterPinnableLibraryPackets,
  filterPresetsByQuery,
  type LineItemForRecent,
} from "./quick-add-line-item-picker-filter";
import type { LineItemPresetSummaryDto } from "@/server/slice1/reads/line-item-preset-reads";
import type { ScopePacketSummaryDto } from "@/server/slice1/reads/scope-packet-catalog-reads";

function pkt(overrides: Partial<ScopePacketSummaryDto> = {}): ScopePacketSummaryDto {
  return {
    id: "pkt-1",
    packetKey: "ev-charger-install",
    displayName: "EV Charger Install",
    revisionCount: 2,
    publishedRevisionCount: 1,
    supersededRevisionCount: 0,
    hasDraftRevision: false,
    latestPublishedRevisionId: "rev-1",
    latestPublishedRevisionNumber: 1,
    latestPublishedAtIso: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("filterPinnableLibraryPackets", () => {
  it("excludes packets without a published revision", () => {
    const a = pkt({ id: "a", latestPublishedRevisionId: "r-a" });
    const b = pkt({ id: "b", latestPublishedRevisionId: null });
    const c = pkt({ id: "c", latestPublishedRevisionId: "r-c" });
    expect(filterPinnableLibraryPackets([a, b, c]).map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("returns an empty list when nothing is pinnable", () => {
    expect(
      filterPinnableLibraryPackets([
        pkt({ id: "x", latestPublishedRevisionId: null }),
        pkt({ id: "y", latestPublishedRevisionId: null }),
      ]),
    ).toEqual([]);
  });

  it("preserves input order", () => {
    const items = [
      pkt({ id: "z", latestPublishedRevisionId: "rz" }),
      pkt({ id: "a", latestPublishedRevisionId: "ra" }),
      pkt({ id: "m", latestPublishedRevisionId: "rm" }),
    ];
    expect(filterPinnableLibraryPackets(items).map((p) => p.id)).toEqual(["z", "a", "m"]);
  });
});

describe("filterLibraryPacketsByQuery", () => {
  const fixtures: ScopePacketSummaryDto[] = [
    pkt({ id: "ev", packetKey: "ev-charger-install", displayName: "EV Charger Install" }),
    pkt({ id: "solar", packetKey: "solar-8kw", displayName: "8.4 kW Solar PV" }),
    pkt({ id: "panel", packetKey: "panel-200a", displayName: "200 A Panel Upgrade" }),
  ];

  it("returns all packets for empty query", () => {
    expect(filterLibraryPacketsByQuery(fixtures, "").map((p) => p.id)).toEqual(["ev", "solar", "panel"]);
  });

  it("returns all packets for whitespace-only query", () => {
    expect(filterLibraryPacketsByQuery(fixtures, "   ").map((p) => p.id)).toEqual(["ev", "solar", "panel"]);
  });

  it("matches displayName case-insensitively", () => {
    expect(filterLibraryPacketsByQuery(fixtures, "SOLAR").map((p) => p.id)).toEqual(["solar"]);
  });

  it("matches packetKey case-insensitively", () => {
    expect(filterLibraryPacketsByQuery(fixtures, "panel-200").map((p) => p.id)).toEqual(["panel"]);
  });

  it("matches partial substrings spanning either field", () => {
    // "install" hits "EV Charger Install" displayName + "ev-charger-install" packetKey
    expect(filterLibraryPacketsByQuery(fixtures, "install").map((p) => p.id)).toEqual(["ev"]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterLibraryPacketsByQuery(fixtures, "nope")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const copy = [...fixtures];
    filterLibraryPacketsByQuery(copy, "solar");
    expect(copy.map((p) => p.id)).toEqual(["ev", "solar", "panel"]);
  });
});

describe("filterPresetsByQuery", () => {
  function preset(overrides: Partial<LineItemPresetSummaryDto>): LineItemPresetSummaryDto {
    return {
      id: "preset-x",
      presetKey: "ev-l2-install",
      displayName: "EV L2 Install",
      defaultExecutionMode: "MANIFEST",
      defaultScopePacketId: null,
      defaultScopePacket: null,
      // Phase 2 / Slice 3 — commercial defaults moved onto the summary DTO so
      // the admin index can render price/qty/payment without a per-row detail
      // hop. Provide null fixtures here; the filter under test ignores them.
      defaultQuantity: null,
      defaultUnitPriceCents: null,
      defaultPaymentBeforeWork: null,
      createdAtIso: "2026-04-25T00:00:00.000Z",
      updatedAtIso: "2026-04-25T00:00:00.000Z",
      ...overrides,
    };
  }

  const fixtures: LineItemPresetSummaryDto[] = [
    preset({ id: "ev", presetKey: "ev-l2-install", displayName: "EV L2 Install" }),
    preset({ id: "ah", presetKey: "after-hours-fee", displayName: "After Hours Premium" }),
    preset({ id: "noKey", presetKey: null, displayName: "Discount, Loyalty" }),
  ];

  it("returns input order on empty / whitespace query", () => {
    expect(filterPresetsByQuery(fixtures, "").map((p) => p.id)).toEqual(["ev", "ah", "noKey"]);
    expect(filterPresetsByQuery(fixtures, "   ").map((p) => p.id)).toEqual(["ev", "ah", "noKey"]);
  });

  it("matches displayName case-insensitively", () => {
    expect(filterPresetsByQuery(fixtures, "AFTER").map((p) => p.id)).toEqual(["ah"]);
  });

  it("matches presetKey case-insensitively when present", () => {
    expect(filterPresetsByQuery(fixtures, "ev-l2").map((p) => p.id)).toEqual(["ev"]);
  });

  it("ignores presetKey when null and only matches via displayName", () => {
    expect(filterPresetsByQuery(fixtures, "loyalty").map((p) => p.id)).toEqual(["noKey"]);
    // 'ev-l2-install' would never match `noKey` because presetKey is null.
    expect(filterPresetsByQuery([fixtures[2]], "install")).toEqual([]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterPresetsByQuery(fixtures, "no-such-thing")).toEqual([]);
  });
});

describe("computeRecentLibraryPacketIds", () => {
  function line(overrides: Partial<LineItemForRecent>): LineItemForRecent {
    return {
      scopePacketRevisionId: null,
      scopeRevision: null,
      ...overrides,
    };
  }

  it("returns [] when no line items have a library pin", () => {
    expect(
      computeRecentLibraryPacketIds([
        line({}),
        line({ scopePacketRevisionId: "rev-1", scopeRevision: null }),
      ]),
    ).toEqual([]);
  });

  it("returns parent packet ids in first-seen order", () => {
    expect(
      computeRecentLibraryPacketIds([
        line({ scopePacketRevisionId: "r-a", scopeRevision: { scopePacketId: "pkt-a" } }),
        line({ scopePacketRevisionId: "r-b", scopeRevision: { scopePacketId: "pkt-b" } }),
        line({ scopePacketRevisionId: "r-c", scopeRevision: { scopePacketId: "pkt-c" } }),
      ]),
    ).toEqual(["pkt-a", "pkt-b", "pkt-c"]);
  });

  it("dedupes by packet id (multiple lines pinning the same packet count once)", () => {
    expect(
      computeRecentLibraryPacketIds([
        line({ scopePacketRevisionId: "r-a", scopeRevision: { scopePacketId: "pkt-a" } }),
        line({ scopePacketRevisionId: "r-a", scopeRevision: { scopePacketId: "pkt-a" } }),
        line({ scopePacketRevisionId: "r-b", scopeRevision: { scopePacketId: "pkt-b" } }),
      ]),
    ).toEqual(["pkt-a", "pkt-b"]);
  });

  it("respects the default limit of 3", () => {
    const items: LineItemForRecent[] = ["a", "b", "c", "d", "e"].map((k) => ({
      scopePacketRevisionId: `r-${k}`,
      scopeRevision: { scopePacketId: `pkt-${k}` },
    }));
    expect(computeRecentLibraryPacketIds(items)).toEqual(["pkt-a", "pkt-b", "pkt-c"]);
  });

  it("respects an explicit limit", () => {
    const items: LineItemForRecent[] = ["a", "b", "c", "d", "e"].map((k) => ({
      scopePacketRevisionId: `r-${k}`,
      scopeRevision: { scopePacketId: `pkt-${k}` },
    }));
    expect(computeRecentLibraryPacketIds(items, 2)).toEqual(["pkt-a", "pkt-b"]);
  });

  it("returns [] when limit is 0 or negative", () => {
    const items: LineItemForRecent[] = [
      { scopePacketRevisionId: "r-a", scopeRevision: { scopePacketId: "pkt-a" } },
    ];
    expect(computeRecentLibraryPacketIds(items, 0)).toEqual([]);
    expect(computeRecentLibraryPacketIds(items, -3)).toEqual([]);
  });

  it("skips library pins missing the scopeRevision relation defensively", () => {
    expect(
      computeRecentLibraryPacketIds([
        line({ scopePacketRevisionId: "r-orphan", scopeRevision: null }),
        line({ scopePacketRevisionId: "r-a", scopeRevision: { scopePacketId: "pkt-a" } }),
      ]),
    ).toEqual(["pkt-a"]);
  });
});
