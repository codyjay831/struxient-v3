import type { PrismaClient } from "@prisma/client";
import type { QuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import { toQuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import {
  deriveScopeVersionContext,
  groupQuoteScopeLineItemsByProposalGroup,
} from "@/lib/quote-scope/quote-scope-grouping";
import { SCOPE_PACKET_LIST_LIMIT_DEFAULTS } from "@/lib/scope-packet-catalog-summary";
import {
  LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS,
  listLineItemPresetsForTenant,
  type LineItemPresetSummaryDto,
} from "@/server/slice1/reads/line-item-preset-reads";
import {
  loadLineItemExecutionPreviewsForTenant,
  type LineItemExecutionPreviewSupport,
} from "@/server/slice1/reads/line-item-execution-preview-support";
import { listQuoteLocalPacketsForVersion, type QuoteLocalPacketDto } from "@/server/slice1/reads/quote-local-packet-reads";
import { getQuoteVersionScopeReadModel } from "@/server/slice1/reads/quote-version-scope";
import {
  listScopePacketsForTenant,
  type ScopePacketSummaryDto,
} from "@/server/slice1/reads/scope-packet-catalog-reads";

type ProposalGroup = QuoteVersionScopeApiDto["proposalGroups"][number];
type LineItem = QuoteVersionScopeApiDto["orderedLineItems"][number];
type GroupingResult = ReturnType<typeof groupQuoteScopeLineItemsByProposalGroup<ProposalGroup, LineItem>>;

/** Presentation-only map for quote-local packet “Used by” labels (same as former scope page inline). */
export function buildLineItemTitlesByLocalPacketId(
  items: QuoteVersionScopeApiDto["orderedLineItems"],
): Record<string, string[]> {
  const acc = new Map<string, string[]>();
  for (const line of items) {
    if (!line.quoteLocalPacketId) continue;
    const list = acc.get(line.quoteLocalPacketId) ?? [];
    list.push(line.title);
    acc.set(line.quoteLocalPacketId, list);
  }
  return Object.fromEntries(acc);
}

export type OfficeHeadScopeAuthoringModel = {
  dto: QuoteVersionScopeApiDto;
  grouping: GroupingResult;
  versionContext: ReturnType<typeof deriveScopeVersionContext>;
  isEditableHead: boolean;
  localPackets: QuoteLocalPacketDto[];
  libraryPackets: ScopePacketSummaryDto[];
  presets: LineItemPresetSummaryDto[];
  /** Observation-only previews, or `null` when `!isEditableHead`. */
  executionPreview: LineItemExecutionPreviewSupport | null;
};

/**
 * Office head quote-version scope authoring payload for {@link ScopeEditor}.
 * Mirrors `src/app/(office)/quotes/[quoteId]/scope/page.tsx` loader sequencing
 * so workspace and scope routes cannot drift.
 */
export async function loadOfficeHeadScopeAuthoringModel(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    latestQuoteVersionId: string | null;
  },
): Promise<OfficeHeadScopeAuthoringModel | null> {
  const scopeModel = await getQuoteVersionScopeReadModel(prisma, {
    tenantId: params.tenantId,
    quoteVersionId: params.quoteVersionId,
  });

  if (!scopeModel) {
    return null;
  }

  const dto = toQuoteVersionScopeApiDto(scopeModel);
  const isLatest = params.latestQuoteVersionId === params.quoteVersionId;
  const versionContext = deriveScopeVersionContext({
    status: dto.quoteVersion.status,
    isLatest,
    versionNumber: dto.quoteVersion.versionNumber,
  });

  const isEditableHead = versionContext.kind === "latest_draft";
  const grouping = groupQuoteScopeLineItemsByProposalGroup(dto.proposalGroups, dto.orderedLineItems);

  const localPackets = isEditableHead
    ? await listQuoteLocalPacketsForVersion(prisma, {
        tenantId: params.tenantId,
        quoteVersionId: params.quoteVersionId,
      })
    : [];

  const libraryPackets = isEditableHead
    ? await listScopePacketsForTenant(prisma, {
        tenantId: params.tenantId,
        limit: SCOPE_PACKET_LIST_LIMIT_DEFAULTS.max,
      })
    : [];

  const presets = isEditableHead
    ? await listLineItemPresetsForTenant(prisma, {
        tenantId: params.tenantId,
        limit: LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS.max,
      })
    : [];

  const executionPreview = isEditableHead
    ? await loadLineItemExecutionPreviewsForTenant(prisma, {
        tenantId: params.tenantId,
        pinnedWorkflowVersionId: dto.quoteVersion.pinnedWorkflowVersionId,
        lineItems: dto.orderedLineItems.map((line) => ({
          id: line.id,
          executionMode: line.executionMode,
          scopePacketRevisionId: line.scopePacketRevisionId,
          quoteLocalPacketId: line.quoteLocalPacketId,
          scopeRevision: line.scopeRevision
            ? { id: line.scopeRevision.id, scopePacketId: line.scopeRevision.scopePacketId }
            : null,
        })),
        libraryPackets,
        localPackets,
      })
    : null;

  return {
    dto,
    grouping,
    versionContext,
    isEditableHead,
    localPackets,
    libraryPackets,
    presets,
    executionPreview,
  };
}
