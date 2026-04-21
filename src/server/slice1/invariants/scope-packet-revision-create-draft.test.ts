import { describe, expect, it } from "vitest";
import { assertCreateDraftScopePacketRevisionPreconditions } from "./scope-packet-revision-create-draft";
import { InvariantViolationError } from "../errors";

function expectInvariant(fn: () => unknown, code: string): InvariantViolationError {
  try {
    fn();
    throw new Error("expected InvariantViolationError to be thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(InvariantViolationError);
    if (!(e instanceof InvariantViolationError)) throw e;
    expect(e.code).toBe(code);
    return e;
  }
}

describe("assertCreateDraftScopePacketRevisionPreconditions", () => {
  const baseParams = {
    scopePacketId: "pkt_1",
  };

  it("accepts source PUBLISHED + no existing DRAFT + non-empty source", () => {
    expect(() =>
      assertCreateDraftScopePacketRevisionPreconditions({
        ...baseParams,
        hasPublishedSource: true,
        hasExistingDraft: false,
        sourceTaskLineCount: 3,
      }),
    ).not.toThrow();
  });

  it("rejects when no PUBLISHED revision exists to clone from (decision pack §3)", () => {
    const err = expectInvariant(
      () =>
        assertCreateDraftScopePacketRevisionPreconditions({
          ...baseParams,
          hasPublishedSource: false,
          hasExistingDraft: false,
          sourceTaskLineCount: 0,
        }),
      "SCOPE_PACKET_REVISION_CREATE_DRAFT_NO_PUBLISHED_SOURCE",
    );
    expect(err.context).toMatchObject({ scopePacketId: "pkt_1" });
  });

  it("rejects when an existing DRAFT revision blocks the clone (decision pack §4)", () => {
    const err = expectInvariant(
      () =>
        assertCreateDraftScopePacketRevisionPreconditions({
          ...baseParams,
          hasPublishedSource: true,
          hasExistingDraft: true,
          sourceTaskLineCount: 5,
        }),
      "SCOPE_PACKET_REVISION_CREATE_DRAFT_PACKET_HAS_DRAFT",
    );
    expect(err.context).toMatchObject({ scopePacketId: "pkt_1" });
  });

  it("rejects when the source PUBLISHED revision has no PacketTaskLine rows", () => {
    expectInvariant(
      () =>
        assertCreateDraftScopePacketRevisionPreconditions({
          ...baseParams,
          hasPublishedSource: true,
          hasExistingDraft: false,
          sourceTaskLineCount: 0,
        }),
      "SCOPE_PACKET_REVISION_CREATE_DRAFT_SOURCE_HAS_NO_ITEMS",
    );
  });

  // Defense-ordering: no-source fires before existing-DRAFT (the no-source
  // failure is a stronger structural signal that the user is on the wrong
  // packet entirely; surfacing the multi-DRAFT message would be misleading).
  it("no-PUBLISHED-source check fires before existing-DRAFT check", () => {
    expectInvariant(
      () =>
        assertCreateDraftScopePacketRevisionPreconditions({
          ...baseParams,
          hasPublishedSource: false,
          hasExistingDraft: true,
          sourceTaskLineCount: 1,
        }),
      "SCOPE_PACKET_REVISION_CREATE_DRAFT_NO_PUBLISHED_SOURCE",
    );
  });

  // Defense-ordering: existing-DRAFT fires before empty-source. A stale empty
  // PUBLISHED row is a degenerate state, but if the user already has a DRAFT
  // they should resolve the multi-DRAFT first regardless.
  it("existing-DRAFT check fires before empty-source check", () => {
    expectInvariant(
      () =>
        assertCreateDraftScopePacketRevisionPreconditions({
          ...baseParams,
          hasPublishedSource: true,
          hasExistingDraft: true,
          sourceTaskLineCount: 0,
        }),
      "SCOPE_PACKET_REVISION_CREATE_DRAFT_PACKET_HAS_DRAFT",
    );
  });
});
