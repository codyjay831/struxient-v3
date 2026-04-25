import type { PrismaClient } from "@prisma/client";
import {
  parseCompletionRequirements,
  type CompletionRequirement,
} from "@/lib/task-definition-authored-requirements";
import type { WorkflowNodeKeyProjection } from "@/lib/workflow-snapshot-node-projection";
import {
  projectLineItemExecutionPreview,
  type LibraryRevisionForPreview,
  type LineItemExecutionPreviewDto,
  type LocalPacketForPreview,
} from "@/lib/quote-line-item-execution-preview";
import {
  getScopePacketRevisionDetailForTenant,
  type ScopePacketRevisionDetailDto,
  type ScopePacketSummaryDto,
} from "./scope-packet-catalog-reads";
import type { QuoteLocalPacketDto } from "./quote-local-packet-reads";
import { getWorkflowVersionNodeKeysForTenant } from "./workflow-version-node-keys";

/**
 * Tenant-scoped server loader that gathers everything the pure
 * `projectLineItemExecutionPreview` helper needs to render a per-line
 * execution preview under each scope row (Triangle Mode, Phase 1 Slice C).
 *
 * What this loader is *not*:
 *   - It is **not** a compose-engine substitute. It does not run compose,
 *     does not produce ComposePlanRow / ComposePackageSlot rows, and does
 *     not freeze any state. It only assembles the raw read data the pure
 *     projection consumes.
 *   - It does **not** introduce any new schema, mutation, or RuntimeTask
 *     touch points. All reads target existing tenant-scoped read modules.
 *
 * Performance shape:
 *   - One workflow node-keys read (skipped if no workflow is pinned).
 *   - N revision-detail reads, where N = unique pinned `scopePacketRevisionId`s
 *     across `MANIFEST` line items (parallelized with `Promise.all`).
 *   - One batched `taskDefinition.findMany` for all referenced task
 *     definition ids (across both library and local packet items), so
 *     requirement extraction is O(1) round-trips regardless of packet count.
 */

export type LineItemForPreviewSupport = {
  id: string;
  executionMode: string;
  scopePacketRevisionId: string | null;
  quoteLocalPacketId: string | null;
  /** Required to look up a revision under its parent packet (tenant + packet + revision). */
  scopeRevision: { id: string; scopePacketId: string } | null;
};

export type LineItemExecutionPreviewSupport = {
  /**
   * Per-line preview keyed by `QuoteLineItem.id`. Every input line gets an
   * entry — `SOLD_SCOPE` lines get the commercial-only shape, MANIFEST lines
   * with no pin get `manifestNoPacket`, and pin-but-detail-missing renders
   * a diagnostic shape.
   */
  previewsByLineItemId: Record<string, LineItemExecutionPreviewDto>;
  /**
   * Workflow node-keys projection for the pinned workflow version (empty
   * when no workflow is pinned or the version is not accessible to the
   * tenant). Surfaced separately so the page can pass it down to the
   * picker variants in addition to the preview.
   */
  workflowNodeKeys: WorkflowNodeKeyProjection[];
};

/* ---------------------------------------------------------------------------- */
/* Internals                                                                     */
/* ---------------------------------------------------------------------------- */

/** Collect unique scopePacketRevisionId pinned by MANIFEST lines, paired with their parent packet ids. */
function collectLibraryRevisionRequests(
  lines: ReadonlyArray<LineItemForPreviewSupport>,
): Array<{ scopePacketId: string; scopePacketRevisionId: string }> {
  const seen = new Map<string, { scopePacketId: string; scopePacketRevisionId: string }>();
  for (const line of lines) {
    if (line.executionMode !== "MANIFEST") continue;
    if (!line.scopePacketRevisionId) continue;
    if (seen.has(line.scopePacketRevisionId)) continue;
    // The DTO carries `scopeRevision.scopePacketId`; if (defensively) null,
    // skip — without the parent id we can't satisfy the read's
    // composite-tenant gate, and the projection will report the line as
    // `manifestLibraryMissing`.
    if (!line.scopeRevision || line.scopeRevision.id !== line.scopePacketRevisionId) continue;
    seen.set(line.scopePacketRevisionId, {
      scopePacketId: line.scopeRevision.scopePacketId,
      scopePacketRevisionId: line.scopePacketRevisionId,
    });
  }
  return Array.from(seen.values());
}

