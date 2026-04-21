import { Prisma, type PrismaClient } from "@prisma/client";
import { InvariantViolationError } from "../errors";
import { assertQuoteLineItemInvariants } from "../invariants/quote-line-item";

/** Root client or interactive transaction client (send/freeze lock path). */
export type QuoteVersionScopeDb = PrismaClient | Prisma.TransactionClient;

/**
 * Narrow select for quote authoring / compose prep: version, quote tenant, groups, lines, scope pins.
 * Does not include snapshots (see codepack GET contract).
 */
export const quoteVersionScopeQueryArgs = Prisma.validator<Prisma.QuoteVersionDefaultArgs>()({
  select: {
    id: true,
    status: true,
    pinnedWorkflowVersionId: true,
    composePreviewStalenessToken: true,
    versionNumber: true,
    quoteId: true,
    quote: {
      select: {
        id: true,
        tenantId: true,
        flowGroupId: true,
        quoteNumber: true,
        customer: { select: { id: true, name: true } },
        flowGroup: { select: { id: true, name: true } },
      },
    },
    proposalGroups: {
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true, quoteVersionId: true },
    },
    quoteLineItems: {
      select: {
        id: true,
        quoteVersionId: true,
        proposalGroupId: true,
        sortOrder: true,
        executionMode: true,
        title: true,
        tierCode: true,
        quantity: true,
        scopePacketRevisionId: true,
        quoteLocalPacketId: true,
        proposalGroup: { select: { quoteVersionId: true } },
        scopePacketRevision: {
          select: {
            id: true,
            status: true,
            scopePacket: { select: { tenantId: true, id: true } },
          },
        },
        quoteLocalPacket: {
          select: {
            id: true,
            tenantId: true,
            quoteVersionId: true,
            displayName: true,
          },
        },
      },
    },
  },
});

export type QuoteVersionScopeView = Prisma.QuoteVersionGetPayload<typeof quoteVersionScopeQueryArgs>;

export type QuoteVersionScopeLineOrdered = QuoteVersionScopeView["quoteLineItems"][number];

export type QuoteVersionScopeReadModel = QuoteVersionScopeView & {
  /** QV-5 ordering: proposalGroup.sortOrder, then line sortOrder, then id tie-break. */
  orderedLineItems: QuoteVersionScopeLineOrdered[];
};

/**
 * Tenant-scoped read: returns null if the version does not belong to the tenant (no cross-tenant id probe).
 */
export async function getQuoteVersionScopeReadModel(
  client: QuoteVersionScopeDb,
  params: { tenantId: string; quoteVersionId: string },
): Promise<QuoteVersionScopeReadModel | null> {
  const row = await client.quoteVersion.findFirst({
    where: {
      id: params.quoteVersionId,
      quote: { tenantId: params.tenantId },
    },
    ...quoteVersionScopeQueryArgs,
  });

  if (!row) {
    return null;
  }

  assertQuoteVersionScopeViewInvariants(row);
  return attachOrderedLineItems(row);
}

/**
 * Re-run service invariants on an already-loaded view (e.g. after raw SQL or transaction boundaries).
 */
export function assertQuoteVersionScopeViewInvariants(view: QuoteVersionScopeView): void {
  const groupIds = new Set(view.proposalGroups.map((g) => g.id));

  for (const g of view.proposalGroups) {
    if (g.quoteVersionId !== view.id) {
      throw new InvariantViolationError(
        "READ_MODEL_INVARIANT_FAILURE",
        "ProposalGroup.quoteVersionId must match parent QuoteVersion.id",
        { quoteVersionId: view.id, proposalGroupId: g.id, proposalGroupQuoteVersionId: g.quoteVersionId },
      );
    }
  }

  for (const line of view.quoteLineItems) {
    if (!groupIds.has(line.proposalGroupId)) {
      throw new InvariantViolationError(
        "READ_MODEL_INVARIANT_FAILURE",
        "QuoteLineItem.proposalGroupId must reference a ProposalGroup on the same version",
        { quoteLineItemId: line.id, proposalGroupId: line.proposalGroupId },
      );
    }

    assertQuoteLineItemInvariants({
      quoteLineItemId: line.id,
      quoteVersionId: line.quoteVersionId,
      proposalGroupId: line.proposalGroupId,
      proposalGroupQuoteVersionId: line.proposalGroup.quoteVersionId,
      quoteTenantId: view.quote.tenantId,
      executionMode: line.executionMode,
      scopePacketRevisionId: line.scopePacketRevisionId,
      quoteLocalPacketId: line.quoteLocalPacketId,
      scopePacketRevision: line.scopePacketRevision,
      quoteLocalPacket: line.quoteLocalPacket,
    });
  }
}

function attachOrderedLineItems(view: QuoteVersionScopeView): QuoteVersionScopeReadModel {
  const groups = [...view.proposalGroups].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );

  const linesByGroup = new Map<string, QuoteVersionScopeLineOrdered[]>();
  for (const line of view.quoteLineItems) {
    const list = linesByGroup.get(line.proposalGroupId) ?? [];
    list.push(line);
    linesByGroup.set(line.proposalGroupId, list);
  }

  const orderedLineItems: QuoteVersionScopeLineOrdered[] = [];
  for (const g of groups) {
    const lines = linesByGroup.get(g.id) ?? [];
    lines.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    orderedLineItems.push(...lines);
  }

  return { ...view, orderedLineItems };
}
