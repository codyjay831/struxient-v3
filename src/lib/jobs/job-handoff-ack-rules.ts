import type { JobHandoffStatus } from "@prisma/client";

/**
 * Field (or office admin acting as field-capable principal) may acknowledge when
 * handoff is `SENT` and either no assignee list was set or the caller is listed.
 */
export function canAcknowledgeJobHandoff(params: {
  status: JobHandoffStatus;
  assignedUserIds: string[];
  principalUserId: string;
  hasFieldExecuteCapability: boolean;
}): boolean {
  if (!params.hasFieldExecuteCapability) return false;
  if (params.status !== "SENT") return false;
  if (params.assignedUserIds.length === 0) return true;
  return params.assignedUserIds.includes(params.principalUserId);
}
