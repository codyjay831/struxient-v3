import type {
  PacketTaskLineKind,
  Prisma,
  PrismaClient,
  ScopePacketRevisionStatus,
  TaskDefinitionStatus,
} from "@prisma/client";
import { summarizeScopePacketRevisions } from "@/lib/scope-packet-catalog-summary";
import {
  evaluateScopePacketRevisionReadiness,
  type ScopePacketRevisionReadinessResult,
} from "@/lib/scope-packet-revision-readiness";

/**
 * Tenant-scoped READ-ONLY catalog packet inspector reads.
 *
 * Surfaces ScopePacket / ScopePacketRevision / PacketTaskLine for the office
 * dev inspector at /dev/catalog-packets. NEVER mutates rows. Does NOT support
 * authoring, promotion, PacketTier, or any catalog-management semantics.
 *
 * Tenant scoping always flows through `ScopePacket.tenantId`.
 *
 * Canon refs: docs/canon/05-packet-canon.md, docs/epics/15-scope-packets-epic.md.
 */

export type ScopePacketSummaryDto = {
  id: string;
  packetKey: string;
  displayName: string;
  revisionCount: number;
  publishedRevisionCount: number;
  latestPublishedRevisionId: string | null;
  latestPublishedRevisionNumber: number | null;
  latestPublishedAtIso: string | null;
};

export type ScopePacketRevisionSummaryDto = {
  id: string;
  revisionNumber: number;
  status: ScopePacketRevisionStatus;
  /**
   * Null for DRAFT revisions produced by the interim one-step promotion flow.
   * PUBLISHED revisions still carry an ISO string. Inspector UI must handle null.
   *
   * Canon: docs/canon/05-packet-canon.md (Canon amendment — interim promotion).
   */
  publishedAtIso: string | null;
  packetTaskLineCount: number;
};

export type ScopePacketDetailDto = ScopePacketSummaryDto & {
  revisions: ScopePacketRevisionSummaryDto[];
};

export type PacketTaskLineLibraryRefDto = {
  id: string;
  taskKey: string;
  displayName: string;
  status: TaskDefinitionStatus;
};

export type PacketTaskLineDto = {
  id: string;
  lineKey: string;
  sortOrder: number;
  tierCode: string | null;
  lineKind: PacketTaskLineKind;
  taskDefinitionId: string | null;
  taskDefinition: PacketTaskLineLibraryRefDto | null;
  hasEmbeddedPayload: boolean;
  /**
   * Top-level required column added by the interim promotion canon amendment.
   * Mirrors `QuoteLocalPacketItem.targetNodeKey` (1:1 mapping). Surfaced here
   * so the read-only inspector can confirm promoted rows landed correctly.
   *
   * Canon: docs/canon/05-packet-canon.md, docs/epics/16-packet-task-lines-epic.md §16a.
   */
  targetNodeKey: string;
  /**
   * Raw embedded payload kept verbatim so the inspector can surface it without
   * re-parsing. The shape is owned by compose / authoring slices, not by this
   * read module — this DTO never interprets it.
   */
  embeddedPayloadJson: unknown;
};

export type ScopePacketRevisionDetailDto = {
  scopePacketId: string;
  packetKey: string;
  packetDisplayName: string;
  revision: {
    id: string;
    revisionNumber: number;
    status: ScopePacketRevisionStatus;
    /**
     * Null for DRAFT revisions produced by the interim one-step promotion flow.
     * PUBLISHED revisions still carry an ISO string.
     */
    publishedAtIso: string | null;
  };
  packetTaskLines: PacketTaskLineDto[];
  /**
   * Read-only publish-readiness signal grounded in canon publish gates.
   * No transition is offered here; this is observation only. A future publish
   * action / admin-review queue is expected to consume the same predicate.
   *
   * Canon: docs/canon/05-packet-canon.md, docs/epics/15-scope-packets-epic.md §16/§155,
   * docs/epics/16-packet-task-lines-epic.md §6/§81.
   */
  publishReadiness: ScopePacketRevisionReadinessResult;
};

const PACKET_LIST_SELECT = {
  id: true,
  packetKey: true,
  displayName: true,
  revisions: {
    select: {
      id: true,
      revisionNumber: true,
      status: true,
      publishedAt: true,
    },
  },
} satisfies Prisma.ScopePacketSelect;

type PacketListRow = Prisma.ScopePacketGetPayload<{ select: typeof PACKET_LIST_SELECT }>;

function mapSummary(row: PacketListRow): ScopePacketSummaryDto {
  const summary = summarizeScopePacketRevisions(row.revisions);
  return {
    id: row.id,
    packetKey: row.packetKey,
    displayName: row.displayName,
    ...summary,
  };
}

const PACKET_DETAIL_SELECT = {
  id: true,
  packetKey: true,
  displayName: true,
  revisions: {
    orderBy: [{ revisionNumber: "desc" }] as Prisma.ScopePacketRevisionOrderByWithRelationInput[],
    select: {
      id: true,
      revisionNumber: true,
      status: true,
      publishedAt: true,
      _count: { select: { packetTaskLines: true } },
    },
  },
} satisfies Prisma.ScopePacketSelect;

type PacketDetailRow = Prisma.ScopePacketGetPayload<{ select: typeof PACKET_DETAIL_SELECT }>;

