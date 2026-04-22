import { describe, it, expect } from "vitest";
import { summaryForCustomerAuditPayload, titleForCustomerAuditEventType } from "./customer-audit-labels";

describe("customer-audit-labels", () => {
  it("titles known CRM events", () => {
    expect(titleForCustomerAuditEventType("CUSTOMER_NOTE_CREATED")).toContain("note");
    expect(titleForCustomerAuditEventType("CUSTOMER_CONTACT_METHOD_CHANGED")).toContain("method");
  });

  it("summarizes method payloads without leaking values", () => {
    const s = summaryForCustomerAuditPayload("CUSTOMER_CONTACT_METHOD_CHANGED", {
      action: "added",
      methodType: "EMAIL",
      methodId: "mid",
    });
    expect(s).toContain("EMAIL");
    expect(s).toContain("added");
    expect(s).not.toContain("@");
  });

  it("summarizes contact unarchive without raw PII", () => {
    const s = summaryForCustomerAuditPayload("CUSTOMER_CONTACT_UPDATED", {
      contactId: "cid",
      unarchived: true,
    });
    expect(s).toContain("restored");
  });
});
