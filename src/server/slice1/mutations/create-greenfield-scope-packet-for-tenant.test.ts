import { describe, it, expect } from "vitest";
import { slugPacketKeyFromDisplayName } from "./create-greenfield-scope-packet-for-tenant";

describe("slugPacketKeyFromDisplayName", () => {
  it("slugifies typical names", () => {
    expect(slugPacketKeyFromDisplayName("Standard Rough-In")).toBe("standard-rough-in");
  });

  it("falls back when name yields empty pattern", () => {
    expect(slugPacketKeyFromDisplayName("!!!")).toBe("scope-packet");
  });

  it("handles diacritics", () => {
    expect(slugPacketKeyFromDisplayName("Café Packet")).toBe("cafe-packet");
  });
});
