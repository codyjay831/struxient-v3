import { describe, expect, it } from "vitest";
import {
  assertScopePacketRevisionForkPreconditions,
  type AssertScopePacketRevisionForkPreconditionsParams,
} from "./scope-packet-revision-fork";
import { InvariantViolationError } from "../errors";

/**
 * Locks the source-side preflight gates for the interim quote-local
 * fork-from-PUBLISHED-revision flow. Tenant ownership is not covered here —
 * the orchestrating mutation handles it as a load-side filter (404).
 *
 * Canon refs:
 *   docs/canon/05-packet-canon.md §100-101 (mandatory fork on task mutation)
 *   docs/bridge-decisions/03-packet-fork-promotion-decision.md
 */

function baseParams(
  overrides?: Partial<AssertScopePacketRevisionForkPreconditionsParams>,
): AssertScopePacketRevisionForkPreconditionsParams {
  return {
    scopePacketId: "sp_1",
    scopePacketRevisionId: "spr_1",
    currentStatus: "PUBLISHED",
    packetTaskLineCount: 3,
    ...overrides,
  };
}

describe("assertScopePacketRevisionForkPreconditions", () => {
  it("happy path: PUBLISHED + non-empty packet task lines passes", () => {
    expect(() => assertScopePacketRevisionForkPreconditions(baseParams())).not.toThrow();
  });

  it("rejects DRAFT source with SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED (409)", () => {
    let caught: unknown;
    try {
      assertScopePacketRevisionForkPreconditions(baseParams({ currentStatus: "DRAFT" }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InvariantViolationError);
    const err = caught as InvariantViolationError;
    expect(err.code).toBe("SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED");
    expect(err.context).toMatchObject({
      scopePacketId: "sp_1",
      scopePacketRevisionId: "spr_1",
      currentStatus: "DRAFT",
    });
  });

  it("rejects empty source with SCOPE_PACKET_REVISION_FORK_SOURCE_HAS_NO_ITEMS (400)", () => {
    let caught: unknown;
    try {
      assertScopePacketRevisionForkPreconditions(baseParams({ packetTaskLineCount: 0 }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InvariantViolationError);
    const err = caught as InvariantViolationError;
    expect(err.code).toBe("SCOPE_PACKET_REVISION_FORK_SOURCE_HAS_NO_ITEMS");
    expect(err.context).toMatchObject({
      scopePacketId: "sp_1",
      scopePacketRevisionId: "spr_1",
    });
  });

  it("status check fires before empty check (canon-blessed gate ordering)", () => {
    let caught: unknown;
    try {
      assertScopePacketRevisionForkPreconditions(
        baseParams({ currentStatus: "DRAFT", packetTaskLineCount: 0 }),
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InvariantViolationError);
    expect((caught as InvariantViolationError).code).toBe(
      "SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED",
    );
  });
});
