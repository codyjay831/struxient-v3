/**
 * Pure helpers for any quote-shell creation surface (dev or office).
 *
 * Two responsibilities:
 *
 *   1. `deriveQuoteShellMode` — given the raw form fields, decide which of the
 *      three canon-defined input strategies the user has selected, OR surface a
 *      preflight conflict. Mirrors the server-side decision tree in
 *      `src/app/api/commercial/quote-shell/route.ts#parseBody`. Tests in this
 *      file lock the UI ↔ server agreement.
 *
 *   2. `parseQuoteShellApiResponse` — given an HTTP status and parsed JSON body,
 *      classify the response into success/error/non-JSON shapes that the page
 *      can render unambiguously. No silent `{}` paths.
 *
 * Both helpers are pure (no React, no fetch) so any caller stays thin and the
 * contract is verifiable in unit tests. Lives under `src/lib/commercial/` so
 * that office surfaces can consume them without importing from `/dev/...`.
 */

export type QuoteShellFormFields = {
  customerName: string;
  flowGroupName: string;
  customerId: string;
  flowGroupId: string;
  quoteNumber: string;
};

export type QuoteShellMode =
  | "new_customer_new_flow_group"
  | "attach_customer_new_flow_group"
  | "attach_customer_attach_flow_group";

export type QuoteShellModePreflight =
  | { ok: true; mode: QuoteShellMode; requestBody: Record<string, unknown> }
  | {
      ok: false;
      code:
        | "CUSTOMER_BOTH_NAME_AND_ID"
        | "FLOW_GROUP_BOTH_NAME_AND_ID"
        | "FLOW_GROUP_ID_REQUIRES_CUSTOMER_ID"
        | "FLOW_GROUP_ID_FORBIDS_CUSTOMER_NAME"
        | "MISSING_CUSTOMER"
        | "MISSING_FLOW_GROUP";
      message: string;
    };

/**
 * Decide which input strategy the form represents, mirroring the server's
 * `parseBody` exactly. Returns the request body that should be POSTed when ok.
 */
export function deriveQuoteShellMode(fields: QuoteShellFormFields): QuoteShellModePreflight {
  const customerName = fields.customerName.trim();
  const flowGroupName = fields.flowGroupName.trim();
  const customerId = fields.customerId.trim();
  const flowGroupId = fields.flowGroupId.trim();
  const quoteNumber = fields.quoteNumber.trim();

  const hasCustomerName = customerName.length > 0;
  const hasCustomerId = customerId.length > 0;
  const hasFlowGroupName = flowGroupName.length > 0;
  const hasFlowGroupId = flowGroupId.length > 0;

  if (hasCustomerName && hasCustomerId) {
    return {
      ok: false,
      code: "CUSTOMER_BOTH_NAME_AND_ID",
      message: "Use customer name OR customerId, not both.",
    };
  }
  if (hasFlowGroupName && hasFlowGroupId) {
    return {
      ok: false,
      code: "FLOW_GROUP_BOTH_NAME_AND_ID",
      message: "Use flow group name OR flowGroupId, not both.",
    };
  }
  if (hasFlowGroupId && !hasCustomerId) {
    return {
      ok: false,
      code: "FLOW_GROUP_ID_REQUIRES_CUSTOMER_ID",
      message: "flowGroupId requires customerId so the customer strategy is explicit.",
    };
  }
  if (hasFlowGroupId && hasCustomerName) {
    return {
      ok: false,
      code: "FLOW_GROUP_ID_FORBIDS_CUSTOMER_NAME",
      message: "Cannot combine flowGroupId with a new customer name; attach via customerId.",
    };
  }
  if (!hasCustomerName && !hasCustomerId) {
    return {
      ok: false,
      code: "MISSING_CUSTOMER",
      message: "Provide a customer name (new) or customerId (existing).",
    };
  }
  if (!hasFlowGroupName && !hasFlowGroupId) {
    return {
      ok: false,
      code: "MISSING_FLOW_GROUP",
      message: "Provide a flow group name (new) or flowGroupId (existing).",
    };
  }

  const requestBody: Record<string, unknown> = {};
  let mode: QuoteShellMode;

  if (hasCustomerName && hasFlowGroupName && !hasCustomerId && !hasFlowGroupId) {
    mode = "new_customer_new_flow_group";
    requestBody.customerName = customerName;
    requestBody.flowGroupName = flowGroupName;
  } else if (hasCustomerId && hasFlowGroupName && !hasFlowGroupId) {
    mode = "attach_customer_new_flow_group";
    requestBody.customerId = customerId;
    requestBody.flowGroupName = flowGroupName;
  } else if (hasCustomerId && hasFlowGroupId && !hasCustomerName && !hasFlowGroupName) {
    mode = "attach_customer_attach_flow_group";
    requestBody.customerId = customerId;
    requestBody.flowGroupId = flowGroupId;
  } else {
    return {
      ok: false,
      code: "MISSING_CUSTOMER",
      message: "Unsupported combination of customer and flow group fields.",
    };
  }

  if (quoteNumber.length > 0) requestBody.quoteNumber = quoteNumber;

  return { ok: true, mode, requestBody };
}

/**
 * Human-friendly label for each mode — used as a "this is what will happen"
 * hint above the submit button.
 */
export function describeQuoteShellMode(mode: QuoteShellMode): string {
  switch (mode) {
    case "new_customer_new_flow_group":
      return "Create new customer + new flow group + new quote shell.";
    case "attach_customer_new_flow_group":
      return "Attach existing customer + create new flow group + new quote shell.";
    case "attach_customer_attach_flow_group":
      return "Attach existing customer + existing flow group + new quote shell.";
  }
}

/* ---------------- API response classification ---------------- */

