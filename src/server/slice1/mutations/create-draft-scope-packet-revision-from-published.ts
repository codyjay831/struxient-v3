import { Prisma, type PrismaClient } from "@prisma/client";
import { assertCreateDraftScopePacketRevisionPreconditions } from "../invariants/scope-packet-revision-create-draft";
import { mapPacketTaskLineToCloneCreate } from "@/lib/packet-revision-clone-mapping";

/**
 * Create the next DRAFT `ScopePacketRevision` (revision N+1) for a `ScopePacket`
 * as a deep clone of the current PUBLISHED revision (revision-2 evolution).
 *
 * Canon-authorized scope (do not widen):
 *   - office_mutate-gated; tenant ownership enforced via load-side filter.
 *   - Source revision = highest-`revisionNumber` PUBLISHED revision on the
 *     same packet (decision pack §3 / catalog summary helper). No cross-packet
 *     source. No fork from SUPERSEDED. No fork from DRAFT.
 *   - At most one DRAFT per packet at any time (decision pack §4): existing
 *     DRAFT ⇒ `SCOPE_PACKET_REVISION_CREATE_DRAFT_PACKET_HAS_DRAFT`.
 *   - At least one PUBLISHED revision must exist on the packet ⇒
 *     `SCOPE_PACKET_REVISION_CREATE_DRAFT_NO_PUBLISHED_SOURCE` otherwise.
 *   - Source must have at least one `PacketTaskLine` (parity with the
 *     promotion / fork empty-source rule).
 *   - All-or-nothing: revision-row insert + every `PacketTaskLine` clone insert
 *     happen inside one `prisma.$transaction`.
 *   - `revisionNumber = max(revisionNumber across ALL revisions) + 1` so the
 *     unique `(scopePacketId, revisionNumber)` index is satisfied even when
 *     SUPERSEDED rows occupy lower numbers.
 *   - `status = DRAFT`, `publishedAt = null`. No status changes to any other
 *     revision (the prior PUBLISHED stays PUBLISHED until an explicit publish
 *     of the new DRAFT demotes it).
 *
 * Out of scope (preserved as deferred): catalog-side editing of the new DRAFT,
 * `PacketTaskLine` CRUD, packet-metadata edits, `ScopePacket.status`,
 * PacketTier, admin-review queue, audit columns (`createdBy`, `createdAt`
 * already exists on the schema row), delete-DRAFT mutation. The returned DTO
 * intentionally omits the cloned `PacketTaskLine` payload — callers re-read
 * via `getScopePacketRevisionDetailForTenant` for the inspector view.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — revision-2 evolution
 *     policy (post-publish)")
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §3, §4, §5
 *   - docs/epics/15-scope-packets-epic.md §16 / §17
 */

export type CreateDraftScopePacketRevisionFromPublishedInput = {
  tenantId: string;
  scopePacketId: string;
  /**
   * Reserved for a future audit slice (`createdBy` column not yet added to
   * `ScopePacketRevision`); not written today, mirroring the publish writer.
   */
  userId: string;
};

export type CreateDraftScopePacketRevisionFromPublishedResult = {
  scopePacketId: string;
  newRevision: {
    id: string;
    revisionNumber: number;
    status: "DRAFT";
    publishedAtIso: null;
    packetTaskLineCount: number;
  };
  /** Source PUBLISHED revision the DRAFT was cloned from. */
  sourcePublishedRevision: {
    id: string;
    revisionNumber: number;
  };
};

