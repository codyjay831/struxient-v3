import type { PrismaClient, TaskDefinitionStatus } from "@prisma/client";
import {
  type CompletionRequirement,
  parseCompletionRequirements,
} from "@/lib/task-definition-authored-requirements";
import {
  buildRequirementsContext,
  parseConditionalRules,
  type ConditionalRule,
} from "@/lib/task-definition-conditional-rules";

/**
 * Tenant-scoped read DTO for the curated TaskDefinition library.
 * Surfaces parsed authored completion requirements + raw conditional rules JSON
 * so authoring UI / inspectors can render the durable shape directly.
 */
export type TaskDefinitionSummaryDto = {
  id: string;
  taskKey: string;
  displayName: string;
  status: TaskDefinitionStatus;
  createdAt: string;
  updatedAt: string;
  /** Quick counters for list view; full requirements live on the detail DTO. */
  requirementsCount: number;
  conditionalRulesCount: number;
  /** Detailed reference counts so authors can see consumption before archiving. */
  packetTaskLineRefCount: number;
  quoteLocalPacketItemRefCount: number;
};

export type TaskDefinitionDetailDto = TaskDefinitionSummaryDto & {
  instructions: string | null;
  /** Parsed durable shape; clients should treat this as the source of truth, not the raw JSON. */
  completionRequirements: CompletionRequirement[];
  /**
   * Parsed durable shape. Cross-validation against `completionRequirements` is intentionally
   * skipped here so legacy / mid-edit data can still surface in the inspector — the mutation
   * path always re-parses with the requirements context and rejects mismatches.
   */
  conditionalRules: ConditionalRule[];
  /** Raw JSON kept alongside the parsed shape for inspection / debugging. */
  conditionalRulesRawJson: unknown;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export function clampTaskDefinitionListLimit(raw: string | null): number {
  if (raw == null || raw === "") return DEFAULT_LIST_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIST_LIMIT;
  return Math.min(n, MAX_LIST_LIMIT);
}

function countArrayJson(json: unknown): number {
  if (Array.isArray(json)) return json.length;
  return 0;
}

function mapSummary(row: {
  id: string;
  taskKey: string;
  displayName: string;
  status: TaskDefinitionStatus;
  createdAt: Date;
  updatedAt: Date;
  completionRequirementsJson: unknown;
  conditionalRulesJson: unknown;
  _count: { packetTaskLines: number; quoteLocalPacketItems: number };
}): TaskDefinitionSummaryDto {
  return {
    id: row.id,
    taskKey: row.taskKey,
    displayName: row.displayName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    requirementsCount: countArrayJson(row.completionRequirementsJson),
    conditionalRulesCount: countArrayJson(row.conditionalRulesJson),
    packetTaskLineRefCount: row._count.packetTaskLines,
    quoteLocalPacketItemRefCount: row._count.quoteLocalPacketItems,
  };
}

export async function listTaskDefinitionsForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    limit: number;
    /** Optional status filter; default returns all (DRAFT, PUBLISHED, ARCHIVED). */
    statuses?: TaskDefinitionStatus[];
  },
): Promise<TaskDefinitionSummaryDto[]> {
  const where: { tenantId: string; status?: { in: TaskDefinitionStatus[] } } = {
    tenantId: params.tenantId,
  };
  if (params.statuses && params.statuses.length > 0) {
    where.status = { in: params.statuses };
  }
  const rows = await prisma.taskDefinition.findMany({
    where,
    orderBy: [{ status: "asc" }, { taskKey: "asc" }],
    take: params.limit,
    select: {
      id: true,
      taskKey: true,
      displayName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      completionRequirementsJson: true,
      conditionalRulesJson: true,
      _count: { select: { packetTaskLines: true, quoteLocalPacketItems: true } },
    },
  });
  return rows.map(mapSummary);
}

export async function getTaskDefinitionDetailForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; taskDefinitionId: string },
): Promise<TaskDefinitionDetailDto | null> {
  const row = await prisma.taskDefinition.findFirst({
    where: { id: params.taskDefinitionId, tenantId: params.tenantId },
    select: {
      id: true,
      taskKey: true,
      displayName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      instructions: true,
      completionRequirementsJson: true,
      conditionalRulesJson: true,
      _count: { select: { packetTaskLines: true, quoteLocalPacketItems: true } },
    },
  });
  if (!row) return null;

  // Parse defensively. If a legacy row carries unrecognized data we surface an empty
  // array — authoring UI then offers to overwrite. We do not throw on malformed library
  // JSON because that would block discovery; the parser's structured errors are exposed
  // through the mutation path on save.
  const parsedReqs = parseCompletionRequirements(row.completionRequirementsJson);
  const completionRequirements = parsedReqs.ok ? parsedReqs.value : [];

  // Parse rules without cross-validation context here so legacy data referencing
  // labels that have since been edited still appears in the editor (the mutation
  // path will then reject any save that doesn't reconcile the reference).
  const parsedRules = parseConditionalRules(row.conditionalRulesJson, null);
  const conditionalRules = parsedRules.ok ? parsedRules.value : [];

  return {
    ...mapSummary(row),
    instructions: row.instructions ?? null,
    completionRequirements,
    conditionalRules,
    conditionalRulesRawJson: row.conditionalRulesJson ?? null,
  };
}

/** Re-export for convenience so the editor page can build a context without an extra import. */
export { buildRequirementsContext };
