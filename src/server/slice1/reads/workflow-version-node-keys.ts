import type { PrismaClient } from "@prisma/client";
import {
  projectWorkflowNodeKeys,
  type WorkflowNodeKeyProjection,
} from "@/lib/workflow-snapshot-node-projection";

/**
 * Tenant-scoped projection of WorkflowVersion.snapshotJson → minimal node-key
 * data for the QuoteLocalPacketItem `targetNodeKey` picker.
 *
 * Returns ONLY projected node ids + task counts. The full snapshotJson is
 * read at the DB layer purely so the projection helper can derive node ids;
 * it never leaves this function.
 *
 * Returns null when the workflow version is not visible to the tenant
 * (no cross-tenant id probe — matches the existing
 * `getWorkflowVersionDiscoveryForTenant` 404 contract).
 */
export type WorkflowVersionNodeKeysDto = {
  workflowVersionId: string;
  nodes: WorkflowNodeKeyProjection[];
};

export async function getWorkflowVersionNodeKeysForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; workflowVersionId: string },
): Promise<WorkflowVersionNodeKeysDto | null> {
  const row = await prisma.workflowVersion.findFirst({
    where: {
      id: params.workflowVersionId,
      workflowTemplate: { tenantId: params.tenantId },
    },
    select: { id: true, snapshotJson: true },
  });
  if (!row) return null;
  return {
    workflowVersionId: row.id,
    nodes: projectWorkflowNodeKeys(row.snapshotJson),
  };
}
