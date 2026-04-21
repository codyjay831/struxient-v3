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

  it("accepts DRAFT + ready + no other PUBLISHED sibling", () => {
    expect(() =>
      assertScopePacketRevisionPublishPreconditions({
        ...baseParams,
        currentStatus: "DRAFT",
        readiness: READY,
        packetHasOtherPublishedRevision: false,
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
          packetHasOtherPublishedRevision: false,
        }),
      "SCOPE_PACKET_REVISION_PUBLISH_NOT_DRAFT",
    );
    expect(err.context).toMatchObject({
      scopePacketId: "pkt_1",
      scopePacketRevisionId: "rev_1",
      currentStatus: "PUBLISHED",
    });
  });

  it("rejects DRAFT with NOT_READY when readiness has blockers", () => {
    const err = expectInvariant(
      () =>
        assertScopePacketRevisionPublishPreconditions({
          ...baseParams,
          currentStatus: "DRAFT",
          readiness: NOT_READY,
          packetHasOtherPublishedRevision: false,
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

  it("rejects DRAFT + ready when a sibling PUBLISHED revision already exists", () => {
    const err = expectInvariant(
      () =>
        assertScopePacketRevisionPublishPreconditions({
          ...baseParams,
          currentStatus: "DRAFT",
          readiness: READY,
          packetHasOtherPublishedRevision: true,
        }),
      "SCOPE_PACKET_REVISION_PUBLISH_PACKET_HAS_PUBLISHED",
    );
    expect(err.context).toMatchObject({
      scopePacketId: "pkt_1",
      scopePacketRevisionId: "rev_1",
    });
  });

  it("status check fires before readiness — re-publish of a PUBLISHED row never leaks readiness blockers", () => {
    expectInvariant(
      () =>
        assertScopePacketRevisionPublishPreconditions({
          ...baseParams,
          currentStatus: "PUBLISHED",
          readiness: NOT_READY,
          packetHasOtherPublishedRevision: false,
        }),
      "SCOPE_PACKET_REVISION_PUBLISH_NOT_DRAFT",
    );
  });

  it("readiness check fires before sibling-PUBLISHED check (readiness is a stronger preflight signal)", () => {
    expectInvariant(
      () =>
        assertScopePacketRevisionPublishPreconditions({
          ...baseParams,
          currentStatus: "DRAFT",
          readiness: NOT_READY,
          packetHasOtherPublishedRevision: true,
        }),
      "SCOPE_PACKET_REVISION_PUBLISH_NOT_READY",
    );
  });
});
