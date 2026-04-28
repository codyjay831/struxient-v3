import { describe, expect, it } from "vitest";
import {
  mergeLocalPacketsForPicker,
  resolveFieldWorkDisplayNameForQuickCreate,
  validateOneOffWorkDisplayNameInput,
  type LocalPacketForPicker,
} from "./quote-line-item-local-packet-quick-create";

describe("validateOneOffWorkDisplayNameInput", () => {
  it("accepts a non-empty trimmed name", () => {
    const r = validateOneOffWorkDisplayNameInput("Roof tear-off");
    expect(r).toEqual({ ok: true, trimmed: "Roof tear-off" });
  });

  it("trims surrounding whitespace before accepting", () => {
    const r = validateOneOffWorkDisplayNameInput("   Custom HVAC fab   ");
    expect(r).toEqual({ ok: true, trimmed: "Custom HVAC fab" });
  });

  it("rejects empty input with a contractor-friendly hint (no enum leakage)", () => {
    const r = validateOneOffWorkDisplayNameInput("");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/short name/i);
      expect(r.message).not.toMatch(/INVARIANT/);
      expect(r.message).not.toMatch(/QUOTE_LOCAL_PACKET_/);
    }
  });

  it("rejects whitespace-only input as empty", () => {
    const r = validateOneOffWorkDisplayNameInput("       ");
    expect(r.ok).toBe(false);
  });

  it("rejects names longer than 200 characters after trim", () => {
    const tooLong = "x".repeat(201);
    const r = validateOneOffWorkDisplayNameInput(tooLong);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/200/);
    }
  });

  it("accepts names exactly at the 200-character boundary after trim", () => {
    const exactly = "x".repeat(200);
    const r = validateOneOffWorkDisplayNameInput(exactly);
    expect(r).toEqual({ ok: true, trimmed: exactly });
  });

  it("trims before length-checking (trailing whitespace does not push past the cap)", () => {
    const padded = "x".repeat(200) + "   ";
    const r = validateOneOffWorkDisplayNameInput(padded);
    expect(r.ok).toBe(true);
  });
});

describe("resolveFieldWorkDisplayNameForQuickCreate", () => {
  it("uses line title when customize is closed", () => {
    expect(
      resolveFieldWorkDisplayNameForQuickCreate({
        lineTitleTrimmed: "Roof tear-off",
        customizeOpen: false,
        customInputTrimmed: "Ignored",
      }),
    ).toBe("Roof tear-off");
  });

  it("uses custom override when customize is open and custom is non-empty", () => {
    expect(
      resolveFieldWorkDisplayNameForQuickCreate({
        lineTitleTrimmed: "Roof tear-off",
        customizeOpen: true,
        customInputTrimmed: "Custom name",
      }),
    ).toBe("Custom name");
  });

  it("falls back to line title when customize is open but custom is empty", () => {
    expect(
      resolveFieldWorkDisplayNameForQuickCreate({
        lineTitleTrimmed: "Roof tear-off",
        customizeOpen: true,
        customInputTrimmed: "",
      }),
    ).toBe("Roof tear-off");
  });

  it("returns empty when line title is empty", () => {
    expect(
      resolveFieldWorkDisplayNameForQuickCreate({
        lineTitleTrimmed: "",
        customizeOpen: false,
        customInputTrimmed: "x",
      }),
    ).toBe("");
  });
});

describe("mergeLocalPacketsForPicker", () => {
  function p(id: string, name: string, itemCount = 0): LocalPacketForPicker {
    return { id, displayName: name, itemCount };
  }

  it("returns the server list verbatim when nothing has been locally created", () => {
    const server = [p("a", "Alpha"), p("b", "Bravo")];
    const out = mergeLocalPacketsForPicker(server, []);
    expect(out).toEqual(server);
  });

  it("returns just the locally created packets when the server list is empty", () => {
    const fresh = [p("z", "Zeta")];
    const out = mergeLocalPacketsForPicker([], fresh);
    expect(out).toEqual(fresh);
  });

  it("appends locally created packets after server packets, preserving order", () => {
    const server = [p("a", "Alpha"), p("b", "Bravo")];
    const fresh = [p("y", "Yankee"), p("z", "Zeta")];
    const out = mergeLocalPacketsForPicker(server, fresh);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "y", "z"]);
  });

  it("dedupes by id and lets the server entry win the tie", () => {
    const server = [p("a", "Server-Alpha", 5)];
    const fresh = [p("a", "Local-Alpha", 0), p("c", "Charlie")];
    const out = mergeLocalPacketsForPicker(server, fresh);
    expect(out).toEqual([p("a", "Server-Alpha", 5), p("c", "Charlie")]);
  });

  it("does not mutate the input arrays", () => {
    const server = [p("a", "Alpha")];
    const fresh = [p("b", "Bravo")];
    const serverCopy = server.slice();
    const freshCopy = fresh.slice();
    mergeLocalPacketsForPicker(server, fresh);
    expect(server).toEqual(serverCopy);
    expect(fresh).toEqual(freshCopy);
  });

  it("preserves additional DTO fields the picker may not read directly", () => {
    type Extended = LocalPacketForPicker & { description: string | null };
    const server: Extended[] = [
      { id: "a", displayName: "Alpha", itemCount: 0, description: "from server" },
    ];
    const fresh: Extended[] = [
      { id: "b", displayName: "Bravo", itemCount: 0, description: null },
    ];
    const out = mergeLocalPacketsForPicker(server, fresh);
    expect(out).toEqual([...server, ...fresh]);
  });
});