const REVISION_DETAIL_SELECT = {
  id: true,
  revisionNumber: true,
  status: true,
  publishedAt: true,
  scopePacket: {
    select: { id: true, packetKey: true, displayName: true, tenantId: true },
  },
  packetTaskLines: {
    orderBy: [
      { sortOrder: "asc" },
      { lineKey: "asc" },
    ] as Prisma.PacketTaskLineOrderByWithRelationInput[],
    select: {
      id: true,
      lineKey: true,
      sortOrder: true,
      tierCode: true,
      lineKind: true,
      embeddedPayloadJson: true,
      taskDefinitionId: true,
      targetNodeKey: true,
      taskDefinition: {
        select: { id: true, taskKey: true, displayName: true, status: true },
      },
    },
  },
} satisfies Prisma.ScopePacketRevisionSelect;

type RevisionDetailRow = Prisma.ScopePacketRevisionGetPayload<{
  select: typeof REVISION_DETAIL_SELECT;
}>;

function isEmbeddedPayloadPresent(json: unknown): boolean {
  if (json === null || json === undefined) return false;
  if (typeof json !== "object") return Boolean(json);
  if (Array.isArray(json)) return json.length > 0;
  return Object.keys(json as Record<string, unknown>).length > 0;
}

/**
 * List catalog packets visible to a tenant. Returns at most `limit` rows
 * (clamped via `clampScopePacketListLimit`) ordered by `packetKey` ascending
 * for stable display.
 */
export async function listScopePacketsForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; limit: number },
): Promise<ScopePacketSummaryDto[]> {
  const rows = await prisma.scopePacket.findMany({
    where: { tenantId: params.tenantId },
    orderBy: [{ packetKey: "asc" }],
    take: params.limit,
    select: PACKET_LIST_SELECT,
  });
  return rows.map(mapSummary);
}

/**
 * Single packet detail with its full revision list (ordered newest-first by
 * revisionNumber). Returns `null` when the packet is not visible to the tenant.
 */
export async function getScopePacketDetailForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; scopePacketId: string },
): Promise<ScopePacketDetailDto | null> {
  const row: PacketDetailRow | null = await prisma.scopePacket.findFirst({
    where: { id: params.scopePacketId, tenantId: params.tenantId },
    select: PACKET_DETAIL_SELECT,
  });
  if (!row) return null;

  const summaryInputRevisions = row.revisions.map((r) => ({
    id: r.id,
    revisionNumber: r.revisionNumber,
    status: r.status,
    publishedAt: r.publishedAt,
  }));
  const summary = summarizeScopePacketRevisions(summaryInputRevisions);

  return {
    id: row.id,
    packetKey: row.packetKey,
    displayName: row.displayName,
    ...summary,
    revisions: row.revisions.map((r) => ({
      id: r.id,
      revisionNumber: r.revisionNumber,
      status: r.status,
      publishedAtIso: r.publishedAt ? r.publishedAt.toISOString() : null,
      packetTaskLineCount: r._count.packetTaskLines,
    })),
  };
}

/**
 * Single revision detail with its task lines (ordered by sortOrder then lineKey).
 * Returns `null` when the revision is not visible to the tenant or is not under
 * the supplied parent packet id.
 */
export async function getScopePacketRevisionDetailForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; scopePacketId: string; scopePacketRevisionId: string },
): Promise<ScopePacketRevisionDetailDto | null> {
  const row: RevisionDetailRow | null = await prisma.scopePacketRevision.findFirst({
    where: {
      id: params.scopePacketRevisionId,
      scopePacketId: params.scopePacketId,
      scopePacket: { tenantId: params.tenantId },
    },
    select: REVISION_DETAIL_SELECT,
  });
  if (!row) return null;

  const publishReadiness = evaluateScopePacketRevisionReadiness({
    packetTaskLines: row.packetTaskLines.map((line) => ({
      id: line.id,
      lineKey: line.lineKey,
      lineKind: line.lineKind,
      targetNodeKey: line.targetNodeKey,
      embeddedPayloadJson: line.embeddedPayloadJson,
      taskDefinitionId: line.taskDefinitionId,
      taskDefinition: line.taskDefinition
        ? { id: line.taskDefinition.id, status: line.taskDefinition.status }
        : null,
    })),
  });

  return {
    scopePacketId: row.scopePacket.id,
    packetKey: row.scopePacket.packetKey,
    packetDisplayName: row.scopePacket.displayName,
    revision: {
      id: row.id,
      revisionNumber: row.revisionNumber,
      status: row.status,
      publishedAtIso: row.publishedAt ? row.publishedAt.toISOString() : null,
    },
    packetTaskLines: row.packetTaskLines.map((line) => ({
      id: line.id,
      lineKey: line.lineKey,
      sortOrder: line.sortOrder,
      tierCode: line.tierCode,
      lineKind: line.lineKind,
      taskDefinitionId: line.taskDefinitionId,
      taskDefinition: line.taskDefinition
        ? {
            id: line.taskDefinition.id,
            taskKey: line.taskDefinition.taskKey,
            displayName: line.taskDefinition.displayName,
            status: line.taskDefinition.status,
          }
        : null,
      hasEmbeddedPayload: isEmbeddedPayloadPresent(line.embeddedPayloadJson),
      targetNodeKey: line.targetNodeKey,
      embeddedPayloadJson: line.embeddedPayloadJson ?? null,
    })),
    publishReadiness,
  };
}
