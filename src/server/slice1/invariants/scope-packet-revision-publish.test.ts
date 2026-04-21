import { describe, expect, it } from "vitest";
import { assertScopePacketRevisionPublishPreconditions } from "./scope-packet-revision-publish";
import { InvariantViolationError } from "../errors";
import type { ScopePacketRevisionReadinessResult } from "@/lib/scope-packet-revision-readiness";

const READY: ScopePacketRevisionReadinessResult = { isReady: true, blockers: [] };
const NOT_READY: ScopePacketRevisionReadinessResult = {
  isReady: false,
  blockers: [
    {
      code: "EMBEDDED_ROW_PAYLOAD_EMPTY",
      message: "EMBEDDED task line has no inline payload.",
      lineId: "line_1",
      lineKey: "k1",
    },
  ],
};

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

describe("assertScopePacketRevisionPublishPreconditions", () => {
  const baseParams = {
    scopePacketId: "pkt_1",
    scopePacketRevisionId: "rev_1",
  };

  it("accepts DRAFT + ready", () => {
    expect(() =>
      assertScopePacketRevisionPublishPreconditions({
        ...baseParams,
        currentStatus: "DRAFT",
        readiness: READY,
      }),
    ).not.toThrow();
  });

  it("rejects PUBLISHED revision with NOT_DRAFT (re-publish refused, not no-op)", () => {
    const err = expectInvariant(
      () =>
        assertScopePacketRevisionPublishPreconditions({
          ...baseParams,
          currentStatus: "PUBLISHED",
          readiness: READY,
        }),
      "SCOPE_PACKET_REVISION_PUBLISH_NOT_DRAFT",
    );
    expect(err.context).toMatchObject({
      scopePacketId: "pkt_1",
      scopePacketRevisionId: "rev_1",
      currentStatus: "PUBLISHED",
    });
  });

  // Revision-2 evolution decision pack §11: a SUPERSEDED revision is read-only
  // and cannot be re-published. The currentStatus = DRAFT gate enforces this
  // alongside the PUBLISHED rejection above.
  it("rejects SUPERSEDED revision with NOT_DRAFT (un-supersede via re-publish forbidden)", () => {
    const err = expectInvariant(
      () =>
        assertScopePacketRevisionPublishPreconditions({
          ...baseParams,
          currentStatus: "SUPERSEDED",
          readiness: READY,
        }),
      "SCOPE_PACKET_REVISION_PUBLISH_NOT_DRAFT",
    );
    expect(err.context).toMatchObject({
      scopePacketId: "pkt_1",
      scopePacketRevisionId: "rev_1",
      currentStatus: "SUPERSEDED",
    });
  });

  it("rejects DRAFT with NOT_READY when readiness has blockers", () => {
    const err = expectInvariant(
      () =>
        assertScopePacketRevisionPublishPreconditions({
          ...baseParams,
          currentStatus: "DRAFT",
          readiness: NOT_READY,
        }),
      "SCOPE_PACKET_REVISION_PUBLISH_NOT_READY",
    );
    expect(err.context).toMatchObject({
      scopePacketId: "pkt_1",
      scopePacketRevisionId: "rev_1",
    });
    expect(Array.isArray((err.context as { blockers: unknown[] }).blockers)).toBe(true);
    expect((err.context as { blockers: unknown[] }).blockers).toHaveLength(1);
  });

  it("status check fires before readiness — re-publish of a PUBLISHED row never leaks readiness blockers", () => {
    expectInvariant(
      () =>
        assertScopePacketRevisionPublishPreconditions({
          ...baseParams,
          currentStatus: "PUBLISHED",
          readiness: NOT_READY,
        }),
      "SCOPE_PACKET_REVISION_PUBLISH_NOT_DRAFT",
    );
  });

  // Sibling-PUBLISHED rejection has been retired (revision-2 evolution decision
  // pack §5, §13). The publish writer now demotes any sibling PUBLISHED row to
  // SUPERSEDED inside the same transaction, preserving the "at most one
  // PUBLISHED revision per packet" invariant via demotion rather than refusal.
  // This assertion no longer takes a `packetHasOtherPublishedRevision` input.
});
