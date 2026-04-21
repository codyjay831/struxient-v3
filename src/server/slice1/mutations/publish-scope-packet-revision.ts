import type { PrismaClient } from "@prisma/client";
import { evaluateScopePacketRevisionReadiness } from "@/lib/scope-packet-revision-readiness";
import { assertScopePacketRevisionPublishPreconditions } from "../invariants/scope-packet-revision-publish";

/**
 * Publish action: `ScopePacketRevision` `DRAFT` → `PUBLISHED`, with automatic
 * demotion of any sibling PUBLISHED revision to `SUPERSEDED` in the same
 * transaction (revision-2 evolution decision pack §5).
 *
 * Canon-authorized scope (do not widen):
 *   - office_mutate-gated; tenant ownership enforced via load-side filter.
 *   - Mandatory preflight: status must be DRAFT, readiness predicate must be
 *     `isReady: true`. The "at most one PUBLISHED per packet" invariant is
 *     preserved by transactionally demoting any sibling PUBLISHED revision to
 *     SUPERSEDED — not by rejecting the publish.
 *   - Atomic write inside one transaction:
 *       1. demote sibling PUBLISHED rows on the same packet to SUPERSEDED
 *          (publishedAt on the demoted row is preserved as historical truth)
 *       2. set the target revision: `status = PUBLISHED`, `publishedAt = NOW()`
 *   - Re-publish of an already-PUBLISHED revision rejects (not no-op) via the
 *     `currentStatus = DRAFT` gate. Publish of a SUPERSEDED revision likewise
 *     rejects through the same gate.
 *
 * Out of scope (preserved as deferred): admin-review queue, IN_REVIEW/REJECTED
 * transitions, dedicated `catalog.publish` capability, catalog-side editing,
 * standalone un-publish/un-supersede/archive/deprecate, ScopePacket.status,
 * PacketTier, publishedBy, dedicated audit trail row, packet.published webhook.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — interim publish authority",
 *     "Canon amendment — revision-2 evolution policy (post-publish)")
 *   - docs/implementation/decision-packs/interim-publish-authority-decision-pack.md
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §5, §11
 *   - docs/epics/15-scope-packets-epic.md §16 / §17 / §155
 */

export type PublishScopePacketRevisionInput = {
  tenantId: string;
  scopePacketId: string;
  scopePacketRevisionId: string;
  /** Reserved for a future `publishedBy`/audit slice; not written today. */
  userId: string;
};

export type PublishScopePacketRevisionResult = {
  scopePacketId: string;
  scopePacketRevisionId: string;
  revisionNumber: number;
  status: "PUBLISHED";
  publishedAtIso: string;
  /**
   * Number of sibling PUBLISHED revisions that were demoted to SUPERSEDED in
   * the same transaction. 0 on the first publish of a packet; 1 on every
   * publish of revision N+1 (decision pack §5). Exposed for the API DTO so
   * callers / inspectors can confirm the demotion happened atomically.
   */
  demotedSiblingCount: number;
};

export async function publishScopePacketRevisionForTenant(
  prisma: PrismaClient,
  input: PublishScopePacketRevisionInput,
): Promise<PublishScopePacketRevisionResult | "not_found"> {
  // Load shape mirrors what the readiness predicate consumes; no extra columns.
  // Tenant ownership is enforced as a load-side filter — `null` ⇒ NOT_FOUND.
  const target = await prisma.scopePacketRevision.findFirst({
    where: {
      id: input.scopePacketRevisionId,
      scopePacketId: input.scopePacketId,
      scopePacket: { tenantId: input.tenantId },
    },
    select: {
      id: true,
      revisionNumber: true,
      status: true,
      scopePacketId: true,
      packetTaskLines: {
        select: {
          id: true,
          lineKey: true,
          lineKind: true,
          targetNodeKey: true,
          embeddedPayloadJson: true,
          taskDefinitionId: true,
          taskDefinition: { select: { id: true, status: true } },
        },
      },
    },
  });
  if (!target) return "not_found";

  // Readiness is pure and runs outside the transaction (operates on
  // already-loaded data). Inside the transaction we (1) demote any sibling
  // PUBLISHED row to SUPERSEDED, then (2) promote the target. updateMany on
  // the sibling makes the demotion idempotent and race-safe — the unique
  // (scopePacketId, revisionNumber) index plus the status check guarantees
  // correctness even under parallel publish attempts.
  const readiness = evaluateScopePacketRevisionReadiness({
    packetTaskLines: target.packetTaskLines.map((line) => ({
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

  const { updated, demotedSiblingCount } = await prisma.$transaction(async (tx) => {
    assertScopePacketRevisionPublishPreconditions({
      scopePacketId: target.scopePacketId,
      scopePacketRevisionId: target.id,
      currentStatus: target.status,
      readiness,
    });

    // Step 1: demote any sibling PUBLISHED revision on the same packet to
    // SUPERSEDED. publishedAt on the demoted row is intentionally preserved
    // as historical truth (decision pack §11). Per canon there is at most
    // one such row, but updateMany handles the {0, 1, n} case uniformly.
    const demotion = await tx.scopePacketRevision.updateMany({
      where: {
        scopePacketId: target.scopePacketId,
        status: "PUBLISHED",
        NOT: { id: target.id },
      },
      data: { status: "SUPERSEDED" },
    });

    // Step 2: promote the target.
    const row = await tx.scopePacketRevision.update({
      where: { id: target.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      select: {
        id: true,
        scopePacketId: true,
        revisionNumber: true,
        status: true,
        publishedAt: true,
      },
    });

    return { updated: row, demotedSiblingCount: demotion.count };
  });

  // The update's select narrows `status` to ScopePacketRevisionStatus; the
  // assertion above guarantees it is now PUBLISHED, but the Prisma type does
  // not know that — narrow it explicitly for the result contract.
  if (updated.status !== "PUBLISHED" || updated.publishedAt == null) {
    throw new Error(
      "publishScopePacketRevisionForTenant: post-update read returned unexpected state; transaction integrity violated.",
    );
  }
  return {
    scopePacketId: updated.scopePacketId,
    scopePacketRevisionId: updated.id,
    revisionNumber: updated.revisionNumber,
    status: "PUBLISHED",
    publishedAtIso: updated.publishedAt.toISOString(),
    demotedSiblingCount,
  };
}
