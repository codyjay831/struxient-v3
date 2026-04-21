import { describe, expect, it } from "vitest";
import {
  mapQuoteLocalPacketItemToPacketTaskLineCreate,
  normalizeEmbeddedPayloadForPromotion,
  type PromotionSourceItem,
} from "./packet-promotion-mapping";

/**
 * Locks the canon-defined 1:1 transform used by the interim one-step promotion
 * mutation. Any change here must be motivated by a canon update first.
 *
 * Canon refs:
 *   docs/canon/05-packet-canon.md (Canonical mapping table)
 *   docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md §4
 *   docs/epics/16-packet-task-lines-epic.md §16a
 */

function embeddedItem(overrides?: Partial<PromotionSourceItem>): PromotionSourceItem {
  return {
    lineKey: "tear-off-1",
    sortOrder: 0,
    tierCode: "GOOD",
    lineKind: "EMBEDDED",
    embeddedPayloadJson: { title: "Tear off", taskKind: "LABOR" },
    taskDefinitionId: null,
    targetNodeKey: "node-roof",
    ...overrides,
  };
}

function libraryItem(overrides?: Partial<PromotionSourceItem>): PromotionSourceItem {
  return {
    lineKey: "inspect-1",
    sortOrder: 5,
    tierCode: null,
    lineKind: "LIBRARY",
    embeddedPayloadJson: null,
    taskDefinitionId: "td_abc",
    targetNodeKey: "node-inspect",
    ...overrides,
  };
}

describe("mapQuoteLocalPacketItemToPacketTaskLineCreate (interim promotion)", () => {
  it("EMBEDDED row: copies every field 1:1 and deep-clones embeddedPayloadJson", () => {
    const src = embeddedItem();
    const out = mapQuoteLocalPacketItemToPacketTaskLineCreate(src);
    expect(out.lineKey).toBe(src.lineKey);
    expect(out.sortOrder).toBe(src.sortOrder);
    expect(out.tierCode).toBe(src.tierCode);
    expect(out.lineKind).toBe("EMBEDDED");
    expect(out.taskDefinitionId).toBeNull();
    expect(out.targetNodeKey).toBe(src.targetNodeKey);
    expect(out.embeddedPayloadJson).toEqual(src.embeddedPayloadJson);
    // Deep clone, not shared reference (mutating dest must not affect source).
    (out.embeddedPayloadJson as Record<string, unknown>).title = "MUTATED";
    expect((src.embeddedPayloadJson as Record<string, unknown>).title).toBe("Tear off");
  });

  it("LIBRARY row with null payload: writes {} to satisfy NOT NULL target contract", () => {
    const src = libraryItem();
    const out = mapQuoteLocalPacketItemToPacketTaskLineCreate(src);
    expect(out.lineKind).toBe("LIBRARY");
    expect(out.taskDefinitionId).toBe("td_abc");
    expect(out.targetNodeKey).toBe("node-inspect");
    expect(out.embeddedPayloadJson).toEqual({});
  });

  it("LIBRARY row with non-null payload: preserves payload (canon does not strip metadata)", () => {
    const src = libraryItem({ embeddedPayloadJson: { instructions: "wear PPE" } });
    const out = mapQuoteLocalPacketItemToPacketTaskLineCreate(src);
    expect(out.embeddedPayloadJson).toEqual({ instructions: "wear PPE" });
  });

  it("preserves nullable tierCode and integer sortOrder verbatim", () => {
    const src = embeddedItem({ tierCode: null, sortOrder: 42 });
    const out = mapQuoteLocalPacketItemToPacketTaskLineCreate(src);
    expect(out.tierCode).toBeNull();
    expect(out.sortOrder).toBe(42);
  });
});

describe("normalizeEmbeddedPayloadForPromotion", () => {
  it("null/undefined → empty object", () => {
    expect(normalizeEmbeddedPayloadForPromotion(null)).toEqual({});
    expect(normalizeEmbeddedPayloadForPromotion(undefined)).toEqual({});
  });
  it("scalar → empty object (avoids inventing inline meaning)", () => {
    expect(normalizeEmbeddedPayloadForPromotion("anything")).toEqual({});
    expect(normalizeEmbeddedPayloadForPromotion(7)).toEqual({});
    expect(normalizeEmbeddedPayloadForPromotion(true)).toEqual({});
  });
  it("object/array are deep-cloned", () => {
    const obj = { a: { b: 1 } };
    const out = normalizeEmbeddedPayloadForPromotion(obj) as { a: { b: number } };
    out.a.b = 99;
    expect(obj.a.b).toBe(1);

    const arr = [{ x: 1 }, { x: 2 }];
    const outArr = normalizeEmbeddedPayloadForPromotion(arr) as { x: number }[];
    outArr[0].x = 99;
    expect(arr[0].x).toBe(1);
  });
});