/** Index library packet summaries by id so we can look up `latestPublishedRevisionId`. */
function indexLibrarySummaries(
  libraryPackets: ReadonlyArray<ScopePacketSummaryDto>,
): Map<string, ScopePacketSummaryDto> {
  const m = new Map<string, ScopePacketSummaryDto>();
  for (const p of libraryPackets) m.set(p.id, p);
  return m;
}

/**
 * Adapter from the read DTO to the projection's structural input. Strips
 * fields the projection doesn't care about and narrows `revision.status` to
 * the canonical lifecycle states.
 */
function adaptLibraryRevision(
  detail: ScopePacketRevisionDetailDto,
): LibraryRevisionForPreview {
  return {
    packetKey: detail.packetKey,
    packetDisplayName: detail.packetDisplayName,
    revision: {
      id: detail.revision.id,
      revisionNumber: detail.revision.revisionNumber,
      status: detail.revision.status as LibraryRevisionForPreview["revision"]["status"],
    },
    packetTaskLines: detail.packetTaskLines.map((line) => ({
      lineKey: line.lineKey,
      sortOrder: line.sortOrder,
      tierCode: line.tierCode,
      targetNodeKey: line.targetNodeKey,
      taskDefinition: line.taskDefinition
        ? {
            id: line.taskDefinition.id,
            taskKey: line.taskDefinition.taskKey,
            displayName: line.taskDefinition.displayName,
            status: line.taskDefinition.status,
          }
        : null,
      embeddedPayloadJson: line.embeddedPayloadJson,
    })),
  };
}

function adaptLocalPacket(packet: QuoteLocalPacketDto): LocalPacketForPreview {
  return {
    id: packet.id,
    displayName: packet.displayName,
    items: packet.items.map((item) => ({
      lineKey: item.lineKey,
      sortOrder: item.sortOrder,
      tierCode: item.tierCode,
      targetNodeKey: item.targetNodeKey,
      taskDefinition: item.taskDefinition
        ? {
            id: item.taskDefinition.id,
            taskKey: item.taskDefinition.taskKey,
            displayName: item.taskDefinition.displayName,
            status: item.taskDefinition.status,
          }
        : null,
      embeddedPayloadJson: item.embeddedPayloadJson,
    })),
  };
}

/** Collect all unique task definition ids referenced by either library revisions or local packets. */
function collectTaskDefinitionIds(
  libraryRevisions: ReadonlyArray<LibraryRevisionForPreview>,
  localPackets: ReadonlyArray<LocalPacketForPreview>,
): string[] {
  const ids = new Set<string>();
  for (const rev of libraryRevisions) {
    for (const line of rev.packetTaskLines) {
      if (line.taskDefinition) ids.add(line.taskDefinition.id);
    }
  }
  for (const lp of localPackets) {
    for (const item of lp.items) {
      if (item.taskDefinition) ids.add(item.taskDefinition.id);
    }
  }
  return Array.from(ids);
}

/**
 * Batched fetch + parse: returns a map from `taskDefinitionId` →
 * parsed `completionRequirements`. Definitions whose JSON fails to parse
 * map to an empty array (never throws) — matches the read-side behavior
 * of `getTaskDefinitionDetailForTenant` so the inspector / preview never
 * gates on legacy-shaped data.
 */
async function loadTaskDefinitionRequirements(
  prisma: PrismaClient,
  params: { tenantId: string; ids: ReadonlyArray<string> },
): Promise<Map<string, CompletionRequirement[]>> {
  if (params.ids.length === 0) return new Map();
  const rows = await prisma.taskDefinition.findMany({
    where: { tenantId: params.tenantId, id: { in: [...params.ids] } },
    select: { id: true, completionRequirementsJson: true },
  });
  const out = new Map<string, CompletionRequirement[]>();
  for (const r of rows) {
    const parsed = parseCompletionRequirements(r.completionRequirementsJson);
    out.set(r.id, parsed.ok ? parsed.value : []);
  }
  return out;
}

/* ---------------------------------------------------------------------------- */
/* Public entry point                                                            */
/* ---------------------------------------------------------------------------- */

export async function loadLineItemExecutionPreviewsForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    pinnedWorkflowVersionId: string | null;
    lineItems: ReadonlyArray<LineItemForPreviewSupport>;
    /** Already-loaded library packet summaries (passed through from page). */
    libraryPackets: ReadonlyArray<ScopePacketSummaryDto>;
    /** Already-loaded quote-local packets for this version. */
    localPackets: ReadonlyArray<QuoteLocalPacketDto>;
  },
): Promise<LineItemExecutionPreviewSupport> {
  // 1) Workflow node keys (single small read; skip when no workflow pinned).
  const workflowNodeKeysDto = params.pinnedWorkflowVersionId
    ? await getWorkflowVersionNodeKeysForTenant(prisma, {
        tenantId: params.tenantId,
        workflowVersionId: params.pinnedWorkflowVersionId,
      })
    : null;
  const workflowNodeKeys: WorkflowNodeKeyProjection[] = workflowNodeKeysDto?.nodes ?? [];

  // 2) Library revision details — parallel fetch, then adapt.
  const revisionRequests = collectLibraryRevisionRequests(params.lineItems);
  const revisionDetailRows = await Promise.all(
    revisionRequests.map((req) =>
      getScopePacketRevisionDetailForTenant(prisma, {
        tenantId: params.tenantId,
        scopePacketId: req.scopePacketId,
        scopePacketRevisionId: req.scopePacketRevisionId,
      }),
    ),
  );
  const adaptedLibraryRevisionsById = new Map<string, LibraryRevisionForPreview>();
  for (const row of revisionDetailRows) {
    if (row) {
      adaptedLibraryRevisionsById.set(row.revision.id, adaptLibraryRevision(row));
    }
  }

  // 3) Local packets — already loaded by the page; adapt + index.
  const adaptedLocalPacketsById = new Map<string, LocalPacketForPreview>();
  for (const lp of params.localPackets) {
    adaptedLocalPacketsById.set(lp.id, adaptLocalPacket(lp));
  }

  // 4) Batched TaskDefinition requirements lookup (one round-trip).
  const taskDefIds = collectTaskDefinitionIds(
    Array.from(adaptedLibraryRevisionsById.values()),
    Array.from(adaptedLocalPacketsById.values()),
  );
  const taskDefinitionRequirementsById = await loadTaskDefinitionRequirements(prisma, {
    tenantId: params.tenantId,
    ids: taskDefIds,
  });

  // 5) Project per-line previews. Index library summaries to resolve
  //    `parentPacketLatestPublishedRevisionId` for the "is latest" flag.
  const libraryPacketsById = indexLibrarySummaries(params.libraryPackets);
  const previewsByLineItemId: Record<string, LineItemExecutionPreviewDto> = {};

  for (const line of params.lineItems) {
    const adaptedLibrary = line.scopePacketRevisionId
      ? (adaptedLibraryRevisionsById.get(line.scopePacketRevisionId) ?? null)
      : null;
    const adaptedLocal = line.quoteLocalPacketId
      ? (adaptedLocalPacketsById.get(line.quoteLocalPacketId) ?? null)
      : null;

    // For "is latest" flag: resolve the parent packet via the line's
    // `scopeRevision.scopePacketId` (durable: still correct even if the
    // line's pin is on an older revision) and look up the catalog summary
    // we already loaded. Falls back to null when the parent packet has no
    // PUBLISHED revisions.
    const parentPacketId = line.scopeRevision?.scopePacketId ?? null;
    const parentLatestId = parentPacketId
      ? (libraryPacketsById.get(parentPacketId)?.latestPublishedRevisionId ?? null)
      : null;

    previewsByLineItemId[line.id] = projectLineItemExecutionPreview({
      executionMode: line.executionMode,
      scopePacketRevisionId: line.scopePacketRevisionId,
      quoteLocalPacketId: line.quoteLocalPacketId,
      libraryRevision: adaptedLibrary,
      localPacket: adaptedLocal,
      parentPacketLatestPublishedRevisionId: parentLatestId,
      workflowNodeKeys,
      taskDefinitionRequirementsById,
    });
  }

  return { previewsByLineItemId, workflowNodeKeys };
}
