import { describe, expect, it } from "vitest";
import { assertLeadStatusTransitionAllowed } from "./lead";

describe("assertLeadStatusTransitionAllowed", () => {
  it("allows active pipeline moves", () => {
    expect(assertLeadStatusTransitionAllowed({ from: "OPEN", to: "ON_HOLD" })).toEqual({ ok: true });
    expect(assertLeadStatusTransitionAllowed({ from: "ON_HOLD", to: "OPEN" })).toEqual({ ok: true });
    expect(assertLeadStatusTransitionAllowed({ from: "OPEN", to: "NURTURE" })).toEqual({ ok: true });
  });

  it("allows OPEN to LOST and ARCHIVED", () => {
    expect(assertLeadStatusTransitionAllowed({ from: "OPEN", to: "LOST" })).toEqual({ ok: true });
    expect(assertLeadStatusTransitionAllowed({ from: "OPEN", to: "ARCHIVED" })).toEqual({ ok: true });
  });

  it("rejects setting CONVERTED via status mutation", () => {
    expect(assertLeadStatusTransitionAllowed({ from: "OPEN", to: "CONVERTED" })).toEqual({
      ok: false,
      kind: "cannot_set_converted_via_status",
    });
  });

  it("rejects leaving terminal LOST", () => {
    expect(assertLeadStatusTransitionAllowed({ from: "LOST", to: "OPEN" })).toEqual({
      ok: false,
      kind: "invalid_status_transition",
    });
  });

  it("allows same-status no-op", () => {
    expect(assertLeadStatusTransitionAllowed({ from: "LOST", to: "LOST" })).toEqual({ ok: true });
  });
});
