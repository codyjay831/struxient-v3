import { describe, expect, it } from "vitest";
import {
  mapPacketTaskLineToQuoteLocalPacketItemCreate,
  normalizeEmbeddedPayloadForFork,
  type ForkSourcePacketTaskLine,
} from "./packet-fork-mapping";

/**
 * Locks the canon-defined inverse 1:1 transform used by the quote-local
 * fork-from-library mutation. Symmetric with `packet-promotion-mapping.test.ts`.
 *
 * Canon refs:
 *   docs/canon/05-packet-canon.md §100-101 (mandatory fork on task mutation)
 *   docs/canon/05-packet-canon.md §134-147 (canonical mapping table)
 *   docs/bridge-decisions/03-packet-fork-promotion-decision.md
 */

function embeddedSource(
  overrides?: Partial<ForkSourcePacketTaskLine>,
): ForkSourcePacketTaskLine {
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

function librarySource(
  overrides?: Partial<ForkSourcePacketTaskLine>,
): ForkSourcePacketTaskLine {
  return {
    lineKey: "inspect-1",
    sortOrder: 5,
    tierCode: null,
    lineKind: "LIBRARY",
    embeddedPayloadJson: {},
    taskDefinitionId: "td_abc",
    targetNodeKey: "node-inspect",
    ...overrides,
  };
}

describe("mapPacketTaskLineToQuoteLocalPacketItemCreate (interim fork)", () => {
  it("EMBEDDED row: copies every field 1:1 and deep-clones embeddedPayloadJson", () => {
    const src = embeddedSource();
    const out = mapPacketTaskLineToQuoteLocalPacketItemCreate(src);
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

  it("LIBRARY row: preserves the {} payload from the forward mapper round-trip", () => {
    const src = librarySource();
    const out = mapPacketTaskLineToQuoteLocalPacketItemCreate(src);
    expect(out.lineKind).toBe("LIBRARY");
    expect(out.taskDefinitionId).toBe("td_abc");
    expect(out.targetNodeKey).toBe("node-inspect");
    expect(out.embeddedPayloadJson).toEqual({});
  });

  it("LIBRARY row with non-empty payload: preserves payload (canon does not strip metadata)", () => {
    const src = librarySource({ embeddedPayloadJson: { instructions: "wear PPE" } });
    const out = mapPacketTaskLineToQuoteLocalPacketItemCreate(src);
    expect(out.embeddedPayloadJson).toEqual({ instructions: "wear PPE" });
  });

  it("preserves nullable tierCode and integer sortOrder verbatim", () => {
    const src = embeddedSource({ tierCode: null, sortOrder: 42 });
    const out = mapPacketTaskLineToQuoteLocalPacketItemCreate(src);
    expect(out.tierCode).toBeNull();
    expect(out.sortOrder).toBe(42);
  });

  it("round-trip: forward mapping then inverse mapping is field-for-field stable", async () => {
    // Importing here so this file does not become a circular-dep style example
    // for the source modules; both helpers are pure.
    const { mapQuoteLocalPacketItemToPacketTaskLineCreate } = await import(
      "./packet-promotion-mapping"
    );
    const original = {
      lineKey: "rt-1",
      sortOrder: 3,
      tierCode: "BEST",
      lineKind: "EMBEDDED" as const,
      embeddedPayloadJson: { title: "RT", deep: { nested: [1, 2, 3] } },
      taskDefinitionId: null,
      targetNodeKey: "node-rt",
    };
    const promoted = mapQuoteLocalPacketItemToPacketTaskLineCreate(original);
    const forked = mapPacketTaskLineToQuoteLocalPacketItemCreate({
      lineKey: promoted.lineKey,
      sortOrder: promoted.sortOrder,
      tierCode: promoted.tierCode,
      lineKind: promoted.lineKind,
      embeddedPayloadJson: promoted.embeddedPayloadJson,
      taskDefinitionId: promoted.taskDefinitionId,
      targetNodeKey: promoted.targetNodeKey,
    });
    expect(forked.lineKey).toBe(original.lineKey);
    expect(forked.sortOrder).toBe(original.sortOrder);
    expect(forked.tierCode).toBe(original.tierCode);
    expect(forked.lineKind).toBe(original.lineKind);
    expect(forked.targetNodeKey).toBe(original.targetNodeKey);
    expect(forked.taskDefinitionId).toBe(original.taskDefinitionId);
    expect(forked.embeddedPayloadJson).toEqual(original.embeddedPayloadJson);
  });
});

describe("normalizeEmbeddedPayloadForFork", () => {
  it("null/undefined → null (destination column is nullable)", () => {
    expect(normalizeEmbeddedPayloadForFork(null)).toBeNull();
    expect(normalizeEmbeddedPayloadForFork(undefined)).toBeNull();
  });
  it("scalar → empty object (avoids inventing inline meaning)", () => {
    expect(normalizeEmbeddedPayloadForFork("anything")).toEqual({});
    expect(normalizeEmbeddedPayloadForFork(7)).toEqual({});
    expect(normalizeEmbeddedPayloadForFork(true)).toEqual({});
  });
  it("object/array are deep-cloned", () => {
    const obj = { a: { b: 1 } };
    const out = normalizeEmbeddedPayloadForFork(obj) as { a: { b: number } };
    out.a.b = 99;
    expect(obj.a.b).toBe(1);

    const arr = [{ x: 1 }, { x: 2 }];
    const outArr = normalizeEmbeddedPayloadForFork(arr) as { x: number }[];
    outArr[0].x = 99;
    expect(arr[0].x).toBe(1);
  });
});
