import { describe, expect, it } from "vitest";
import {
  assertDisplayName,
  assertOptionalDescription,
  assertLineKey,
  assertSortOrder,
  assertOptionalTierCode,
  assertTargetNodeKey,
  assertLineKind,
  assertOptionalEmbeddedPayload,
  assertOptionalTaskDefinitionId,
  assertPacketKey,
} from "./quote-local-packet-input";
import { InvariantViolationError } from "@/server/slice1/errors";

function expectInvariant(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error("expected InvariantViolationError to be thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(InvariantViolationError);
    if (e instanceof InvariantViolationError) {
      expect(e.code).toBe(code);
    }
  }
}

describe("assertDisplayName", () => {
  it("trims and accepts a non-empty string", () => {
    expect(assertDisplayName("  Foo  ")).toBe("Foo");
  });
  it("rejects empty / whitespace / non-string", () => {
    expectInvariant(() => assertDisplayName(""), "QUOTE_LOCAL_PACKET_INVALID_DISPLAY_NAME");
    expectInvariant(() => assertDisplayName("   "), "QUOTE_LOCAL_PACKET_INVALID_DISPLAY_NAME");
    expectInvariant(() => assertDisplayName(123), "QUOTE_LOCAL_PACKET_INVALID_DISPLAY_NAME");
    expectInvariant(() => assertDisplayName(null), "QUOTE_LOCAL_PACKET_INVALID_DISPLAY_NAME");
  });
  it("rejects over-length", () => {
    expectInvariant(() => assertDisplayName("x".repeat(201)), "QUOTE_LOCAL_PACKET_INVALID_DISPLAY_NAME");
  });
});

describe("assertOptionalDescription", () => {
  it("normalizes null/undefined/empty to null", () => {
    expect(assertOptionalDescription(undefined)).toBeNull();
    expect(assertOptionalDescription(null)).toBeNull();
    expect(assertOptionalDescription("")).toBeNull();
    expect(assertOptionalDescription("   ")).toBeNull();
  });
  it("trims a non-empty string", () => {
    expect(assertOptionalDescription("  hi  ")).toBe("hi");
  });
  it("rejects non-string", () => {
    expectInvariant(() => assertOptionalDescription(42), "QUOTE_LOCAL_PACKET_INVALID_DESCRIPTION");
  });
  it("rejects over-length", () => {
    expectInvariant(() => assertOptionalDescription("x".repeat(4001)), "QUOTE_LOCAL_PACKET_INVALID_DESCRIPTION");
  });
});

describe("assertLineKey", () => {
  it("accepts allowed character set", () => {
    expect(assertLineKey("a.b:c-d_1")).toBe("a.b:c-d_1");
    expect(assertLineKey("  task1  ")).toBe("task1");
  });
  it("rejects empty / non-string / over-length", () => {
    expectInvariant(() => assertLineKey(""), "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KEY");
    expectInvariant(() => assertLineKey(7), "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KEY");
    expectInvariant(() => assertLineKey("x".repeat(81)), "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KEY");
  });
  it("rejects disallowed characters", () => {
    expectInvariant(() => assertLineKey("a b"), "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KEY");
    expectInvariant(() => assertLineKey("a/b"), "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KEY");
  });
});

describe("assertSortOrder", () => {
  it("accepts non-negative integers", () => {
    expect(assertSortOrder(0)).toBe(0);
    expect(assertSortOrder(7)).toBe(7);
  });
  it("rejects non-integers and negatives", () => {
    expectInvariant(() => assertSortOrder(1.5), "QUOTE_LOCAL_PACKET_ITEM_INVALID_SORT_ORDER");
    expectInvariant(() => assertSortOrder(-1), "QUOTE_LOCAL_PACKET_ITEM_INVALID_SORT_ORDER");
    expectInvariant(() => assertSortOrder("0"), "QUOTE_LOCAL_PACKET_ITEM_INVALID_SORT_ORDER");
  });
});

describe("assertOptionalTierCode", () => {
  it("normalizes empty/whitespace to null", () => {
    expect(assertOptionalTierCode("")).toBeNull();
    expect(assertOptionalTierCode("   ")).toBeNull();
    expect(assertOptionalTierCode(null)).toBeNull();
    expect(assertOptionalTierCode(undefined)).toBeNull();
  });
  it("trims a non-empty string", () => {
    expect(assertOptionalTierCode("  GOOD  ")).toBe("GOOD");
  });
  it("rejects non-string and over-length", () => {
    expectInvariant(() => assertOptionalTierCode(1), "QUOTE_LOCAL_PACKET_ITEM_INVALID_TIER_CODE");
    expectInvariant(() => assertOptionalTierCode("x".repeat(41)), "QUOTE_LOCAL_PACKET_ITEM_INVALID_TIER_CODE");
  });
});

