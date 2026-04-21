import { Prisma, type PrismaClient } from "@prisma/client";
import { assertDisplayName } from "@/lib/quote-local-packet-input";
import { mapPacketTaskLineToQuoteLocalPacketItemCreate } from "@/lib/packet-fork-mapping";
import { assertQuoteVersionDraft } from "../invariants/quote-version";
import { assertScopePacketRevisionForkPreconditions } from "../invariants/scope-packet-revision-fork";
import { InvariantViolationError } from "../errors";
import { bumpComposePreviewStalenessToken } from "./compose-staleness";
import {
  getQuoteLocalPacketForTenant,
  type QuoteLocalPacketDto,
} from "../reads/quote-local-packet-reads";

/**
 * Interim quote-local fork from a PUBLISHED `ScopePacketRevision`.
 *
 * Canon-authorized scope (do not widen):
 *   - office_mutate-gated; tenant ownership enforced via load-side filters on
 *     BOTH the source revision (through ScopePacket.tenantId) and the target
 *     QuoteVersion (through Quote.tenantId).
 *   - Source revision must be PUBLISHED (the only canon-blessed library state;
 *     pickers per canon §159/§161 already reject DRAFT).
 *   - Source revision must have at least one PacketTaskLine (an empty fork
 *     would be indistinguishable from MANUAL_LOCAL).
 *   - Target QuoteVersion must be DRAFT (QV-4: sent versions are immutable).
 *   - Atomic deep copy in one transaction:
 *       * one new QuoteLocalPacket row with originType = FORK_FROM_LIBRARY,
 *         forkedFromScopePacketRevisionId set, promotionStatus = NONE,
 *         promotedScopePacketId = null, displayName from override or source
 *         packet's displayName.
 *       * one QuoteLocalPacketItem row per source PacketTaskLine, mapped 1:1
 *         via the locked inverse mapper (packet-fork-mapping.ts).
 *       * compose-preview staleness token bumped (existing helper).
 *
 * Out of scope (preserved as deferred): catalog-side editing of any
 * ScopePacketRevision/PacketTaskLine, revision-2 / new-DRAFT creation,
 * supersede / un-publish / archive / deprecate, ScopePacket.status,
 * PacketTier, admin-review queue, dedicated catalog.publish capability,
 * auto-pin to a QuoteLineItem, schema changes.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md §100-101 (mandatory fork on task mutation)
 *   - docs/canon/05-packet-canon.md §134-147 (canonical mapping table — this
 *     mutation walks it in the inverse direction via packet-fork-mapping.ts)
 *   - docs/bridge-decisions/03-packet-fork-promotion-decision.md
 *   - docs/epics/16-packet-task-lines-epic.md §16a (targetNodeKey parity)
 */

export type ForkScopePacketRevisionToQuoteLocalInput = {
  tenantId: string;
  quoteVersionId: string;
  scopePacketRevisionId: string;
  userId: string;
  /** Optional override; falls back to the source ScopePacket.displayName. */
  displayName?: unknown;
};

export async function forkScopePacketRevisionToQuoteLocalForTenant(
  prisma: PrismaClient,
  input: ForkScopePacketRevisionToQuoteLocalInput,
): Promise<QuoteLocalPacketDto | "not_found"> {
  const overrideDisplayName =
    input.displayName === undefined || input.displayName === null
      ? null
      : assertDisplayName(input.displayName);

  // Tenant scoping flows through ScopePacket.tenantId; cross-tenant probes
  // collapse to "not_found" (404) just like promotion/publish.
  const source = await prisma.scopePacketRevision.findFirst({
    where: {
      id: input.scopePacketRevisionId,
      scopePacket: { tenantId: input.tenantId },
    },
    select: {
      id: true,
      status: true,
      scopePacketId: true,
      scopePacket: {
        select: { id: true, tenantId: true, displayName: true, packetKey: true },
      },
      packetTaskLines: {
        orderBy: [{ sortOrder: "asc" }, { lineKey: "asc" }],
        select: {
          id: true,
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
  });
  if (!source) return "not_found";

  // Target tenant scoping flows through Quote.tenantId; cross-tenant or
  // missing target collapses to "not_found" (404).
  const target = await prisma.quoteVersion.findFirst({
    where: { id: input.quoteVersionId, quote: { tenantId: input.tenantId } },
    select: { id: true, status: true, quote: { select: { tenantId: true } } },
  });
  if (!target) return "not_found";

  assertQuoteVersionDraft({ status: target.status, quoteVersionId: target.id });
  assertScopePacketRevisionForkPreconditions({
    scopePacketId: source.scopePacketId,
    scopePacketRevisionId: source.id,
    currentStatus: source.status,
    packetTaskLineCount: source.packetTaskLines.length,
  });

  const itemCreates = source.packetTaskLines.map((line) =>
    mapPacketTaskLineToQuoteLocalPacketItemCreate({
      lineKey: line.lineKey,
      sortOrder: line.sortOrder,
      tierCode: line.tierCode,
      lineKind: line.lineKind,
      embeddedPayloadJson: line.embeddedPayloadJson,
      taskDefinitionId: line.taskDefinitionId,
      targetNodeKey: line.targetNodeKey,
    }),
  );

  const displayName = overrideDisplayName ?? source.scopePacket.displayName;

  const created = await prisma.$transaction(async (tx) => {
    const newPacket = await tx.quoteLocalPacket.create({
      data: {
        tenantId: input.tenantId,
        quoteVersionId: target.id,
        displayName,
        originType: "FORK_FROM_LIBRARY",
        forkedFromScopePacketRevisionId: source.id,
        promotionStatus: "NONE",
        promotedScopePacketId: null,
        createdById: input.userId,
      },
      select: { id: true },
    });

    // Destination uniqueness `@@unique([quoteLocalPacketId, lineKey])` is
    // naturally satisfied by source-side `@@unique([scopePacketRevisionId,
    // lineKey])`; lineKeys are preserved verbatim.
    for (const item of itemCreates) {
      await tx.quoteLocalPacketItem.create({
        data: {
          quoteLocalPacketId: newPacket.id,
          lineKey: item.lineKey,
          sortOrder: item.sortOrder,
          tierCode: item.tierCode,
          lineKind: item.lineKind,
          embeddedPayloadJson:
            item.embeddedPayloadJson === null
              ? Prisma.DbNull
              : (item.embeddedPayloadJson as Prisma.InputJsonValue),
          taskDefinitionId: item.taskDefinitionId,
          targetNodeKey: item.targetNodeKey,
        },
      });
    }

    return newPacket;
  });

  await bumpComposePreviewStalenessToken(prisma, target.id);

  const detail = await getQuoteLocalPacketForTenant(prisma, {
    tenantId: input.tenantId,
    quoteLocalPacketId: created.id,
  });
  if (!detail) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_NOT_FOUND",
      "Forked QuoteLocalPacket could not be re-read in tenant scope.",
      { quoteLocalPacketId: created.id },
    );
  }
  return detail;
}
