import { describe, expect, it } from "vitest";
import {
  assertQuoteLineItemInvariants,
  assertScopePacketRevisionIsPublishedForPin,
  assertScopePacketRevisionIsValidPinForReadModel,
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

describe("assertScopePacketRevisionIsValidPinForReadModel (read-side broadened)", () => {
  it("accepts a PUBLISHED revision", () => {
    expect(() =>
      assertScopePacketRevisionIsValidPinForReadModel({
        scopePacketRevisionId: "rev_pub",
        status: "PUBLISHED",
      }),
    ).not.toThrow();
  });

  it("accepts a SUPERSEDED revision (already-pinned historical row)", () => {
    expect(() =>
      assertScopePacketRevisionIsValidPinForReadModel({
        scopePacketRevisionId: "rev_sup",
        status: "SUPERSEDED",
      }),
    ).not.toThrow();
  });

  it("rejects a DRAFT revision with LINE_SCOPE_REVISION_PIN_INVALID_STATE (read-set excludes DRAFT)", () => {
    expectInvariant(
      () =>
        assertScopePacketRevisionIsValidPinForReadModel({
          scopePacketRevisionId: "rev_draft",
          status: "DRAFT",
        }),
      "LINE_SCOPE_REVISION_PIN_INVALID_STATE",
    );
  });

  it("read-side rejection context surfaces the offending revision id and status", () => {
    try {
      assertScopePacketRevisionIsValidPinForReadModel({
        scopePacketRevisionId: "rev_draft_ctx",
        status: "DRAFT",
        quoteLineItemId: "qli_99",
      });
      throw new Error("expected InvariantViolationError to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(InvariantViolationError);
      if (e instanceof InvariantViolationError) {
        expect(e.context).toMatchObject({
          scopePacketRevisionId: "rev_draft_ctx",
          currentStatus: "DRAFT",
          quoteLineItemId: "qli_99",
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

  // Revision-2 evolution decision pack §6: write-side rejects SUPERSEDED
  // with the existing canon error code (no new pins to a demoted revision).
  it("rejects a tenant-matched SUPERSEDED scope revision pin (write-side strict mode unchanged)", () => {
    expectInvariant(
      () =>
        assertQuoteLineItemInvariants({
          ...baseParams,
          scopePacketRevisionId: "rev_sup",
          scopePacketRevision: {
            id: "rev_sup",
            status: "SUPERSEDED",
            scopePacket: { tenantId: "tenant_a" },
          },
        }),
      "LINE_SCOPE_REVISION_NOT_PUBLISHED",
    );
  });

  // Read-side mode broadens acceptance so historical pins still resolve.
  it("read-side mode (PUBLISHED_OR_SUPERSEDED) accepts a SUPERSEDED pin", () => {
    expect(() =>
      assertQuoteLineItemInvariants({
        ...baseParams,
        scopePacketRevisionId: "rev_sup",
        scopePacketRevision: {
          id: "rev_sup",
          status: "SUPERSEDED",
          scopePacket: { tenantId: "tenant_a" },
        },
        pinAcceptance: "PUBLISHED_OR_SUPERSEDED",
      }),
    ).not.toThrow();
  });

  it("read-side mode also accepts a PUBLISHED pin (no regression)", () => {
    expect(() =>
      assertQuoteLineItemInvariants({
        ...baseParams,
        scopePacketRevisionId: "rev_pub",
        scopePacketRevision: {
          id: "rev_pub",
          status: "PUBLISHED",
          scopePacket: { tenantId: "tenant_a" },
        },
        pinAcceptance: "PUBLISHED_OR_SUPERSEDED",
      }),
    ).not.toThrow();
  });

  it("read-side mode rejects a DRAFT pin with LINE_SCOPE_REVISION_PIN_INVALID_STATE (defensive)", () => {
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
          pinAcceptance: "PUBLISHED_OR_SUPERSEDED",
        }),
      "LINE_SCOPE_REVISION_PIN_INVALID_STATE",
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
