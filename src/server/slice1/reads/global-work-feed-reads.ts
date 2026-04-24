import type { PreJobTaskStatus, PrismaClient } from "@prisma/client";
import { deriveRuntimeExecutionSummary, type RuntimeTaskExecutionSummary } from "./derive-runtime-execution-summary";
import {
  evaluateRuntimeTaskActionability,
  type ActiveHoldForActionabilityBridge,
  type TaskActionability,
} from "../eligibility/task-actionability";
import { runtimeTaskBlockedByActiveHolds } from "../eligibility/hold-eligibility";
import { parseExecutionPackageSnapshotV0ForActivation } from "../compose-preview/execution-package-for-activation";

/**
 * Bumped to 5 (Execution Canon enforcement):
 * - Runtime rows are restricted to ACTIVE_FLOW(job) + non-superseded RuntimeTask only.
 * - Skeleton rows are NOT execution truth and are no longer populated by this read.
 * - PreJobTask rows are a separate context system and are no longer populated by this read.
 * - Each job has at most one row marked `isNextForJob = true` (first eligible in frozen package slot order).
 */
export const GLOBAL_WORK_FEED_SCHEMA_VERSION = 5 as const;

/** Explicit lane — no ranked priority; UI groups by this. */
export type GlobalWorkFeedRuntimeLane = "startable" | "completable" | "blocked";

export type GlobalWorkFeedRuntimeTaskReadRow = {
  runtimeTaskId: string;
  flowId: string;
  jobId: string;
  flowGroupId: string;
  flowGroupName: string;
  customerId: string;
  customerName: string;
  quoteNumber: string;
  /** Frozen package slot key for this runtime task; used as the deterministic ordering key for `isNextForJob`. */
  packageTaskId: string;
  displayTitle: string;
  nodeId: string;
  createdAt: Date;
  execution: RuntimeTaskExecutionSummary;
  actionability: TaskActionability;
  lane: GlobalWorkFeedRuntimeLane;
  /**
   * True for at most one row per `jobId`: the first runtime task — in frozen package slot order — whose
   * `actionability.start.canStart` OR `actionability.complete.canComplete` is true. False otherwise.
   */
  isNextForJob: boolean;
};

/**
 * Pre-job operational row (`PreJobTask`).
 * Retained as a stable shape for backwards-compatible API consumers, but **never populated** by this read
 * after Execution Canon (Schema v5). PreJobTasks are a separate context system; see quote workspace.
 */
export type GlobalWorkFeedPreJobTaskReadRow = {
  preJobTaskId: string;
  title: string;
  status: PreJobTaskStatus;
  taskType: string;
  sourceType: string;
  flowGroupId: string;
  flowGroupName: string;
  customerId: string;
  customerName: string;
  quoteVersionId: string | null;
  quoteId: string | null;
  quoteNumber: string | null;
  quoteVersionNumber: number | null;
  dueAt: Date | null;
  createdAt: Date;
  assignedToLabel: string | null;
};

/**
 * Workflow skeleton row (template task id on pinned snapshot).
 * Retained as a stable shape for backwards-compatible API consumers, but **never populated** by this read
 * after Execution Canon (Schema v5). Skeleton tasks are workflow/template artifacts, not execution truth.
 */
export type GlobalWorkFeedSkeletonTaskReadRow = {
  skeletonTaskId: string;
  flowId: string;
  workflowVersionId: string;
  jobId: string;
  flowGroupId: string;
  flowGroupName: string;
  customerId: string;
  customerName: string;
  quoteNumber: string;
  displayTitle: string;
  nodeId: string;
  execution: RuntimeTaskExecutionSummary;
  actionability: TaskActionability;
  lane: GlobalWorkFeedRuntimeLane;
};

export type GlobalWorkFeedReadModel = {
  schemaVersion: typeof GLOBAL_WORK_FEED_SCHEMA_VERSION;
  /** True when the runtime task DB fetch hit the cap. */
  runtimeTruncated: boolean;
  /** Always `false` under Schema v5 (PreJobTask rows are no longer populated by this read). */
  preJobTruncated: boolean;
  /** Always `false` under Schema v5 (skeleton scan is not performed by this read). */
  skeletonFlowScanTruncated: boolean;
  /** Always `false` under Schema v5 (skeleton rows are not populated by this read). */
  skeletonRowsTruncated: boolean;
  /** Runtime manifest tasks on each job's ACTIVE_FLOW; excludes accepted; excludes superseded. */
  rows: GlobalWorkFeedRuntimeTaskReadRow[];
  /** Always `[]` under Schema v5 — see `GlobalWorkFeedPreJobTaskReadRow`. */
  preJobRows: GlobalWorkFeedPreJobTaskReadRow[];
  /** Always `[]` under Schema v5 — see `GlobalWorkFeedSkeletonTaskReadRow`. */
  skeletonRows: GlobalWorkFeedSkeletonTaskReadRow[];
};