export type QuoteShellEntityIds = {
  customer: { id: string; name: string };
  flowGroup: { id: string; name: string; customerId: string };
  quote: { id: string; quoteNumber: string; customerId: string; flowGroupId: string };
  quoteVersion: { id: string; quoteId: string; versionNumber: number; status: string };
  proposalGroup: { id: string; quoteVersionId: string; name: string; sortOrder: number };
};

export type QuoteShellAuthMeta = { source: "session" | "dev_bypass" } | null;

export type QuoteShellApiOutcome =
  | {
      kind: "success";
      status: number;
      entities: QuoteShellEntityIds;
      auth: QuoteShellAuthMeta;
    }
  | {
      kind: "structured_error";
      status: number;
      code: string;
      message: string;
      hint?: string;
      context?: unknown;
    }
  | {
      kind: "non_json";
      status: number;
      bodyPreview: string;
    }
  | {
      kind: "malformed_success";
      status: number;
      reason: string;
    };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Classify a `POST /api/commercial/quote-shell` response. The page renders
 * each `kind` differently — none of them are silent. `non_json` is reserved
 * for the (now-impossible) case where the helper from the previous fix
 * pass is bypassed and the server emits a non-JSON body anyway; we still
 * surface it explicitly rather than render `{}`.
 */
export function parseQuoteShellApiResponse(
  status: number,
  parsedJson: unknown,
  rawTextFallback?: string,
): QuoteShellApiOutcome {
  if (parsedJson === undefined) {
    const preview = (rawTextFallback ?? "").slice(0, 200);
    return { kind: "non_json", status, bodyPreview: preview };
  }

  if (status >= 200 && status < 300) {
    if (!isObject(parsedJson) || !isObject(parsedJson.data)) {
      return { kind: "malformed_success", status, reason: "Missing `data` object." };
    }
    const data = parsedJson.data;
    const customer = data.customer;
    const flowGroup = data.flowGroup;
    const quote = data.quote;
    const quoteVersion = data.quoteVersion;
    const proposalGroup = data.proposalGroup;

    if (
      !isObject(customer) ||
      !isObject(flowGroup) ||
      !isObject(quote) ||
      !isObject(quoteVersion) ||
      !isObject(proposalGroup)
    ) {
      return { kind: "malformed_success", status, reason: "Missing one or more entity blocks." };
    }

    const customerId = asString(customer.id);
    const customerName = asString(customer.name);
    const flowGroupId = asString(flowGroup.id);
    const flowGroupName = asString(flowGroup.name);
    const flowGroupCustomerId = asString(flowGroup.customerId);
    const quoteId = asString(quote.id);
    const quoteNumber = asString(quote.quoteNumber);
    const quoteCustomerId = asString(quote.customerId);
    const quoteFlowGroupId = asString(quote.flowGroupId);
    const quoteVersionId = asString(quoteVersion.id);
    const quoteVersionQuoteId = asString(quoteVersion.quoteId);
    const versionNumber = asNumber(quoteVersion.versionNumber);
    const versionStatus = asString(quoteVersion.status);
    const proposalGroupId = asString(proposalGroup.id);
    const proposalGroupQuoteVersionId = asString(proposalGroup.quoteVersionId);
    const proposalGroupName = asString(proposalGroup.name);
    const sortOrder = asNumber(proposalGroup.sortOrder);

    if (
      customerId === null ||
      customerName === null ||
      flowGroupId === null ||
      flowGroupName === null ||
      flowGroupCustomerId === null ||
      quoteId === null ||
      quoteNumber === null ||
      quoteCustomerId === null ||
      quoteFlowGroupId === null ||
      quoteVersionId === null ||
      quoteVersionQuoteId === null ||
      versionNumber === null ||
      versionStatus === null ||
      proposalGroupId === null ||
      proposalGroupQuoteVersionId === null ||
      proposalGroupName === null ||
      sortOrder === null
    ) {
      return { kind: "malformed_success", status, reason: "Entity field type mismatch." };
    }

    let auth: QuoteShellAuthMeta = null;
    if (isObject(parsedJson.meta) && isObject(parsedJson.meta.auth)) {
      const src = asString(parsedJson.meta.auth.source);
      if (src === "session" || src === "dev_bypass") {
        auth = { source: src };
      }
    }

    return {
      kind: "success",
      status,
      auth,
      entities: {
        customer: { id: customerId, name: customerName },
        flowGroup: { id: flowGroupId, name: flowGroupName, customerId: flowGroupCustomerId },
        quote: {
          id: quoteId,
          quoteNumber,
          customerId: quoteCustomerId,
          flowGroupId: quoteFlowGroupId,
        },
        quoteVersion: {
          id: quoteVersionId,
          quoteId: quoteVersionQuoteId,
          versionNumber,
          status: versionStatus,
        },
        proposalGroup: {
          id: proposalGroupId,
          quoteVersionId: proposalGroupQuoteVersionId,
          name: proposalGroupName,
          sortOrder,
        },
      },
    };
  }

  if (isObject(parsedJson) && isObject(parsedJson.error)) {
    const code = asString(parsedJson.error.code) ?? `HTTP_${status}`;
    const message = asString(parsedJson.error.message) ?? `Request failed with HTTP ${status}.`;
    const hint = asString(parsedJson.error.hint) ?? undefined;
    const context = parsedJson.error.context;
    const out: Extract<QuoteShellApiOutcome, { kind: "structured_error" }> = {
      kind: "structured_error",
      status,
      code,
      message,
    };
    if (hint !== undefined) out.hint = hint;
    if (context !== undefined) out.context = context;
    return out;
  }

  return {
    kind: "structured_error",
    status,
    code: `HTTP_${status}`,
    message: `Request failed with HTTP ${status} and no structured error body.`,
  };
}
