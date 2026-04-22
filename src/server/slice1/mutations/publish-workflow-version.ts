import type { PrismaClient } from "@prisma/client";
import { assertWorkflowVersionPublishPreconditions } from "../invariants/workflow-version-publish";

export type PublishWorkflowVersionInput = {
  tenantId: string;
  workflowVersionId: string;
  /** Reserved for future audit / publishedBy; not written today. */
  userId: string;
};

export type PublishWorkflowVersionResultDto = {
  workflowTemplateId: string;
  workflowVersionId: string;
  versionNumber: number;
  status: "PUBLISHED";
  publishedAtIso: string;
  /** Count of sibling rows demoted from PUBLISHED → SUPERSEDED in the same transaction. */
  demotedSiblingCount: number;
};

/**
 * Publishes a **DRAFT** `WorkflowVersion`: atomically demotes any other **PUBLISHED**
 * sibling on the same template to **SUPERSEDED** (preserves their `publishedAt`),
 * then sets this row to **PUBLISHED** with `publishedAt = now()`.
 *
 * Mirrors `publishScopePacketRevisionForTenant` transaction shape (Epic 23).
 */
export async function publishWorkflowVersionForTenant(
  prisma: PrismaClient,
  input: PublishWorkflowVersionInput,
): Promise<PublishWorkflowVersionResultDto | "not_found"> {
  void input.userId; // reserved for future audit / publishedBy
  const target = await prisma.workflowVersion.findFirst({
    where: {
      id: input.workflowVersionId,
      workflowTemplate: { tenantId: input.tenantId },
    },
    select: {
      id: true,
      workflowTemplateId: true,
      versionNumber: true,
      status: true,
      snapshotJson: true,
    },
  });
  if (!target) return "not_found";

  const { updated, demotedSiblingCount } = await prisma.$transaction(async (tx) => {
    const locked = await tx.workflowVersion.findFirst({
      where: {
        id: input.workflowVersionId,
        workflowTemplate: { tenantId: input.tenantId },
      },
      select: {
        id: true,
        workflowTemplateId: true,
        versionNumber: true,
        status: true,
        snapshotJson: true,
      },
    });
    if (!locked) {
      throw new Error("publishWorkflowVersionForTenant: target disappeared inside transaction.");
    }

    assertWorkflowVersionPublishPreconditions({
      workflowTemplateId: locked.workflowTemplateId,
      workflowVersionId: locked.id,
      currentStatus: locked.status,
      snapshotJson: locked.snapshotJson,
    });

    const demotion = await tx.workflowVersion.updateMany({
      where: {
        workflowTemplateId: locked.workflowTemplateId,
        status: "PUBLISHED",
        NOT: { id: locked.id },
      },
      data: { status: "SUPERSEDED" },
    });

    const now = new Date();
    const row = await tx.workflowVersion.update({
      where: { id: locked.id },
      data: { status: "PUBLISHED", publishedAt: now },
      select: {
        id: true,
        workflowTemplateId: true,
        versionNumber: true,
        status: true,
        publishedAt: true,
      },
    });

    return { updated: row, demotedSiblingCount: demotion.count };
  });

  if (updated.status !== "PUBLISHED" || updated.publishedAt == null) {
    throw new Error("publishWorkflowVersionForTenant: post-update row has unexpected state.");
  }

  return {
    workflowTemplateId: updated.workflowTemplateId,
    workflowVersionId: updated.id,
    versionNumber: updated.versionNumber,
    status: "PUBLISHED",
    publishedAtIso: updated.publishedAt.toISOString(),
    demotedSiblingCount,
  };
}
