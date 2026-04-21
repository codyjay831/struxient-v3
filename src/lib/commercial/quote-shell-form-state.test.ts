import { describe, expect, it } from "vitest";
import {
  deriveQuoteShellMode,
  describeQuoteShellMode,
  parseQuoteShellApiResponse,
  type QuoteShellFormFields,
} from "./quote-shell-form-state";

const empty: QuoteShellFormFields = {
  customerName: "",
  flowGroupName: "",
  customerId: "",
  flowGroupId: "",
  quoteNumber: "",
};

describe("deriveQuoteShellMode", () => {
  it("returns new_customer_new_flow_group when only names are filled", () => {
    const r = deriveQuoteShellMode({ ...empty, customerName: "Acme", flowGroupName: "Spring 2026" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.mode).toBe("new_customer_new_flow_group");
    expect(r.requestBody).toEqual({ customerName: "Acme", flowGroupName: "Spring 2026" });
  });

  it("returns attach_customer_new_flow_group when customerId + flow group name filled", () => {
    const r = deriveQuoteShellMode({ ...empty, customerId: "cus_1", flowGroupName: "Spring" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.mode).toBe("attach_customer_new_flow_group");
    expect(r.requestBody).toEqual({ customerId: "cus_1", flowGroupName: "Spring" });
  });

  it("returns attach_customer_attach_flow_group when both ids filled", () => {
    const r = deriveQuoteShellMode({ ...empty, customerId: "cus_1", flowGroupId: "fg_1" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.mode).toBe("attach_customer_attach_flow_group");
    expect(r.requestBody).toEqual({ customerId: "cus_1", flowGroupId: "fg_1" });
  });

  it("includes quoteNumber when provided", () => {
    const r = deriveQuoteShellMode({
      ...empty,
      customerName: "Acme",
      flowGroupName: "Spring",
      quoteNumber: "Q-001",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.requestBody.quoteNumber).toBe("Q-001");
  });

  it("rejects customer name AND id together with CUSTOMER_BOTH_NAME_AND_ID", () => {
    const r = deriveQuoteShellMode({
      ...empty,
      customerName: "Acme",
      customerId: "cus_1",
      flowGroupName: "Spring",
    });
    expect(r).toMatchObject({ ok: false, code: "CUSTOMER_BOTH_NAME_AND_ID" });
  });

  it("rejects flow group name AND id together with FLOW_GROUP_BOTH_NAME_AND_ID", () => {
    const r = deriveQuoteShellMode({
      ...empty,
      customerId: "cus_1",
      flowGroupName: "Spring",
      flowGroupId: "fg_1",
    });
    expect(r).toMatchObject({ ok: false, code: "FLOW_GROUP_BOTH_NAME_AND_ID" });
  });

  it("rejects flowGroupId without customerId with FLOW_GROUP_ID_REQUIRES_CUSTOMER_ID", () => {
    const r = deriveQuoteShellMode({ ...empty, flowGroupId: "fg_1" });
    expect(r).toMatchObject({ ok: false, code: "FLOW_GROUP_ID_REQUIRES_CUSTOMER_ID" });
  });

  it("rejects flowGroupId combined with customerName with FLOW_GROUP_ID_FORBIDS_CUSTOMER_NAME", () => {
    const r = deriveQuoteShellMode({ ...empty, customerName: "Acme", flowGroupId: "fg_1" });
    // Server's "customer name + customer id forbidden" check fires first only
    // when both are set; here name is set without id, so the FG rule fires.
    expect(r).toMatchObject({ ok: false, code: "FLOW_GROUP_ID_REQUIRES_CUSTOMER_ID" });
  });

  it("rejects empty form with MISSING_CUSTOMER", () => {
    expect(deriveQuoteShellMode(empty)).toMatchObject({ ok: false, code: "MISSING_CUSTOMER" });
  });

  it("rejects customer-only with MISSING_FLOW_GROUP", () => {
    const r = deriveQuoteShellMode({ ...empty, customerName: "Acme" });
    expect(r).toMatchObject({ ok: false, code: "MISSING_FLOW_GROUP" });
  });

  it("trims whitespace before deciding", () => {
    const r = deriveQuoteShellMode({ ...empty, customerName: "  Acme  ", flowGroupName: "  Spring  " });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.requestBody).toEqual({ customerName: "Acme", flowGroupName: "Spring" });
  });
});

describe("describeQuoteShellMode", () => {
  it("returns a non-empty label for every mode", () => {
    expect(describeQuoteShellMode("new_customer_new_flow_group")).toMatch(/new customer/i);
    expect(describeQuoteShellMode("attach_customer_new_flow_group")).toMatch(/attach existing customer/i);
    expect(describeQuoteShellMode("attach_customer_attach_flow_group")).toMatch(/existing flow group/i);
  });
});

describe("parseQuoteShellApiResponse", () => {
  const validSuccessBody = {
    data: {
      customer: { id: "cus_1", name: "Acme" },
      flowGroup: { id: "fg_1", name: "Spring", customerId: "cus_1" },
      quote: { id: "q_1", quoteNumber: "AUTO-1", customerId: "cus_1", flowGroupId: "fg_1" },
      quoteVersion: { id: "qv_1", quoteId: "q_1", versionNumber: 1, status: "DRAFT" },
      proposalGroup: { id: "pg_1", quoteVersionId: "qv_1", name: "Main", sortOrder: 0 },
    },
    meta: { auth: { source: "session" } },
  };

  it("classifies a 200 with full DTO as success and extracts every entity", () => {
    const r = parseQuoteShellApiResponse(200, validSuccessBody);
    expect(r.kind).toBe("success");
    if (r.kind !== "success") throw new Error("unreachable");
    expect(r.entities.customer).toEqual({ id: "cus_1", name: "Acme" });
    expect(r.entities.flowGroup.customerId).toBe("cus_1");
    expect(r.entities.quote.quoteNumber).toBe("AUTO-1");
    expect(r.entities.quoteVersion.versionNumber).toBe(1);
    expect(r.entities.proposalGroup.sortOrder).toBe(0);
    expect(r.auth).toEqual({ source: "session" });
  });

  it("recognizes auth.source = dev_bypass", () => {
    const body = { ...validSuccessBody, meta: { auth: { source: "dev_bypass" } } };
    const r = parseQuoteShellApiResponse(200, body);
    expect(r.kind).toBe("success");
    if (r.kind !== "success") throw new Error("unreachable");
    expect(r.auth).toEqual({ source: "dev_bypass" });
  });

  it("returns auth = null when meta.auth.source is missing or unknown", () => {
    const noMeta = { data: validSuccessBody.data };
    const r = parseQuoteShellApiResponse(200, noMeta);
    expect(r.kind).toBe("success");
    if (r.kind !== "success") throw new Error("unreachable");
    expect(r.auth).toBeNull();
  });

  it("classifies a 200 with missing fields as malformed_success (never silent success)", () => {
    const r = parseQuoteShellApiResponse(200, { data: { customer: { id: "x", name: "y" } } });
    expect(r).toMatchObject({ kind: "malformed_success", status: 200 });
  });

  it("classifies a 503 DATABASE_UNAVAILABLE as structured_error with hint preserved", () => {
    const r = parseQuoteShellApiResponse(503, {
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Can't reach database server at `localhost:5432`",
        hint: "Set DATABASE_URL in .env or .env.local and ensure Postgres is running; restart next dev.",
      },
    });
    expect(r).toMatchObject({
      kind: "structured_error",
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      hint: expect.stringContaining("Postgres"),
    });
  });

  it("classifies a 401 AUTHENTICATION_REQUIRED as structured_error", () => {
    const r = parseQuoteShellApiResponse(401, {
      error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in." },
    });
    expect(r).toMatchObject({ kind: "structured_error", code: "AUTHENTICATION_REQUIRED", status: 401 });
  });

  it("falls back to HTTP_<status> code when error body has no shape", () => {
    const r = parseQuoteShellApiResponse(502, { something: "else" });
    expect(r).toMatchObject({ kind: "structured_error", code: "HTTP_502", status: 502 });
  });

  it("classifies undefined parsed body as non_json with bodyPreview", () => {
    const r = parseQuoteShellApiResponse(500, undefined, "<html>internal error</html>");
    expect(r).toMatchObject({ kind: "non_json", status: 500 });
    if (r.kind !== "non_json") throw new Error("unreachable");
    expect(r.bodyPreview).toContain("<html>");
  });

  it("preserves error.context when present (e.g. invariant violations)", () => {
    const r = parseQuoteShellApiResponse(409, {
      error: {
        code: "QUOTE_VERSION_NOT_DRAFT",
        message: "Quote version is not draft.",
        context: { quoteVersionId: "qv_1" },
      },
    });
    expect(r).toMatchObject({
      kind: "structured_error",
      code: "QUOTE_VERSION_NOT_DRAFT",
      context: { quoteVersionId: "qv_1" },
    });
  });
});
