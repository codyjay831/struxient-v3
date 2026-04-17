import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import {
  createCommercialQuoteShellForTenant,
  type CreateCommercialQuoteShellInput,
} from "@/server/slice1/mutations/create-commercial-quote-shell";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RequestBody = {
  customerName?: unknown;
  customerId?: unknown;
  flowGroupName?: unknown;
  flowGroupId?: unknown;
  quoteNumber?: unknown;
  customerBillingAddressJson?: unknown;
  proposalGroupName?: unknown;
};

function trimId(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function trimName(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  return raw;
}

/**
 * Resolves exactly one customer strategy (name vs id) and one flow-group strategy (name vs id).
 */
function parseBody(raw: RequestBody): CreateCommercialQuoteShellInput | { error: string; code: string } {
  const customerName = trimName(raw.customerName);
  const customerId = trimId(raw.customerId);
  const flowGroupName = trimName(raw.flowGroupName);
  const flowGroupId = trimId(raw.flowGroupId);

  const hasCustomerName = customerName !== null && customerName.trim() !== "";
  const hasCustomerId = customerId !== null;
  const hasFlowGroupName = flowGroupName !== null && flowGroupName.trim() !== "";
  const hasFlowGroupId = flowGroupId !== null;

  if (hasCustomerName && hasCustomerId) {
    return {
      code: "SHELL_INPUT_CONFLICT",
      error: "Use customerName or customerId, not both.",
    };
  }
  if (hasFlowGroupName && hasFlowGroupId) {
    return {
      code: "SHELL_INPUT_CONFLICT",
      error: "Use flowGroupName or flowGroupId, not both.",
    };
  }
  if (hasFlowGroupId && !hasCustomerId) {
    return {
      code: "SHELL_INPUT_CONFLICT",
      error: "flowGroupId requires customerId so the customer strategy is explicit.",
    };
  }
  if (hasFlowGroupId && hasCustomerName) {
    return {
      code: "SHELL_INPUT_CONFLICT",
      error: "Cannot combine flowGroupId with customerName; attach the flow group with customerId.",
    };
  }

  if (!hasCustomerName && !hasCustomerId) {
    return { code: "INVALID_BODY", error: "Provide customerName (new customer) or customerId (existing customer)." };
  }
  if (!hasFlowGroupName && !hasFlowGroupId) {
    return { code: "INVALID_BODY", error: "Provide flowGroupName (new flow group) or flowGroupId (existing flow group)." };
  }

  let quoteNumber: string | null | undefined;
  if (raw.quoteNumber === undefined) {
    quoteNumber = undefined;
  } else if (raw.quoteNumber === null) {
    quoteNumber = null;
  } else if (typeof raw.quoteNumber === "string") {
    quoteNumber = raw.quoteNumber;
  } else {
    return { code: "INVALID_BODY", error: "quoteNumber must be a string or null." };
  }

  let proposalGroupName: string | null | undefined;
  if (raw.proposalGroupName === undefined) {
    proposalGroupName = undefined;
  } else if (raw.proposalGroupName === null) {
    proposalGroupName = null;
  } else if (typeof raw.proposalGroupName === "string") {
    proposalGroupName = raw.proposalGroupName;
  } else {
    return { code: "INVALID_BODY", error: "proposalGroupName must be a string or null." };
  }

  let input: CreateCommercialQuoteShellInput;

  if (hasCustomerName && hasFlowGroupName && !hasCustomerId && !hasFlowGroupId) {
    input = {
      kind: "new_customer_new_flow_group",
      customerName: customerName!.trim(),
      flowGroupName: flowGroupName!.trim(),
      quoteNumber,
      proposalGroupName,
    };
    if (raw.customerBillingAddressJson !== undefined) {
      input.customerBillingAddressJson = raw.customerBillingAddressJson as unknown;
    }
  } else if (hasCustomerId && hasFlowGroupName && !hasFlowGroupId) {
    input = {
      kind: "attach_customer_new_flow_group",
      customerId: customerId!,
      flowGroupName: flowGroupName!.trim(),
      quoteNumber,
      proposalGroupName,
    };
    if (raw.customerBillingAddressJson !== undefined) {
      return {
        code: "SHELL_INPUT_CONFLICT",
        error: "customerBillingAddressJson is only allowed when creating a new customer (customerName + flowGroupName).",
      };
    }
  } else if (hasCustomerId && hasFlowGroupId && !hasFlowGroupName && !hasCustomerName) {
    input = {
      kind: "attach_customer_attach_flow_group",
      customerId: customerId!,
      flowGroupId: flowGroupId!,
      quoteNumber,
      proposalGroupName,
    };
    if (raw.customerBillingAddressJson !== undefined) {
      return {
        code: "SHELL_INPUT_CONFLICT",
        error: "customerBillingAddressJson is only allowed when creating a new customer (customerName + flowGroupName).",
      };
    }
  } else {
    return {
      code: "SHELL_INPUT_CONFLICT",
      error: "Unsupported combination of customer and flow group fields.",
    };
  }

  return input;
}

export async function POST(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  let raw: RequestBody = {};
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      raw = (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }
  } else {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json." } },
      { status: 415 },
    );
  }

  const parsed = parseBody(raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: { code: parsed.code, message: parsed.error } }, { status: 400 });
  }

  try {
    let result: Awaited<ReturnType<typeof createCommercialQuoteShellForTenant>>;
    try {
      result = await createCommercialQuoteShellForTenant(getPrisma(), {
        tenantId: authGate.principal.tenantId,
        createdByUserId: authGate.principal.userId,
        input: parsed,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "CREATED_BY_NOT_IN_TENANT") {
        return NextResponse.json(
          { error: { code: "INVALID_ACTOR", message: "Authenticated user is not a valid actor for this tenant." } },
          { status: 400 },
        );
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const meta = e.meta as { target?: string[] } | undefined;
        const target = meta?.target?.join(",") ?? "";
        if (target.includes("quoteNumber") || target.includes("tenantId")) {
          return NextResponse.json(
            {
              error: {
                code: "QUOTE_NUMBER_TAKEN",
                message: "quoteNumber is already in use for this tenant.",
              },
            },
            { status: 409 },
          );
        }
      }
      throw e;
    }

    if (!result.ok) {
      switch (result.kind) {
        case "invalid_customer_name":
          return NextResponse.json(
            { error: { code: "INVALID_CUSTOMER_NAME", message: "customerName is required and must be 1–500 characters after trim." } },
            { status: 400 },
          );
        case "invalid_flow_group_name":
          return NextResponse.json(
            { error: { code: "INVALID_FLOW_GROUP_NAME", message: "flowGroupName is required and must be 1–200 characters after trim." } },
            { status: 400 },
          );
        case "invalid_quote_number":
          return NextResponse.json(
            { error: { code: "INVALID_QUOTE_NUMBER", message: "quoteNumber must be 1–64 characters after trim when provided." } },
            { status: 400 },
          );
        case "invalid_proposal_group_name":
          return NextResponse.json(
            {
              error: {
                code: "INVALID_PROPOSAL_GROUP_NAME",
                message: "proposalGroupName must be 1–200 characters after trim when provided.",
              },
            },
            { status: 400 },
          );
        case "invalid_billing_address_json":
          return NextResponse.json(
            {
              error: {
                code: "INVALID_BILLING_ADDRESS_JSON",
                message: "customerBillingAddressJson must be a JSON object (not an array or primitive).",
              },
            },
            { status: 400 },
          );
        case "billing_not_allowed_with_attach_customer":
          return NextResponse.json(
            {
              error: {
                code: "BILLING_JSON_ATTACH_FORBIDDEN",
                message: "customerBillingAddressJson is only allowed when creating a new customer.",
              },
            },
            { status: 400 },
          );
        case "customer_not_found":
          return NextResponse.json(
            { error: { code: "CUSTOMER_NOT_FOUND", message: "Customer not found for this tenant." } },
            { status: 404 },
          );
        case "flow_group_not_found":
          return NextResponse.json(
            { error: { code: "FLOW_GROUP_NOT_FOUND", message: "Flow group not found for this tenant." } },
            { status: 404 },
          );
        case "flow_group_customer_mismatch":
          return NextResponse.json(
            {
              error: {
                code: "FLOW_GROUP_CUSTOMER_MISMATCH",
                message: "flowGroupId does not belong to the given customerId.",
              },
            },
            { status: 400 },
          );
        case "quote_number_taken":
          return NextResponse.json(
            { error: { code: "QUOTE_NUMBER_TAKEN", message: "quoteNumber is already in use for this tenant." } },
            { status: 409 },
          );
        default: {
          const _exhaustive: never = result;
          return _exhaustive;
        }
      }
    }

    return NextResponse.json({
      data: result.data,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