const DEFAULT_FETCH_CAP = 400;
const MAX_EXPORT = 200;

const PREJOB_STATUS_SORT: PreJobTaskStatus[] = ["OPEN", "READY", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"];

/**
 * Retained for backwards compatibility with workspace / context surfaces that still classify pre-job lifecycle.
 * The global execution work feed itself no longer emits PreJobTask rows under Schema v5.
 */
export function isPreJobTaskOpenInWorkFeedStatus(status: PreJobTaskStatus): boolean {
  return status !== "DONE" && status !== "CANCELLED";
}

/** Internal helper kept for stable sort references. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function preJobStatusRank(s: PreJobTaskStatus): number {
  const i = PREJOB_STATUS_SORT.indexOf(s);
  return i === -1 ? 99 : i;
}

export function classifyGlobalWorkFeedRuntimeLane(actionability: TaskActionability): GlobalWorkFeedRuntimeLane {
  if (actionability.start.canStart) return "startable";
  if (actionability.complete.canComplete) return "completable";
  return "blocked";
}

function compareFeedRows(a: GlobalWorkFeedRuntimeTaskReadRow, b: GlobalWorkFeedRuntimeTaskReadRow): number {
  const c1 = a.customerName.localeCompare(b.customerName);
  if (c1 !== 0) return c1;
  const c2 = a.quoteNumber.localeCompare(b.quoteNumber);
  if (c2 !== 0) return c2;
  const c3 = a.flowGroupName.localeCompare(b.flowGroupName);
  if (c3 !== 0) return c3;
  const c4 = a.flowId.localeCompare(b.flowId);
  if (c4 !== 0) return c4;
  const c5 = a.nodeId.localeCompare(b.nodeId);
  if (c5 !== 0) return c5;
  const t = a.createdAt.getTime() - b.createdAt.getTime();
  if (t !== 0) return t;
  return a.runtimeTaskId.localeCompare(b.runtimeTaskId);
}

/**
 * Resolve `ACTIVE_FLOW(jobId)` for every job in the tenant per Execution Canon:
 *   1. Candidate flows have ≥1 RuntimeTask with `changeOrderIdSuperseded IS NULL`.
 *   2. If exactly one candidate exists, that flow is active.
 *   3. If multiple candidates exist, the lexicographically maximum `flow.id` wins.
 *   4. If no candidate exists for a job, the job has no active execution flow.
 *
 * Returns a `Map<jobId, activeFlowId>`; jobs absent from the map have no active flow.
 */
async function resolveActiveFlowIdByJobId(
  prisma: PrismaClient,
  tenantId: string,
): Promise<Map<string, string>> {
  const candidateFlows = await prisma.flow.findMany({
    where: {
      tenantId,
      runtimeTasks: { some: { changeOrderIdSuperseded: null } },
    },
    select: { id: true, jobId: true },
  });

  const out = new Map<string, string>();
  for (const f of candidateFlows) {
    const existing = out.get(f.jobId);
    if (existing == null || f.id.localeCompare(existing) > 0) {
      out.set(f.jobId, f.id);
    }
  }
  return out;
}

async function activeHoldsByJobId(
  prisma: PrismaClient,
  tenantId: string,
  jobIds: string[],
): Promise<Map<string, ActiveHoldForActionabilityBridge[]>> {
  const uniq = [...new Set(jobIds)].filter(Boolean);
  const out = new Map<string, ActiveHoldForActionabilityBridge[]>();
  if (uniq.length === 0) return out;
  const rows = await prisma.hold.findMany({
    where: { tenantId, status: "ACTIVE", jobId: { in: uniq } },
    select: { jobId: true, id: true, runtimeTaskId: true, reason: true },
  });
  for (const r of rows) {
    const list = out.get(r.jobId) ?? [];
    list.push({ id: r.id, runtimeTaskId: r.runtimeTaskId, reason: r.reason });
    out.set(r.jobId, list);
  }
  return out;
}

/**
 * Build `packageTaskId → frozen-slot-index` from a quote version's executionPackageSnapshot.
 * Skeleton-only slots are skipped by the parser. Returns `null` if the snapshot is missing or invalid.
 */
function buildPackageOrderIndex(snapshot: unknown): Map<string, number> | null {
  if (snapshot == null) return null;
  const parsed = parseExecutionPackageSnapshotV0ForActivation(snapshot);
  if (!parsed.ok) return null;
  const index = new Map<string, number>();
  for (let i = 0; i < parsed.slots.length; i++) {
    index.set(parsed.slots[i]!.packageTaskId, i);
  }
  return index;
}

/**
 * Tenant-wide execution work feed (Execution Canon, Schema v5).
 *
 * Runtime row inclusion criteria (must all hold):
 *   - `RuntimeTask.changeOrderIdSuperseded IS NULL`
 *   - `RuntimeTask.flowId === ACTIVE_FLOW(RuntimeTask.flow.jobId)` per `resolveActiveFlowIdByJobId`
 *   - `deriveRuntimeExecutionSummary(...).status !== "accepted"`
 *
 * Per job, the first runtime task — in frozen package slot order from the active flow's quote version
 * `executionPackageSnapshot` — whose `actionability.start.canStart` OR `actionability.complete.canComplete`
 * is true is marked `isNextForJob = true`. All other rows have `isNextForJob = false`.
 *
 * `preJobRows` and `skeletonRows` are returned as empty arrays for shape stability; this read
 * does not query `PreJobTask` and does not parse workflow snapshots for skeleton tasks.
 */
export async function getGlobalWorkFeedReadModelForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    fetchCap?: number;
    maxRows?: number;
    /** Accepted for API stability; ignored under Schema v5 (no PreJob scan). */
    preJobFetchCap?: number;
    /** Accepted for API stability; ignored under Schema v5. */
    preJobMaxRows?: number;
    /** Accepted for API stability; ignored under Schema v5 (no skeleton scan). */
    skeletonFlowScanCap?: number;
    /** Accepted for API stability; ignored under Schema v5. */
    skeletonMaxRows?: number;
  },
): Promise<GlobalWorkFeedReadModel> {
  const fetchCap = params.fetchCap ?? DEFAULT_FETCH_CAP;
  const maxRows = params.maxRows ?? MAX_EXPORT;

  const activeFlowIdByJobId = await resolveActiveFlowIdByJobId(prisma, params.tenantId);
  const activeFlowIds = [...activeFlowIdByJobId.values()];

  if (activeFlowIds.length === 0) {
    return {
      schemaVersion: GLOBAL_WORK_FEED_SCHEMA_VERSION,
      runtimeTruncated: false,
      preJobTruncated: false,
      skeletonFlowScanTruncated: false,
      skeletonRowsTruncated: false,
      rows: [],
      preJobRows: [],
      skeletonRows: [],
    };
  }

  const raw = await prisma.runtimeTask.findMany({
    where: {
      tenantId: params.tenantId,
      changeOrderIdSuperseded: null,
      flowId: { in: activeFlowIds },
      flow: { tenantId: params.tenantId },
    },
    take: fetchCap + 1,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      packageTaskId: true,
      displayTitle: true,
      nodeId: true,
      createdAt: true,
      flow: {
        select: {
          id: true,
          jobId: true,
          activation: { select: { id: true } },
          quoteVersion: {
            select: {
              executionPackageSnapshot: true,
              quote: {
                select: {
                  quoteNumber: true,
                  customer: { select: { id: true, name: true } },
                  flowGroup: { select: { id: true, name: true } },
                },
              },
            },
          },
          job: {
            select: {
              id: true,
              paymentGates: {
                select: {
                  id: true,
                  status: true,
                  title: true,
                  targets: { select: { taskId: true, taskKind: true } },
                },
              },
            },
          },
        },
      },
      taskExecutions: {
        where: { taskKind: "RUNTIME" },
        select: {
          eventType: true,
          createdAt: true,
          notes: true,
          completionProof: {
            select: {
              note: true,
              attachments: { select: { fileName: true, storageKey: true, contentType: true } },
              checklistJson: true,
              measurementsJson: true,
              identifiersJson: true,
              overallResult: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const runtimeTruncated = raw.length > fetchCap;
  const slice = runtimeTruncated ? raw.slice(0, fetchCap) : raw;

  const runtimeHoldsByJob = await activeHoldsByJobId(
    prisma,
    params.tenantId,
    slice.map((r) => r.flow.jobId),
  );

  /**
   * Cache `Map<flowId, Map<packageTaskId, slotIndex>>`. Each active flow has exactly one quote version
   * (`Flow.quoteVersionId @unique`), so flow id → frozen package order is a stable per-flow lookup.
   */
  const packageOrderByFlowId = new Map<string, Map<string, number> | null>();

  const mapped: GlobalWorkFeedRuntimeTaskReadRow[] = [];
  for (const row of slice) {
    const execution = deriveRuntimeExecutionSummary(row.taskExecutions);
    if (execution.status === "accepted") {
      continue;
    }
    const hasActivation = row.flow.activation != null;
    const paymentGates = row.flow.job.paymentGates.map((g) => ({
      id: g.id,
      status: g.status as "UNSATISFIED" | "SATISFIED",
      title: g.title,
      targets: g.targets.map((tg) => ({
        taskId: tg.taskId,
        taskKind: tg.taskKind as "RUNTIME" | "SKELETON",
      })),
    }));
    const hasUnsatisfiedPaymentGate = paymentGates.some(
      (g) =>
        g.status === "UNSATISFIED" &&
        g.targets.some((tg) => tg.taskKind === "RUNTIME" && tg.taskId === row.id),
    );
    const jobHolds = runtimeHoldsByJob.get(row.flow.jobId) ?? [];
    const hasHold = runtimeTaskBlockedByActiveHolds(
      jobHolds.map((h) => ({ runtimeTaskId: h.runtimeTaskId })),
      row.id,
    );
    const actionability = evaluateRuntimeTaskActionability(
      hasActivation,
      execution,
      hasUnsatisfiedPaymentGate,
      hasHold,
      {
        runtimeTaskId: row.id,
        paymentGates,
        activeHolds: jobHolds,
      },
    );
    const q = row.flow.quoteVersion.quote;

    if (!packageOrderByFlowId.has(row.flow.id)) {
      packageOrderByFlowId.set(
        row.flow.id,
        buildPackageOrderIndex(row.flow.quoteVersion.executionPackageSnapshot),
      );
    }

    mapped.push({
      runtimeTaskId: row.id,
      flowId: row.flow.id,
      jobId: row.flow.jobId,
      flowGroupId: q.flowGroup.id,
      flowGroupName: q.flowGroup.name,
      customerId: q.customer.id,
      customerName: q.customer.name,
      quoteNumber: q.quoteNumber,
      packageTaskId: row.packageTaskId,
      displayTitle: row.displayTitle,
      nodeId: row.nodeId,
      createdAt: row.createdAt,
      execution,
      actionability,
      lane: classifyGlobalWorkFeedRuntimeLane(actionability),
      isNextForJob: false,
    });
  }

  /**
   * Mark `isNextForJob` per job: walk each job's rows in **frozen package slot order** from the active
   * flow's quote version snapshot; the FIRST row whose `canStart || canComplete` is true wins. Rows
   * whose `packageTaskId` is missing from the snapshot sort after all known slots; ties break by
   * `runtimeTaskId` for determinism.
   */
  const rowsByJobId = new Map<string, GlobalWorkFeedRuntimeTaskReadRow[]>();
  for (const r of mapped) {
    const list = rowsByJobId.get(r.jobId) ?? [];
    list.push(r);
    rowsByJobId.set(r.jobId, list);
  }
  for (const [, jobRows] of rowsByJobId) {
    const flowId = jobRows[0]!.flowId;
    const order = packageOrderByFlowId.get(flowId) ?? null;
    const ordered = [...jobRows].sort((a, b) => {
      const ai = order?.get(a.packageTaskId);
      const bi = order?.get(b.packageTaskId);
      const aIdx = ai == null ? Number.MAX_SAFE_INTEGER : ai;
      const bIdx = bi == null ? Number.MAX_SAFE_INTEGER : bi;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.runtimeTaskId.localeCompare(b.runtimeTaskId);
    });
    for (const candidate of ordered) {
      if (candidate.actionability.start.canStart || candidate.actionability.complete.canComplete) {
        candidate.isNextForJob = true;
        break;
      }
    }
  }

  mapped.sort(compareFeedRows);

  return {
    schemaVersion: GLOBAL_WORK_FEED_SCHEMA_VERSION,
    runtimeTruncated,
    preJobTruncated: false,
    skeletonFlowScanTruncated: false,
    skeletonRowsTruncated: false,
    rows: mapped.slice(0, maxRows),
    preJobRows: [],
    skeletonRows: [],
  };
}
