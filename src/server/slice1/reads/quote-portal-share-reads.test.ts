import { describe, it, expect } from "vitest";
import type { QuotePortalShareDeliveryListItemDto } from "./quote-portal-share-reads";

describe("QuotePortalShareDeliveryListItemDto (Epic 56 office visibility)", () => {
  it("includes provider diagnostics fields expected by quote workspace UI", () => {
    const row: QuotePortalShareDeliveryListItemDto = {
      id: "d1",
      deliveredAtIso: "2026-01-01T00:00:00.000Z",
      deliveryMethod: "EMAIL",
      recipientDetail: "a@b.co",
      shareTokenPreview: "abcd…wxyz",
      providerStatus: "FAILED",
      providerError: "timeout",
      retryCount: 2,
      isFollowUp: false,
    };
    expect(row.providerError).toBe("timeout");
    expect(row.retryCount).toBe(2);
  });
});
