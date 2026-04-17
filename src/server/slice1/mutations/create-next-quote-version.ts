import { Prisma, type PrismaClient } from "@prisma/client";

/**
 * Creates the next `QuoteVersion` (always `DRAFT`) for a tenant-owned quote by cloning **draft-authoring**
 * structure from the **current head** = row with **maximum `versionNumber`** for that quote.
 *
 * **Copied:** `title`, `pinnedWorkflowVersionId`, `ProposalGroup` (name, sortOrder), `QuoteLocalPacket` (+items;
 * promotion reset to `NONE` / `promotedScopePacketId` null), `QuoteLineItem` commercial fields (including
 * `scopePacketRevisionId` when set).
 *
 * **Not copied / cleared on the new row:** `sentAt`, `sentById`, `sendClientRequestId`, compose/freeze/snapshot
 * fields, `signedAt`, `signedById`, `QuoteSignature`, `Flow`, `Activation`, `RuntimeTask`, `AuditEvent`, `PreJobTask`.
 *
 * Prior versions are **not modified**; children are **inserted** for the new version only.
 */
export type CreateNextQuoteVersionSuccessDto = {
  quoteVersionId: string;
  versionNumber: number;
  proposalGroups: { id: string; name: string; sortOrder: number }[];
};

export type CreateNextQuoteVersionResult =
  | { ok: true; data: CreateNextQuoteVersionSuccessDto }
  | { ok: false; kind: "quote_not_found" }
  | { ok: false; kind: "no_source_version" }
  | { ok: false; kind: "version_number_conflict" };

