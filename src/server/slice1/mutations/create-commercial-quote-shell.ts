import type { Prisma, PrismaClient, QuoteVersionStatus } from "@prisma/client";

const MAX_CUSTOMER_NAME = 500;
const MAX_FLOW_GROUP_NAME = 200;
const MAX_QUOTE_NUMBER = 64;
const DEFAULT_PROPOSAL_GROUP_NAME = "Main";

/**
 * Exactly one customer strategy and one flow-group strategy (mutually exclusive fields).
 *
 * - **new_customer_new_flow_group:** create `Customer` + `FlowGroup`
 * - **attach_customer_new_flow_group:** reuse tenant `Customer`, create `FlowGroup`
 * - **attach_customer_attach_flow_group:** reuse tenant `Customer` + `FlowGroup` (`flowGroup.customerId` must match)
 */
export type CreateCommercialQuoteShellInput =
  | {
      kind: "new_customer_new_flow_group";
      customerName: string;
      flowGroupName: string;
      quoteNumber?: string | null;
      customerBillingAddressJson?: unknown | null;
      proposalGroupName?: string | null;
    }
  | {
      kind: "attach_customer_new_flow_group";
      customerId: string;
      flowGroupName: string;
      quoteNumber?: string | null;
      proposalGroupName?: string | null;
    }
  | {
      kind: "attach_customer_attach_flow_group";
      customerId: string;
      flowGroupId: string;
      quoteNumber?: string | null;
      proposalGroupName?: string | null;
    };

export type CommercialQuoteShellDto = {
  customer: { id: string; name: string };
  flowGroup: { id: string; name: string; customerId: string };
  quote: { id: string; quoteNumber: string; customerId: string; flowGroupId: string };
  quoteVersion: { id: string; quoteId: string; versionNumber: number; status: QuoteVersionStatus };
  proposalGroup: { id: string; quoteVersionId: string; name: string; sortOrder: number };
};

export type CreateCommercialQuoteShellResult =
  | { ok: true; data: CommercialQuoteShellDto }
  | { ok: false; kind: "invalid_customer_name" }
  | { ok: false; kind: "invalid_flow_group_name" }
  | { ok: false; kind: "invalid_quote_number" }
  | { ok: false; kind: "invalid_proposal_group_name" }
  | { ok: false; kind: "invalid_billing_address_json" }
  | { ok: false; kind: "billing_not_allowed_with_attach_customer" }
  | { ok: false; kind: "quote_number_taken" }
  | { ok: false; kind: "customer_not_found" }
  | { ok: false; kind: "flow_group_not_found" }
  | { ok: false; kind: "flow_group_customer_mismatch" };

function normalizeName(raw: string, max: number): string | null {
  const t = raw.trim();
  if (!t || t.length > max) {
    return null;
  }
  return t;
}

function normalizeQuoteNumber(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") {
    return null;
  }
  const t = raw.trim();
  if (!t || t.length > MAX_QUOTE_NUMBER) {
    return null;
  }
  return t;
}