export async function createDraftScopePacketRevisionFromPublishedForTenant(
  prisma: PrismaClient,
  input: CreateDraftScopePacketRevisionFromPublishedInput,
): Promise<CreateDraftScopePacketRevisionFromPublishedResult | "not_found"> {
  // Tenant ownership is the load-side filter — null ⇒ 404. We pull every
  // revision (small set per packet) plus the source PUBLISHED revision's
  // PacketTaskLine rows in a single round-trip so the transaction is short
  // and only contains the inserts.
  const packet = await prisma.scopePacket.findFirst({
    where: { id: input.scopePacketId, tenantId: input.tenantId },
    select: {
      id: true,
      tenantId: true,
      revisions: {
        orderBy: [{ revisionNumber: "desc" }],
        select: {
          id: true,
          revisionNumber: true,
          status: true,
        },
      },
    },
  });
  if (!packet) return "not_found";

  // §3: the source is the highest-`revisionNumber` PUBLISHED revision (matches
  // `summarizeScopePacketRevisions.latestPublishedRevisionId`).
  const publishedRevisions = packet.revisions.filter((r) => r.status === "PUBLISHED");
  const sourceMeta = publishedRevisions[0] ?? null; // ordered desc above
  const hasExistingDraft = packet.revisions.some((r) => r.status === "DRAFT");

  // We need the source revision's PacketTaskLine rows to perform the clone.
  // Pull them only if a source exists; if not, the assertion will reject
  // before we use this list and the cost is already paid by `findFirst` above.
  const sourceLines = sourceMeta
    ? await prisma.packetTaskLine.findMany({
        where: { scopePacketRevisionId: sourceMeta.id },
        orderBy: [{ sortOrder: "asc" }, { lineKey: "asc" }],
        select: {
          lineKey: true,
          sortOrder: true,
          tierCode: true,
          lineKind: true,
          embeddedPayloadJson: true,
          taskDefinitionId: true,
          targetNodeKey: true,
        },
      })
    : [];

  assertCreateDraftScopePacketRevisionPreconditions({
    scopePacketId: packet.id,
    hasPublishedSource: sourceMeta != null,
    hasExistingDraft,
    sourceTaskLineCount: sourceLines.length,
  });

  // After the assertion, sourceMeta is provably non-null. Narrow it for TS.
  if (!sourceMeta) {
    throw new Error(
      "createDraftScopePacketRevisionFromPublishedForTenant: invariant assertion accepted a missing PUBLISHED source.",
    );
  }

  // §3 cont.: revisionNumber is max across ALL revisions (PUBLISHED, DRAFT,
  // SUPERSEDED) + 1 — never reuse a number, even if a SUPERSEDED row sits at
  // exactly N.
  const maxRevisionNumber = packet.revisions.reduce(
    (max, r) => (r.revisionNumber > max ? r.revisionNumber : max),
    0,
  );
  const nextRevisionNumber = maxRevisionNumber + 1;

  const lineCreates = sourceLines.map(mapPacketTaskLineToCloneCreate);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check the multi-DRAFT condition inside the transaction so two
      // concurrent create-DRAFT calls cannot both succeed. The unique index
      // on (scopePacketId, revisionNumber) plus our max+1 selection makes
      // the `revisionNumber` collision a race to detect via P2002 below.
      const concurrentDraft = await tx.scopePacketRevision.findFirst({
        where: { scopePacketId: packet.id, status: "DRAFT" },
        select: { id: true },
      });
      if (concurrentDraft) {
        // Mirrors the assertion's exact code/message so the caller sees one
        // error contract regardless of which path detected the conflict.
        assertCreateDraftScopePacketRevisionPreconditions({
          scopePacketId: packet.id,
          hasPublishedSource: true,
          hasExistingDraft: true,
          sourceTaskLineCount: lineCreates.length,
        });
      }

      const newRevision = await tx.scopePacketRevision.create({
        data: {
          scopePacketId: packet.id,
          revisionNumber: nextRevisionNumber,
          status: "DRAFT",
          publishedAt: null,
        },
        select: { id: true, revisionNumber: true, status: true, publishedAt: true },
      });

      for (const create of lineCreates) {
        await tx.packetTaskLine.create({
          data: {
            scopePacketRevisionId: newRevision.id,
            lineKey: create.lineKey,
            sortOrder: create.sortOrder,
            tierCode: create.tierCode,
            lineKind: create.lineKind,
            embeddedPayloadJson: create.embeddedPayloadJson as Prisma.InputJsonValue,
            taskDefinitionId: create.taskDefinitionId,
            targetNodeKey: create.targetNodeKey,
          },
        });
      }

      return { newRevision };
    });

    return {
      scopePacketId: packet.id,
      newRevision: {
        id: result.newRevision.id,
        revisionNumber: result.newRevision.revisionNumber,
        status: "DRAFT",
        publishedAtIso: null,
        packetTaskLineCount: lineCreates.length,
      },
      sourcePublishedRevision: {
        id: sourceMeta.id,
        revisionNumber: sourceMeta.revisionNumber,
      },
    };
  } catch (e) {
    // P2002 on (scopePacketId, revisionNumber) ⇒ a concurrent create-DRAFT
    // (or some other writer) already inserted a row with our chosen number.
    // Surface as the existing canon error so the API contract stays stable.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      assertCreateDraftScopePacketRevisionPreconditions({
        scopePacketId: packet.id,
        hasPublishedSource: true,
        hasExistingDraft: true,
        sourceTaskLineCount: lineCreates.length,
      });
    }
    throw e;
  }
}