export async function createNextQuoteVersionForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; quoteId: string; createdByUserId: string },
): Promise<CreateNextQuoteVersionResult> {
  try {
    return await prisma.$transaction(async (tx): Promise<CreateNextQuoteVersionResult> => {
      const quote = await tx.quote.findFirst({
        where: { id: params.quoteId, tenantId: params.tenantId },
        select: { id: true },
      });
      if (!quote) {
        return { ok: false, kind: "quote_not_found" };
      }

      const actor = await tx.user.findFirst({
        where: { id: params.createdByUserId, tenantId: params.tenantId },
        select: { id: true },
      });
      if (!actor) {
        throw new Error("CREATED_BY_NOT_IN_TENANT");
      }

      const agg = await tx.quoteVersion.aggregate({
        where: { quoteId: quote.id },
        _max: { versionNumber: true },
      });
      const maxNum = agg._max.versionNumber;
      if (maxNum == null) {
        return { ok: false, kind: "no_source_version" };
      }

      const source = await tx.quoteVersion.findFirst({
        where: { quoteId: quote.id, versionNumber: maxNum },
        select: {
          id: true,
          title: true,
          pinnedWorkflowVersionId: true,
          proposalGroups: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, sortOrder: true },
          },
          quoteLocalPackets: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              tenantId: true,
              displayName: true,
              description: true,
              originType: true,
              forkedFromScopePacketRevisionId: true,
              aiProvenanceJson: true,
              items: {
                orderBy: { sortOrder: "asc" },
                select: {
                  lineKey: true,
                  sortOrder: true,
                  tierCode: true,
                  lineKind: true,
                  embeddedPayloadJson: true,
                  taskDefinitionId: true,
                  targetNodeKey: true,
                },
              },
            },
          },
          quoteLineItems: {
            orderBy: { sortOrder: "asc" },
            select: {
              proposalGroupId: true,
              sortOrder: true,
              scopePacketRevisionId: true,
              quoteLocalPacketId: true,
              tierCode: true,
              quantity: true,
              executionMode: true,
              title: true,
              description: true,
              unitPriceCents: true,
              lineTotalCents: true,
            },
          },
        },
      });
      if (!source) {
        return { ok: false, kind: "no_source_version" };
      }

      const nextVersionNumber = maxNum + 1;

      const newVersion = await tx.quoteVersion.create({
        data: {
          quoteId: quote.id,
          versionNumber: nextVersionNumber,
          status: "DRAFT",
          title: source.title,
          pinnedWorkflowVersionId: source.pinnedWorkflowVersionId,
          createdById: actor.id,
        },
        select: { id: true, versionNumber: true },
      });

      const proposalGroupIdMap = new Map<string, string>();
      const createdProposalSummaries: { id: string; name: string; sortOrder: number }[] = [];

      for (const pg of source.proposalGroups) {
        const created = await tx.proposalGroup.create({
          data: {
            quoteVersionId: newVersion.id,
            name: pg.name,
            sortOrder: pg.sortOrder,
          },
          select: { id: true, name: true, sortOrder: true },
        });
        proposalGroupIdMap.set(pg.id, created.id);
        createdProposalSummaries.push(created);
      }

      const packetIdMap = new Map<string, string>();

      for (const pkt of source.quoteLocalPackets) {
        const newPkt = await tx.quoteLocalPacket.create({
          data: {
            tenantId: pkt.tenantId,
            quoteVersionId: newVersion.id,
            displayName: pkt.displayName,
            description: pkt.description ?? undefined,
            originType: pkt.originType,
            forkedFromScopePacketRevisionId: pkt.forkedFromScopePacketRevisionId,
            ...(pkt.aiProvenanceJson != null ? { aiProvenanceJson: pkt.aiProvenanceJson } : {}),
            promotionStatus: "NONE",
            promotedScopePacketId: null,
            createdById: actor.id,
            updatedById: null,
          },
          select: { id: true },
        });
        packetIdMap.set(pkt.id, newPkt.id);

        for (const it of pkt.items) {
          await tx.quoteLocalPacketItem.create({
            data: {
              quoteLocalPacketId: newPkt.id,
              lineKey: it.lineKey,
              sortOrder: it.sortOrder,
              tierCode: it.tierCode,
              lineKind: it.lineKind,
              ...(it.embeddedPayloadJson != null ? { embeddedPayloadJson: it.embeddedPayloadJson } : {}),
              taskDefinitionId: it.taskDefinitionId,
              targetNodeKey: it.targetNodeKey,
            },
          });
        }
      }

      for (const line of source.quoteLineItems) {
        const newPgId = proposalGroupIdMap.get(line.proposalGroupId);
        if (!newPgId) {
          throw new Error("[Struxient] Cloned line references unknown proposal group id");
        }
        const newLocalId =
          line.quoteLocalPacketId == null ? null : (packetIdMap.get(line.quoteLocalPacketId) ?? null);
        if (line.quoteLocalPacketId != null && newLocalId == null) {
          throw new Error("[Struxient] Cloned line references unknown quote-local packet id");
        }

        await tx.quoteLineItem.create({
          data: {
            quoteVersionId: newVersion.id,
            proposalGroupId: newPgId,
            sortOrder: line.sortOrder,
            scopePacketRevisionId: line.scopePacketRevisionId,
            quoteLocalPacketId: newLocalId,
            tierCode: line.tierCode,
            quantity: line.quantity,
            executionMode: line.executionMode,
            title: line.title,
            description: line.description,
            unitPriceCents: line.unitPriceCents,
            lineTotalCents: line.lineTotalCents,
          },
        });
      }

      return {
        ok: true,
        data: {
          quoteVersionId: newVersion.id,
          versionNumber: newVersion.versionNumber,
          proposalGroups: createdProposalSummaries,
        },
      };
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CREATED_BY_NOT_IN_TENANT") {
      throw e;
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const meta = e.meta as { target?: string[] } | undefined;
      const target = meta?.target?.join(",") ?? "";
      if (target.includes("quoteId") || target.includes("versionNumber") || target.includes("sendClientRequestId")) {
        return { ok: false, kind: "version_number_conflict" };
      }
    }
    throw e;
  }
}
