import type { QuoteVersionScopeReadModel } from "@/server/slice1/reads/quote-version-scope";

/** Stable JSON shape for API / UI; no Prisma types leaked to clients. */
export type QuoteVersionScopeApiDto = {
  quoteVersion: {
    id: string;
    status: string;
    versionNumber: number;
    quoteId: string;
    pinnedWorkflowVersionId: string | null;
    composePreviewStalenessToken: string | null;
  };
  quote: {
    id: string;
    tenantId: string;
    flowGroupId: string;
  };
  proposalGroups: Array<{ id: string; name: string; sortOrder: number }>;
  orderedLineItems: Array<{
    id: string;
    title: string;
    sortOrder: number;
    executionMode: string;
    quantity: number;
    tierCode: string | null;
    scopePacketRevisionId: string | null;
    quoteLocalPacketId: string | null;
    scopeRevision: null | {
      id: string;
      status: string;
      scopePacketId: string;
    };
    quoteLocalPacket: null | {
      id: string;
      displayName: string;
    };
  }>;
};

export function toQuoteVersionScopeApiDto(model: QuoteVersionScopeReadModel): QuoteVersionScopeApiDto {
  return {
    quoteVersion: {
      id: model.id,
      status: model.status,
      versionNumber: model.versionNumber,
      quoteId: model.quoteId,
      pinnedWorkflowVersionId: model.pinnedWorkflowVersionId ?? null,
      composePreviewStalenessToken: model.composePreviewStalenessToken ?? null,
    },
    quote: {
      id: model.quote.id,
      tenantId: model.quote.tenantId,
      flowGroupId: model.quote.flowGroupId,
    },
    proposalGroups: model.proposalGroups.map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder,
    })),
    orderedLineItems: model.orderedLineItems.map((line) => ({
      id: line.id,
      title: line.title,
      sortOrder: line.sortOrder,
      executionMode: line.executionMode,
      quantity: line.quantity,
      tierCode: line.tierCode,
      scopePacketRevisionId: line.scopePacketRevisionId,
      quoteLocalPacketId: line.quoteLocalPacketId,
      scopeRevision: line.scopePacketRevision
        ? {
            id: line.scopePacketRevision.id,
            status: line.scopePacketRevision.status,
            scopePacketId: line.scopePacketRevision.scopePacket.id,
          }
        : null,
      quoteLocalPacket: line.quoteLocalPacket
        ? {
            id: line.quoteLocalPacket.id,
            displayName: line.quoteLocalPacket.displayName,
          }
        : null,
    })),
  };
}
