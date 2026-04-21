import type { PrismaClient } from "@prisma/client";
import { evaluateScopePacketRevisionReadiness } from "@/lib/scope-packet-revision-readiness";
import { assertScopePacketRevisionPublishPreconditions } from "../invariants/scope-packet-revision-publish";

/**
 * Interim publish action: `ScopePacketRevision` `DRAFT` → `PUBLISHED`.
 *
 * Canon-authorized scope (do not widen):
 *   - office_mutate-gated; tenant ownership enforced via load-side filter.
 *   - Mandatory preflight: status must be DRAFT, readiness predicate must be
 *     `isReady: true`, parent ScopePacket must currently have ZERO other
 *     PUBLISHED revisions.
 *   - Atomic write: `status = PUBLISHED` AND `publishedAt = NOW()` in one
 *     transaction. No other fields are touched. No new revision is created.
 *   - Re-publish of an already-PUBLISHED revision rejects (not no-op).
 *
 * Out of scope (preserved as deferred): admin-review queue, IN_REVIEW/REJECTED
 * transitions, dedicated `catalog.publish` capability, catalog-side editing,
 * un-publish/supersede/archive/deprecate, ScopePacket.status, PacketTier,
 * publishedBy, audit trail row, packet.published webhook, schema changes.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — interim publish authority")
 *   - docs/implementation/decision-packs/interim-publish-authority-decision-pack.md
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

  // The "no other PUBLISHED on this packet" check and the two-field write
  // happen inside the same transaction so a parallel publish on a sibling
  // revision cannot win the race. The readiness check is pure and runs
  // outside the transaction (it operates on already-loaded data).
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

  const updated = await prisma.$transaction(async (tx) => {
    const sibling = await tx.scopePacketRevision.findFirst({
      where: {
        scopePacketId: target.scopePacketId,
        status: "PUBLISHED",
        NOT: { id: target.id },
      },
      select: { id: true },
    });

    assertScopePacketRevisionPublishPreconditions({
      scopePacketId: target.scopePacketId,
      scopePacketRevisionId: target.id,
      currentStatus: target.status,
      readiness,
      packetHasOtherPublishedRevision: sibling != null,
    });

    return tx.scopePacketRevision.update({
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
  };
}
