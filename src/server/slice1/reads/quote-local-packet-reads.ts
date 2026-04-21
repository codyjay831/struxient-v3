import type {
  PrismaClient,
  Prisma,
  QuoteLocalPacketLineKind,
  QuoteLocalPacketOrigin,
  QuoteLocalPromotionStatus,
  TaskDefinitionStatus,
} from "@prisma/client";

/**
 * Tenant-scoped reads for the QuoteLocalPacket authoring surface (DRAFT-quote workspace).
 *
 * Authoring truth lives on the QuoteVersion until SEND/freeze; runtime tasks
 * are assembled later from the frozen package. These reads are deliberately
 * narrow — only what the editor surface needs.
 *
 * Canon refs: docs/canon/05-packet-canon.md, docs/epics/15-scope-packets-epic.md.
 */

export type QuoteLocalPacketItemDto = {
  id: string;
  lineKey: string;
  sortOrder: number;
  tierCode: string | null;
  lineKind: QuoteLocalPacketLineKind;
  embeddedPayloadJson: unknown;
  taskDefinitionId: string | null;
  taskDefinition: {
    id: string;
    taskKey: string;
    displayName: string;
    status: TaskDefinitionStatus;
  } | null;
  targetNodeKey: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type QuoteLocalPacketDto = {
  id: string;
  tenantId: string;
  quoteVersionId: string;
  displayName: string;
  description: string | null;
  originType: QuoteLocalPacketOrigin;
  forkedFromScopePacketRevisionId: string | null;
  promotionStatus: QuoteLocalPromotionStatus;
  /**
   * Set when `promotionStatus = COMPLETED` after the interim one-step promotion.
   * Points to the new ScopePacket created by the promotion mutation. Null otherwise.
   */
  promotedScopePacketId: string | null;
  itemCount: number;
  pinnedByLineItemCount: number;
  createdAtIso: string;
  updatedAtIso: string;
  items: QuoteLocalPacketItemDto[];
};

const PACKET_SELECT = {
  id: true,
  tenantId: true,
  quoteVersionId: true,
  displayName: true,
  description: true,
  originType: true,
  forkedFromScopePacketRevisionId: true,
  promotionStatus: true,
  promotedScopePacketId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { items: true, lineItemsPinningThisPacket: true } },
  items: {
    orderBy: [{ sortOrder: "asc" }, { lineKey: "asc" }] as Prisma.QuoteLocalPacketItemOrderByWithRelationInput[],
    select: {
      id: true,
      lineKey: true,
      sortOrder: true,
      tierCode: true,
      lineKind: true,
      embeddedPayloadJson: true,
      taskDefinitionId: true,
      taskDefinition: {
        select: { id: true, taskKey: true, displayName: true, status: true },
      },
      targetNodeKey: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.QuoteLocalPacketSelect;

type PacketRow = Prisma.QuoteLocalPacketGetPayload<{ select: typeof PACKET_SELECT }>;

function mapItem(item: PacketRow["items"][number]): QuoteLocalPacketItemDto {
  return {
    id: item.id,
    lineKey: item.lineKey,
    sortOrder: item.sortOrder,
    tierCode: item.tierCode,
    lineKind: item.lineKind,
    embeddedPayloadJson: item.embeddedPayloadJson ?? null,
    taskDefinitionId: item.taskDefinitionId,
    taskDefinition: item.taskDefinition
      ? {
          id: item.taskDefinition.id,
          taskKey: item.taskDefinition.taskKey,
          displayName: item.taskDefinition.displayName,
          status: item.taskDefinition.status,
        }
      : null,
    targetNodeKey: item.targetNodeKey,
    createdAtIso: item.createdAt.toISOString(),
    updatedAtIso: item.updatedAt.toISOString(),
  };
}

function mapPacket(row: PacketRow): QuoteLocalPacketDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    quoteVersionId: row.quoteVersionId,
    displayName: row.displayName,
    description: row.description,
    originType: row.originType,
    forkedFromScopePacketRevisionId: row.forkedFromScopePacketRevisionId,
    promotionStatus: row.promotionStatus,
    promotedScopePacketId: row.promotedScopePacketId,
    itemCount: row._count.items,
    pinnedByLineItemCount: row._count.lineItemsPinningThisPacket,
    createdAtIso: row.createdAt.toISOString(),
    updatedAtIso: row.updatedAt.toISOString(),
    items: row.items.map(mapItem),
  };
}

/**
 * List all QuoteLocalPackets attached to a quote version (tenant-scoped).
 */
export async function listQuoteLocalPacketsForVersion(
  prisma: PrismaClient,
  params: { tenantId: string; quoteVersionId: string },
): Promise<QuoteLocalPacketDto[]> {
  const rows = await prisma.quoteLocalPacket.findMany({
    where: {
      tenantId: params.tenantId,
      quoteVersionId: params.quoteVersionId,
      quoteVersion: { quote: { tenantId: params.tenantId } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: PACKET_SELECT,
  });
  return rows.map(mapPacket);
}

/**
 * Single packet fetch (tenant-scoped). Returns null when not visible.
 */
export async function getQuoteLocalPacketForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; quoteLocalPacketId: string },
): Promise<QuoteLocalPacketDto | null> {
  const row = await prisma.quoteLocalPacket.findFirst({
    where: {
      id: params.quoteLocalPacketId,
      tenantId: params.tenantId,
      quoteVersion: { quote: { tenantId: params.tenantId } },
    },
    select: PACKET_SELECT,
  });
  return row ? mapPacket(row) : null;
}