async function allocateUniqueQuoteNumber(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = `AUTO-${Date.now().toString(36)}-${attempt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const taken = await tx.quote.findFirst({
      where: { tenantId, quoteNumber: candidate },
      select: { id: true },
    });
    if (!taken) {
      return candidate;
    }
  }
  throw new Error("[Struxient] Failed to allocate unique quoteNumber after retries");
}

type TxOutcome =
  | { kind: "quote_number_taken" }
  | { kind: "customer_not_found" }
  | { kind: "flow_group_not_found" }
  | { kind: "flow_group_customer_mismatch" }
  | {
      kind: "created";
      customer: { id: string; name: string };
      flowGroup: { id: string; name: string; customerId: string };
      quote: { id: string; quoteNumber: string; customerId: string; flowGroupId: string };
      quoteVersion: { id: string; quoteId: string; versionNumber: number; status: QuoteVersionStatus };
      proposalGroup: { id: string; quoteVersionId: string; name: string; sortOrder: number };
    };

/**
 * One transaction: (optional new Customer) + (optional new FlowGroup) + Quote + first DRAFT QuoteVersion + default ProposalGroup.
 * Attach modes validate tenant ownership and FlowGroup–Customer linkage.
 */
export async function createCommercialQuoteShellForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    createdByUserId: string;
    input: CreateCommercialQuoteShellInput;
  },
): Promise<CreateCommercialQuoteShellResult> {
  const input = params.input;

  const proposalGroupNameRaw = input.proposalGroupName;
  const proposalGroupNameResolved =
    proposalGroupNameRaw == null || proposalGroupNameRaw === ""
      ? DEFAULT_PROPOSAL_GROUP_NAME
      : normalizeName(proposalGroupNameRaw, MAX_FLOW_GROUP_NAME);
  if (!proposalGroupNameResolved) {
    return { ok: false, kind: "invalid_proposal_group_name" };
  }

  const requestedNumber = normalizeQuoteNumber(input.quoteNumber ?? null);
  if (input.quoteNumber != null && input.quoteNumber !== "" && !requestedNumber) {
    return { ok: false, kind: "invalid_quote_number" };
  }

  if (input.kind !== "new_customer_new_flow_group") {
    const billing = "customerBillingAddressJson" in input ? input.customerBillingAddressJson : undefined;
    if (billing !== undefined && billing !== null) {
      return { ok: false, kind: "billing_not_allowed_with_attach_customer" };
    }
  }

  let billingJson: object | null | undefined = undefined;
  if (input.kind === "new_customer_new_flow_group") {
    const b = input.customerBillingAddressJson;
    if (b !== undefined && b !== null) {
      if (typeof b !== "object" || Array.isArray(b)) {
        return { ok: false, kind: "invalid_billing_address_json" };
      }
      billingJson = b as object;
    }
  }

  if (input.kind === "new_customer_new_flow_group") {
    const customerName = normalizeName(input.customerName, MAX_CUSTOMER_NAME);
    if (!customerName) {
      return { ok: false, kind: "invalid_customer_name" };
    }
    const flowGroupName = normalizeName(input.flowGroupName, MAX_FLOW_GROUP_NAME);
    if (!flowGroupName) {
      return { ok: false, kind: "invalid_flow_group_name" };
    }
  } else if (input.kind === "attach_customer_new_flow_group") {
    const flowGroupName = normalizeName(input.flowGroupName, MAX_FLOW_GROUP_NAME);
    if (!flowGroupName) {
      return { ok: false, kind: "invalid_flow_group_name" };
    }
  }

  const outcome = await prisma.$transaction(async (tx): Promise<TxOutcome> => {
    const quoteNumber = requestedNumber ?? (await allocateUniqueQuoteNumber(tx, params.tenantId));

    if (requestedNumber) {
      const taken = await tx.quote.findFirst({
        where: { tenantId: params.tenantId, quoteNumber: requestedNumber },
        select: { id: true },
      });
      if (taken) {
        return { kind: "quote_number_taken" };
      }
    }

    const actor = await tx.user.findFirst({
      where: { id: params.createdByUserId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!actor) {
      throw new Error("CREATED_BY_NOT_IN_TENANT");
    }

    let customer: { id: string; name: string };
    let flowGroup: { id: string; name: string; customerId: string };

    if (input.kind === "new_customer_new_flow_group") {
      const customerName = normalizeName(input.customerName, MAX_CUSTOMER_NAME)!;
      const flowGroupName = normalizeName(input.flowGroupName, MAX_FLOW_GROUP_NAME)!;

      customer = await tx.customer.create({
        data: {
          tenantId: params.tenantId,
          name: customerName,
          ...(billingJson !== undefined ? { billingAddressJson: billingJson } : {}),
        },
        select: { id: true, name: true },
      });

      flowGroup = await tx.flowGroup.create({
        data: {
          tenantId: params.tenantId,
          customerId: customer.id,
          name: flowGroupName,
        },
        select: { id: true, name: true, customerId: true },
      });
    } else if (input.kind === "attach_customer_new_flow_group") {
      const flowGroupName = normalizeName(input.flowGroupName, MAX_FLOW_GROUP_NAME)!;

      const row = await tx.customer.findFirst({
        where: { id: input.customerId, tenantId: params.tenantId },
        select: { id: true, name: true },
      });
      if (!row) {
        return { kind: "customer_not_found" };
      }
      customer = row;

      flowGroup = await tx.flowGroup.create({
        data: {
          tenantId: params.tenantId,
          customerId: customer.id,
          name: flowGroupName,
        },
        select: { id: true, name: true, customerId: true },
      });
    } else {
      const rowC = await tx.customer.findFirst({
        where: { id: input.customerId, tenantId: params.tenantId },
        select: { id: true, name: true },
      });
      if (!rowC) {
        return { kind: "customer_not_found" };
      }
      customer = rowC;

      const rowFg = await tx.flowGroup.findFirst({
        where: { id: input.flowGroupId, tenantId: params.tenantId },
        select: { id: true, name: true, customerId: true },
      });
      if (!rowFg) {
        return { kind: "flow_group_not_found" };
      }
      if (rowFg.customerId !== customer.id) {
        return { kind: "flow_group_customer_mismatch" };
      }
      flowGroup = rowFg;
    }

    const quote = await tx.quote.create({
      data: {
        tenantId: params.tenantId,
        customerId: customer.id,
        flowGroupId: flowGroup.id,
        quoteNumber,
      },
      select: { id: true, quoteNumber: true, customerId: true, flowGroupId: true },
    });

    const quoteVersion = await tx.quoteVersion.create({
      data: {
        quoteId: quote.id,
        versionNumber: 1,
        status: "DRAFT",
        createdById: actor.id,
        title: null,
        pinnedWorkflowVersionId: null,
      },
      select: { id: true, quoteId: true, versionNumber: true, status: true },
    });

    const proposalGroup = await tx.proposalGroup.create({
      data: {
        quoteVersionId: quoteVersion.id,
        name: proposalGroupNameResolved,
        sortOrder: 0,
      },
      select: { id: true, quoteVersionId: true, name: true, sortOrder: true },
    });

    return {
      kind: "created",
      customer,
      flowGroup,
      quote,
      quoteVersion: {
        id: quoteVersion.id,
        quoteId: quoteVersion.quoteId,
        versionNumber: quoteVersion.versionNumber,
        status: quoteVersion.status,
      },
      proposalGroup,
    };
  });

  switch (outcome.kind) {
    case "quote_number_taken":
      return { ok: false, kind: "quote_number_taken" };
    case "customer_not_found":
      return { ok: false, kind: "customer_not_found" };
    case "flow_group_not_found":
      return { ok: false, kind: "flow_group_not_found" };
    case "flow_group_customer_mismatch":
      return { ok: false, kind: "flow_group_customer_mismatch" };
    case "created":
      break;
    default: {
      const _e: never = outcome;
      return _e;
    }
  }

  return {
    ok: true,
    data: {
      customer: outcome.customer,
      flowGroup: outcome.flowGroup,
      quote: outcome.quote,
      quoteVersion: outcome.quoteVersion,
      proposalGroup: outcome.proposalGroup,
    },
  };
}
