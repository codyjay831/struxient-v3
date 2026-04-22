import { describe, expect, it } from "vitest";
import {
  deriveScopeVersionContext,
  groupQuoteScopeLineItemsByProposalGroup,
  type ScopeLineItemForGrouping,
  type ScopeProposalGroupForGrouping,
} from "./quote-scope-grouping";

const G = (id: string, name: string, sortOrder = 0): ScopeProposalGroupForGrouping => ({
  id,
  name,
  sortOrder,
});

const I = (id: string, proposalGroupId: string): ScopeLineItemForGrouping => ({
  id,
  proposalGroupId,
});

describe("groupQuoteScopeLineItemsByProposalGroup", () => {
  it("returns empty buckets and no orphans when there are no items", () => {
    const r = groupQuoteScopeLineItemsByProposalGroup([G("g1", "A"), G("g2", "B")], []);
    expect(r.groupsWithItems).toEqual([
      { id: "g1", name: "A", sortOrder: 0, items: [] },
      { id: "g2", name: "B", sortOrder: 0, items: [] },
    ]);
    expect(r.orphanedItems).toEqual([]);
  });

  it("preserves group order and item order within group", () => {
    const groups = [G("g1", "A"), G("g2", "B")];
    const items = [I("i1", "g1"), I("i2", "g2"), I("i3", "g1"), I("i4", "g2")];
    const r = groupQuoteScopeLineItemsByProposalGroup(groups, items);
    expect(r.groupsWithItems[0]?.items.map((i) => i.id)).toEqual(["i1", "i3"]);
    expect(r.groupsWithItems[1]?.items.map((i) => i.id)).toEqual(["i2", "i4"]);
    expect(r.orphanedItems).toEqual([]);
  });

  it("reports orphans (items pointing at unknown groups) instead of silently dropping them", () => {
    const groups = [G("g1", "A")];
    const items = [I("i1", "g1"), I("i2", "g_missing"), I("i3", "g1")];
    const r = groupQuoteScopeLineItemsByProposalGroup(groups, items);
    expect(r.groupsWithItems[0]?.items.map((i) => i.id)).toEqual(["i1", "i3"]);
    expect(r.orphanedItems.map((i) => i.id)).toEqual(["i2"]);
  });

  it("never drops or duplicates: items.length == sum(bucket.length) + orphans.length", () => {
    const groups = [G("g1", "A"), G("g2", "B"), G("g3", "C")];
    const items = [
      I("i1", "g1"),
      I("i2", "g2"),
      I("i3", "g_missing"),
      I("i4", "g3"),
      I("i5", "g1"),
      I("i6", "g_missing"),
      I("i7", "g2"),
    ];
    const r = groupQuoteScopeLineItemsByProposalGroup(groups, items);
    const bucketed = r.groupsWithItems.reduce((acc, g) => acc + g.items.length, 0);
    expect(bucketed + r.orphanedItems.length).toBe(items.length);

    const ids = new Set<string>();
    for (const g of r.groupsWithItems) for (const it of g.items) ids.add(it.id);
    for (const it of r.orphanedItems) ids.add(it.id);
    expect(ids.size).toBe(items.length);
  });

  it("does not mutate input arrays", () => {
    const groups = [G("g1", "A")];
    const items = [I("i1", "g1")];
    const groupsCopy = [...groups];
    const itemsCopy = [...items];
    groupQuoteScopeLineItemsByProposalGroup(groups, items);
    expect(groups).toEqual(groupsCopy);
    expect(items).toEqual(itemsCopy);
  });
});

describe("deriveScopeVersionContext", () => {
  it("DRAFT + isLatest = latest_draft (emerald)", () => {
    const r = deriveScopeVersionContext({ status: "DRAFT", isLatest: true, versionNumber: 3 });
    expect(r.kind).toBe("latest_draft");
    expect(r.tone).toBe("emerald");
    expect(r.title).toContain("v3");
  });

  it("DRAFT + !isLatest = older_draft (amber)", () => {
    const r = deriveScopeVersionContext({ status: "DRAFT", isLatest: false, versionNumber: 1 });
    expect(r.kind).toBe("older_draft");
    expect(r.tone).toBe("amber");
    expect(r.message.toLowerCase()).toContain("older");
  });

  it("SENT + isLatest = frozen_latest (amber, instructs to start a new draft)", () => {
    const r = deriveScopeVersionContext({ status: "SENT", isLatest: true, versionNumber: 5 });
    expect(r.kind).toBe("frozen_latest");
    expect(r.tone).toBe("amber");
    expect(r.message.toLowerCase()).toContain("new draft");
  });

  it("SIGNED + isLatest = frozen_latest (same tone/copy as SENT-latest)", () => {
    const r = deriveScopeVersionContext({ status: "SIGNED", isLatest: true, versionNumber: 5 });
    expect(r.kind).toBe("frozen_latest");
    expect(r.tone).toBe("amber");
  });

  it("SENT + !isLatest = frozen_older (zinc, audit-only)", () => {
    const r = deriveScopeVersionContext({ status: "SENT", isLatest: false, versionNumber: 2 });
    expect(r.kind).toBe("frozen_older");
    expect(r.tone).toBe("zinc");
    expect(r.message.toLowerCase()).toContain("audit");
  });

  it("VOID + isLatest = frozen_latest (read-only)", () => {
    const r = deriveScopeVersionContext({ status: "VOID", isLatest: true, versionNumber: 4 });
    expect(r.kind).toBe("frozen_latest");
    expect(r.tone).toBe("amber");
  });

  it("Unrecognised status surfaces as amber and points at lifecycle reads", () => {
    const r = deriveScopeVersionContext({
      status: "WEIRD_STATE",
      isLatest: true,
      versionNumber: 7,
    });
    expect(r.kind).toBe("unknown_status_latest");
    expect(r.tone).toBe("amber");
    expect(r.message.toLowerCase()).toContain("lifecycle");
  });

  it("Unrecognised status on older version surfaces as unknown_status_older (amber)", () => {
    const r = deriveScopeVersionContext({
      status: "WEIRD_STATE",
      isLatest: false,
      versionNumber: 7,
    });
    expect(r.kind).toBe("unknown_status_older");
    expect(r.tone).toBe("amber");
  });
});
