import { describe, expect, it } from "vitest";
import {
  validateScopeLineItemFormFields,
  type ScopeLineItemFormFieldsForValidation,
} from "./quote-line-item-scope-form-validation";

function base(over: Partial<ScopeLineItemFormFieldsForValidation>): ScopeLineItemFormFieldsForValidation {
  return {
    title: "Line A",
    description: "",
    quantity: "1",
    executionMode: "SOLD_SCOPE",
    manifestFieldWorkSetup: "none",
    scopePacketRevisionId: "",
    quoteLocalPacketId: "",
    unitPriceCents: "",
    paymentBeforeWork: false,
    paymentGateTitleOverride: "",
    ...over,
  };
}

describe("validateScopeLineItemFormFields", () => {
  it("rejects empty line title", () => {
    const r = validateScopeLineItemFormFields(base({ title: "" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toBe("Line title is required.");
  });

  it("rejects whitespace-only line title", () => {
    const r = validateScopeLineItemFormFields(base({ title: "   \t  " }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toBe("Line title is required.");
  });

  it("rejects line title over max length", () => {
    const r = validateScopeLineItemFormFields(base({ title: "x".repeat(501) }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/at most 500/);
  });

  it("accepts SOLD_SCOPE with no packet ids", () => {
    const r = validateScopeLineItemFormFields(base({ executionMode: "SOLD_SCOPE" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scopePacketRevisionId).toBeNull();
    expect(r.quoteLocalPacketId).toBeNull();
  });

  it("accepts MANIFEST + useSavedTaskPacket with scope id only", () => {
    const r = validateScopeLineItemFormFields(
      base({
        executionMode: "MANIFEST",
        manifestFieldWorkSetup: "useSavedTaskPacket",
        scopePacketRevisionId: "rev-1",
        quoteLocalPacketId: "",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scopePacketRevisionId).toBe("rev-1");
    expect(r.quoteLocalPacketId).toBeNull();
  });

  it("accepts MANIFEST + createNewTasks with local id only", () => {
    const r = validateScopeLineItemFormFields(
      base({
        executionMode: "MANIFEST",
        manifestFieldWorkSetup: "createNewTasks",
        scopePacketRevisionId: "",
        quoteLocalPacketId: "local-1",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scopePacketRevisionId).toBeNull();
    expect(r.quoteLocalPacketId).toBe("local-1");
  });

  it("accepts MANIFEST + startFromSavedAndCustomize with local id only", () => {
    const r = validateScopeLineItemFormFields(
      base({
        executionMode: "MANIFEST",
        manifestFieldWorkSetup: "startFromSavedAndCustomize",
        scopePacketRevisionId: "",
        quoteLocalPacketId: "local-fork",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quoteLocalPacketId).toBe("local-fork");
  });

  it("rejects MANIFEST with setup none", () => {
    const r = validateScopeLineItemFormFields(
      base({
        executionMode: "MANIFEST",
        manifestFieldWorkSetup: "none",
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message.toLowerCase()).toContain("crew work");
    expect(r.message).not.toMatch(/attach a work template/i);
  });

  it("rejects MANIFEST useSaved without scope id", () => {
    const r = validateScopeLineItemFormFields(
      base({
        executionMode: "MANIFEST",
        manifestFieldWorkSetup: "useSavedTaskPacket",
        scopePacketRevisionId: "",
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects MANIFEST createNew without local id", () => {
    const r = validateScopeLineItemFormFields(
      base({
        executionMode: "MANIFEST",
        manifestFieldWorkSetup: "createNewTasks",
        quoteLocalPacketId: "",
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message.toLowerCase()).not.toContain("one-off");
  });

  it("rejects MANIFEST customize without local id (fork not done)", () => {
    const r = validateScopeLineItemFormFields(
      base({
        executionMode: "MANIFEST",
        manifestFieldWorkSetup: "startFromSavedAndCustomize",
        quoteLocalPacketId: "",
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/copy to this quote/i);
  });

  it("rejects both scope and local ids for useSavedTaskPacket", () => {
    const r = validateScopeLineItemFormFields(
      base({
        executionMode: "MANIFEST",
        manifestFieldWorkSetup: "useSavedTaskPacket",
        scopePacketRevisionId: "rev-1",
        quoteLocalPacketId: "local-1",
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects both scope and local ids for createNewTasks", () => {
    const r = validateScopeLineItemFormFields(
      base({
        executionMode: "MANIFEST",
        manifestFieldWorkSetup: "createNewTasks",
        scopePacketRevisionId: "rev-1",
        quoteLocalPacketId: "local-1",
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message.toLowerCase()).toContain("one work source");
  });

  it("rejects stale scope id when createNewTasks is selected", () => {
    const r = validateScopeLineItemFormFields(
      base({
        executionMode: "MANIFEST",
        manifestFieldWorkSetup: "createNewTasks",
        scopePacketRevisionId: "rev-1",
        quoteLocalPacketId: "local-1",
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects quantity zero (aligned with server assertQuantity)", () => {
    const r = validateScopeLineItemFormFields(base({ quantity: "0" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/at least 1/);
  });
});
