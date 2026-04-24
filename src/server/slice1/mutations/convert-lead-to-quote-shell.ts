import type { PrismaClient } from "@prisma/client";
import type { CreateCommercialQuoteShellResult } from "./create-commercial-quote-shell";
import {
  createCommercialQuoteShellInTransaction,
  precomputeCommercialQuoteShellInput,
  type CommercialQuoteShellTxInput,
} from "./create-commercial-quote-shell";

export type ConvertLeadToQuoteShellInput = {
  customerName: string;
  flowGroupName: string;
  quoteNumber?: string | null;
  proposalGroupName?: string | null;
};

type ShellErrKind = Extract<CreateCommercialQuoteShellResult, { ok: false }>["kind"];

export type ConvertLeadToQuoteShellFailKind =
  | ShellErrKind
  | "lead_not_found"
  | "lead_already_converted"
  | "lead_not_open"
  | "lead_concurrent_convert";

export type ConvertLeadToQuoteShellResult =
  | {
      ok: true;
      data: {
        leadId: string;
        customerId: string;
        flowGroupId: string;
        quoteId: string;
        quoteVersionId: string;
        quoteNumber: string;
      };
    }
  | { ok: false; kind: ConvertLeadToQuoteShellFailKind };

function mapShellTxToConvertFail(kind: ShellErrKind): ConvertLeadToQuoteShellResult {
  return { ok: false, kind };
}

/**
 * MVP convert: **new Customer + new FlowGroup** only, then canonical quote shell with `Quote.leadId`.
 * Same transaction: shell + lead CONVERTED row update (with `updateMany` guard for concurrent convert).
 */
export async function convertLeadToQuoteShellForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    actorUserId: string;
    leadId: string;
    input: ConvertLeadToQuoteShellInput;
  },
): Promise<ConvertLeadToQuoteShellResult> {
  const shellInput = {
    kind: "new_customer_new_flow_group" as const,
    customerName: params.input.customerName,
    flowGroupName: params.input.flowGroupName,
    quoteNumber: params.input.quoteNumber,
    proposalGroupName: params.input.proposalGroupName,
  };

  const pre = precomputeCommercialQuoteShellInput(shellInput);
  if (!pre.ok) {
    return mapShellTxToConvertFail(pre.outcome.kind as ShellErrKind);
  }

  return prisma.$transaction(async (tx) => {
    const leadRow = await tx.lead.findFirst({
      where: { id: params.leadId, tenantId: params.tenantId },
      select: { id: true, status: true },
    });
    if (!leadRow) {
      return { ok: false, kind: "lead_not_found" } satisfies ConvertLeadToQuoteShellResult;
    }
    if (leadRow.status === "CONVERTED") {
      return { ok: false, kind: "lead_already_converted" } satisfies ConvertLeadToQuoteShellResult;
    }
    if (leadRow.status !== "OPEN") {
      return { ok: false, kind: "lead_not_open" } satisfies ConvertLeadToQuoteShellResult;
    }

    const shellParams: CommercialQuoteShellTxInput = {
      tenantId: params.tenantId,
      createdByUserId: params.actorUserId,
      input: shellInput,
      leadId: params.leadId,
      proposalGroupNameResolved: pre.proposalGroupNameResolved,
      requestedNumber: pre.requestedNumber,
      billingJson: pre.billingJson,
    };

    const shell = await createCommercialQuoteShellInTransaction(tx, shellParams);
    if (shell.kind !== "created") {
      return mapShellTxToConvertFail(shell.kind as ShellErrKind);
    }

    const updated = await tx.lead.updateMany({
      where: { id: params.leadId, tenantId: params.tenantId, status: "OPEN" },
      data: {
        status: "CONVERTED",
        convertedAt: new Date(),
        convertedCustomerId: shell.customer.id,
        convertedFlowGroupId: shell.flowGroup.id,
      },
    });
    if (updated.count !== 1) {
      return { ok: false, kind: "lead_concurrent_convert" } satisfies ConvertLeadToQuoteShellResult;
    }

    return {
      ok: true,
      data: {
        leadId: params.leadId,
        customerId: shell.customer.id,
        flowGroupId: shell.flowGroup.id,
        quoteId: shell.quote.id,
        quoteVersionId: shell.quoteVersion.id,
        quoteNumber: shell.quote.quoteNumber,
      },
    } satisfies ConvertLeadToQuoteShellResult;
  });
}
