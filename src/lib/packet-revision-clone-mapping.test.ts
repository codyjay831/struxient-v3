import { describe, expect, it } from "vitest";
import {
  mapPacketTaskLineToCloneCreate,
  normalizeEmbeddedPayloadForClone,
} from "./packet-revision-clone-mapping";

describe("mapPacketTaskLineToCloneCreate (revision-2 deep-clone mapper)", () => {
  it("preserves every locked field verbatim across the clone (decision pack §3)", () => {
    const out = mapPacketTaskLineToCloneCreate({
      lineKey: "line-a",
      sortOrder: 10,
      tierCode: "GOOD",
      lineKind: "EMBEDDED",
      embeddedPayloadJson: { title: "A", taskKind: "LABOR" },
      taskDefinitionId: null,
      targetNodeKey: "pre-work",
    });
    expect(out).toEqual({
      lineKey: "line-a",
      sortOrder: 10,
      tierCode: "GOOD",
      lineKind: "EMBEDDED",
      embeddedPayloadJson: { title: "A", taskKind: "LABOR" },
      taskDefinitionId: null,
      targetNodeKey: "pre-work",
    });
  });

  it("preserves LIBRARY rows with taskDefinitionId verbatim", () => {
    const out = mapPacketTaskLineToCloneCreate({
      lineKey: "line-lib",
      sortOrder: 0,
      tierCode: null,
      lineKind: "LIBRARY",
      embeddedPayloadJson: {},
      taskDefinitionId: "td_1",
      targetNodeKey: "install",
    });
    expect(out.taskDefinitionId).toBe("td_1");
    expect(out.lineKind).toBe("LIBRARY");
    expect(out.embeddedPayloadJson).toEqual({});
  });

  it("deep-clones the embedded payload object so source mutation cannot leak into destination", () => {
    const src = {
      title: "A",
      nested: { tags: ["x", "y"], n: 1 },
    };
    const out = mapPacketTaskLineToCloneCreate({
      lineKey: "k",
      sortOrder: 0,
      tierCode: null,
      lineKind: "EMBEDDED",
      embeddedPayloadJson: src,
      taskDefinitionId: null,
      targetNodeKey: "n",
    });
    // Mutate the source after mapping; the destination must remain untouched.
    src.title = "MUTATED";
    src.nested.tags.push("z");
    src.nested.n = 999;
    expect(out.embeddedPayloadJson).toEqual({
      title: "A",
      nested: { tags: ["x", "y"], n: 1 },
    });
  });

  it("deep-clones array payloads element-wise", () => {
    const src = [{ a: 1 }, { a: 2 }];
    const out = mapPacketTaskLineToCloneCreate({
      lineKey: "k",
      sortOrder: 0,
      tierCode: null,
      lineKind: "EMBEDDED",
      embeddedPayloadJson: src,
      taskDefinitionId: null,
      targetNodeKey: "n",
    });
    (src[0] as { a: number }).a = 999;
    expect(out.embeddedPayloadJson).toEqual([{ a: 1 }, { a: 2 }]);
  });
});

describe("normalizeEmbeddedPayloadForClone (defensive shape)", () => {
  it("coerces null to {} (PacketTaskLine.embeddedPayloadJson is NOT NULL)", () => {
    expect(normalizeEmbeddedPayloadForClone(null)).toEqual({});
  });

  it("coerces undefined to {}", () => {
    expect(normalizeEmbeddedPayloadForClone(undefined)).toEqual({});
  });

  it("coerces stray scalars to {} (no inline meaning leakage)", () => {
    expect(normalizeEmbeddedPayloadForClone("oops")).toEqual({});
    expect(normalizeEmbeddedPayloadForClone(42)).toEqual({});
    expect(normalizeEmbeddedPayloadForClone(true)).toEqual({});
  });

  it("preserves object payloads (deep-cloned)", () => {
    expect(normalizeEmbeddedPayloadForClone({ k: 1 })).toEqual({ k: 1 });
  });

  it("preserves array payloads (deep-cloned)", () => {
    expect(normalizeEmbeddedPayloadForClone([1, 2, 3])).toEqual([1, 2, 3]);
  });
});
