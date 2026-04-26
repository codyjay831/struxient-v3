import type { Prisma, PrismaClient } from "@prisma/client";
import {
  buildCanonicalWorkflowSnapshotJson,
  CANONICAL_WORKFLOW_TEMPLATE_DISPLAY_NAME,
  CANONICAL_WORKFLOW_TEMPLATE_KEY,
  CANONICAL_WORKFLOW_VERSION_NUMBER,
} from "@/lib/canonical-workflow-snapshot";

/**
 * Ensure that a tenant has a published canonical workflow version
 * (templateKey = "canonical-stages") whose nodes are the six canonical
 * execution stages. Returns its `WorkflowVersion.id`.
 *
 * Path B contract:
 *   - Quote-creation paths (commercial shell, lead-to-quote, next version)
 *     call this and set `pinnedWorkflowVersionId` on the new `QuoteVersion`
 *     so the user never has to choose a workflow.
 *   - Idempotent: subsequent calls return the existing canonical id.
 *   - Defensive against legacy state: if the canonical template exists but
 *     has no PUBLISHED version v1 (e.g. partial data), this helper will
 *     create v1 in PUBLISHED status. We never silently use a non-canonical
 *     template — the lookup is keyed strictly on `templateKey`.
 *
 * This is the *transactional* variant. Call sites that already hold a
 * `Prisma.TransactionClient` (e.g. inside `prisma.$transaction`) should use
 * this. For ad-hoc callers a `*ForTenant` wrapper exists below.
 */
export async function ensureCanonicalWorkflowVersionInTransaction(
  tx: Prisma.TransactionClient,
  params: { tenantId: string },
): Promise<{ workflowTemplateId: string; workflowVersionId: string }> {
  const tenantId = params.tenantId;

  // 1) Find or create the canonical template. `@@unique([tenantId, templateKey])`
  //    makes this a stable lookup key.
  const existingTemplate = await tx.workflowTemplate.findFirst({
    where: { tenantId, templateKey: CANONICAL_WORKFLOW_TEMPLATE_KEY },
    select: { id: true },
  });
  const workflowTemplateId =
    existingTemplate?.id ??
    (
      await tx.workflowTemplate.create({
        data: {
          tenantId,
          templateKey: CANONICAL_WORKFLOW_TEMPLATE_KEY,
          displayName: CANONICAL_WORKFLOW_TEMPLATE_DISPLAY_NAME,
        },
        select: { id: true },
      })
    ).id;

  // 2) Find or create v1 in PUBLISHED status. We pin v1 to the canonical
  //    snapshot — a future canonical-vocabulary expansion would mint a new
  //    version, not edit this row.
  const existingVersion = await tx.workflowVersion.findFirst({
    where: {
      workflowTemplateId,
      versionNumber: CANONICAL_WORKFLOW_VERSION_NUMBER,
    },
    select: { id: true, status: true, publishedAt: true },
  });

  if (existingVersion) {
    if (existingVersion.status === "PUBLISHED" && existingVersion.publishedAt != null) {
      return { workflowTemplateId, workflowVersionId: existingVersion.id };
    }
    // Defensive: a canonical-template row exists with v1 in a non-PUBLISHED
    // state (legacy partial data). Promote it to PUBLISHED with the
    // canonical snapshot so subsequent compose / activation checks pass.
    const promoted = await tx.workflowVersion.update({
      where: { id: existingVersion.id },
      data: {
        status: "PUBLISHED",
        publishedAt: existingVersion.publishedAt ?? new Date(),
        snapshotJson: buildCanonicalWorkflowSnapshotJson() as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return { workflowTemplateId, workflowVersionId: promoted.id };
  }

  const created = await tx.workflowVersion.create({
    data: {
      workflowTemplateId,
      versionNumber: CANONICAL_WORKFLOW_VERSION_NUMBER,
      status: "PUBLISHED",
      publishedAt: new Date(),
      snapshotJson: buildCanonicalWorkflowSnapshotJson() as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return { workflowTemplateId, workflowVersionId: created.id };
}

/**
 * Ad-hoc variant for callers that don't already hold a transaction client.
 * Wraps the transactional variant in a single small `$transaction`.
 */
export async function ensureCanonicalWorkflowVersionForTenant(
  prisma: PrismaClient,
  params: { tenantId: string },
): Promise<{ workflowTemplateId: string; workflowVersionId: string }> {
  return prisma.$transaction((tx) =>
    ensureCanonicalWorkflowVersionInTransaction(tx, params),
  );
}