describe("assertTargetNodeKey", () => {
  it("accepts and trims a non-empty string", () => {
    expect(assertTargetNodeKey("  node-1  ")).toBe("node-1");
  });
  it("rejects empty / non-string / over-length", () => {
    expectInvariant(() => assertTargetNodeKey(""), "QUOTE_LOCAL_PACKET_ITEM_INVALID_TARGET_NODE_KEY");
    expectInvariant(() => assertTargetNodeKey(null), "QUOTE_LOCAL_PACKET_ITEM_INVALID_TARGET_NODE_KEY");
    expectInvariant(() => assertTargetNodeKey("x".repeat(201)), "QUOTE_LOCAL_PACKET_ITEM_INVALID_TARGET_NODE_KEY");
  });
});

describe("assertLineKind", () => {
  it("accepts EMBEDDED and LIBRARY", () => {
    expect(assertLineKind("EMBEDDED")).toBe("EMBEDDED");
    expect(assertLineKind("LIBRARY")).toBe("LIBRARY");
  });
  it("rejects anything else", () => {
    expectInvariant(() => assertLineKind("embedded"), "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KIND");
    expectInvariant(() => assertLineKind("OTHER"), "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KIND");
    expectInvariant(() => assertLineKind(null), "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KIND");
  });
});

describe("assertOptionalEmbeddedPayload", () => {
  it("accepts null / undefined / empty object / arbitrary object", () => {
    expect(assertOptionalEmbeddedPayload(null)).toBeNull();
    expect(assertOptionalEmbeddedPayload(undefined)).toBeNull();
    expect(assertOptionalEmbeddedPayload({})).toEqual({});
    expect(assertOptionalEmbeddedPayload({ title: "X", taskKind: "INSPECT" })).toEqual({
      title: "X",
      taskKind: "INSPECT",
    });
  });
  it("rejects arrays and scalars", () => {
    expectInvariant(() => assertOptionalEmbeddedPayload([]), "QUOTE_LOCAL_PACKET_ITEM_INVALID_EMBEDDED_PAYLOAD");
    expectInvariant(() => assertOptionalEmbeddedPayload("foo"), "QUOTE_LOCAL_PACKET_ITEM_INVALID_EMBEDDED_PAYLOAD");
    expectInvariant(() => assertOptionalEmbeddedPayload(7), "QUOTE_LOCAL_PACKET_ITEM_INVALID_EMBEDDED_PAYLOAD");
  });
});

describe("assertPacketKey (interim promotion)", () => {
  it("trims and accepts a slug-like key", () => {
    expect(assertPacketKey("  roof-tear-off-v1  ")).toBe("roof-tear-off-v1");
    expect(assertPacketKey("ab")).toBe("ab");
    expect(assertPacketKey("a1")).toBe("a1");
    expect(assertPacketKey("packet-2026-04")).toBe("packet-2026-04");
  });
  it("rejects non-string", () => {
    expectInvariant(() => assertPacketKey(null), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
    expectInvariant(() => assertPacketKey(123), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
    expectInvariant(() => assertPacketKey(undefined), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
  });
  it("rejects too-short / too-long", () => {
    expectInvariant(() => assertPacketKey(""), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
    expectInvariant(() => assertPacketKey("a"), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
    expectInvariant(() => assertPacketKey("a".repeat(81)), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
  });
  it("rejects uppercase, underscores, leading/trailing hyphens, and other punctuation", () => {
    expectInvariant(() => assertPacketKey("Roof-V1"), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
    expectInvariant(() => assertPacketKey("roof_v1"), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
    expectInvariant(() => assertPacketKey("-roof"), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
    expectInvariant(() => assertPacketKey("roof-"), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
    expectInvariant(() => assertPacketKey("roof.v1"), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
    expectInvariant(() => assertPacketKey("roof v1"), "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
  });
});

describe("assertOptionalTaskDefinitionId", () => {
  it("normalizes null/undefined/empty to null", () => {
    expect(assertOptionalTaskDefinitionId(null)).toBeNull();
    expect(assertOptionalTaskDefinitionId(undefined)).toBeNull();
    expect(assertOptionalTaskDefinitionId("")).toBeNull();
    expect(assertOptionalTaskDefinitionId("   ")).toBeNull();
  });
  it("trims a non-empty string", () => {
    expect(assertOptionalTaskDefinitionId("  td_123  ")).toBe("td_123");
  });
  it("rejects non-string", () => {
    expectInvariant(() => assertOptionalTaskDefinitionId(7), "QUOTE_LOCAL_PACKET_ITEM_TASK_DEFINITION_NOT_FOUND");
  });
});
