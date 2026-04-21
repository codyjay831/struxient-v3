import { describe, expect, it } from "vitest";
import {
  assertQuoteLineItemInvariants,
  assertScopePacketRevisionIsPublishedForPin,
} from "./quote-line-item";
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

describe("assertScopePacketRevisionIsPublishedForPin", () => {
  it("accepts a PUBLISHED revision", () => {
    expect(() =>
      assertScopePacketRevisionIsPublishedForPin({
        scopePacketRevisionId: "rev_pub",
        status: "PUBLISHED",
      }),
    ).not.toThrow();
  });

  it("rejects a DRAFT revision with LINE_SCOPE_REVISION_NOT_PUBLISHED", () => {
    expectInvariant(
      () =>
        assertScopePacketRevisionIsPublishedForPin({
          scopePacketRevisionId: "rev_draft",
          status: "DRAFT",
        }),
      "LINE_SCOPE_REVISION_NOT_PUBLISHED",
    );
  });

  it("rejection context surfaces revision id and current status", () => {
    try {
      assertScopePacketRevisionIsPublishedForPin({
        scopePacketRevisionId: "rev_draft_ctx",
        status: "DRAFT",
        quoteLineItemId: "qli_42",
      });
      throw new Error("expected InvariantViolationError to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(InvariantViolationError);
      if (e instanceof InvariantViolationError) {
        expect(e.context).toMatchObject({
          scopePacketRevisionId: "rev_draft_ctx",
          currentStatus: "DRAFT",
          quoteLineItemId: "qli_42",
        });
      }
    }
  });
});

describe("assertQuoteLineItemInvariants — PUBLISHED-only pin enforcement", () => {
  const baseParams = {
    quoteVersionId: "qv_1",
    proposalGroupId: "pg_1",
    proposalGroupQuoteVersionId: "qv_1",
    quoteTenantId: "tenant_a",
    executionMode: "MANIFEST" as const,
    quoteLocalPacketId: null,
    quoteLocalPacket: null,
  };

  it("accepts a tenant-matched PUBLISHED scope revision pin", () => {
    expect(() =>
      assertQuoteLineItemInvariants({
        ...baseParams,
        scopePacketRevisionId: "rev_pub",
        scopePacketRevision: {
          id: "rev_pub",
          status: "PUBLISHED",
          scopePacket: { tenantId: "tenant_a" },
        },
      }),
    ).not.toThrow();
  });

  it("rejects a tenant-matched DRAFT scope revision pin via the shared path", () => {
    expectInvariant(
      () =>
        assertQuoteLineItemInvariants({
          ...baseParams,
          scopePacketRevisionId: "rev_draft",
          scopePacketRevision: {
            id: "rev_draft",
            status: "DRAFT",
            scopePacket: { tenantId: "tenant_a" },
          },
        }),
      "LINE_SCOPE_REVISION_NOT_PUBLISHED",
    );
  });

  it("tenant mismatch still wins over status check (defense ordering preserved)", () => {
    expectInvariant(
      () =>
        assertQuoteLineItemInvariants({
          ...baseParams,
          scopePacketRevisionId: "rev_other_tenant",
          scopePacketRevision: {
            id: "rev_other_tenant",
            status: "DRAFT",
            scopePacket: { tenantId: "tenant_b" },
          },
        }),
      "LINE_SCOPE_REVISION_TENANT_MISMATCH",
    );
  });
});
