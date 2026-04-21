import { describe, expect, it } from "vitest";
import { assertQuoteLocalPacketItemLineKindPayload } from "./quote-local-packet-item";
import { InvariantViolationError } from "../errors";

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

describe("assertQuoteLocalPacketItemLineKindPayload", () => {
  it("LIBRARY with taskDefinitionId is valid", () => {
    expect(() =>
      assertQuoteLocalPacketItemLineKindPayload({
        lineKind: "LIBRARY",
        embeddedPayloadJson: null,
        taskDefinitionId: "td_1",
      }),
    ).not.toThrow();
  });
  it("LIBRARY without taskDefinitionId throws", () => {
    expectInvariant(
      () =>
        assertQuoteLocalPacketItemLineKindPayload({
          lineKind: "LIBRARY",
          embeddedPayloadJson: { title: "x" },
          taskDefinitionId: null,
        }),
      "QUOTE_LOCAL_PACKET_ITEM_LIBRARY_WITHOUT_DEFINITION",
    );
    expectInvariant(
      () =>
        assertQuoteLocalPacketItemLineKindPayload({
          lineKind: "LIBRARY",
          embeddedPayloadJson: null,
          taskDefinitionId: "",
        }),
      "QUOTE_LOCAL_PACKET_ITEM_LIBRARY_WITHOUT_DEFINITION",
    );
  });
  it("EMBEDDED with embeddedPayloadJson is valid", () => {
    expect(() =>
      assertQuoteLocalPacketItemLineKindPayload({
        lineKind: "EMBEDDED",
        embeddedPayloadJson: { title: "x" },
        taskDefinitionId: null,
      }),
    ).not.toThrow();
  });
  it("EMBEDDED without embeddedPayloadJson throws", () => {
    expectInvariant(
      () =>
        assertQuoteLocalPacketItemLineKindPayload({
          lineKind: "EMBEDDED",
          embeddedPayloadJson: null,
          taskDefinitionId: null,
        }),
      "QUOTE_LOCAL_PACKET_ITEM_EMBEDDED_WITHOUT_PAYLOAD",
    );
  });
});
