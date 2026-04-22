import type { PreJobTaskStatus, PrismaClient } from "@prisma/client";
import { parseSkeletonTasksFromWorkflowSnapshot } from "../compose-preview/workflow-snapshot-skeleton-tasks";
import { deriveRuntimeExecutionSummary, type RuntimeTaskExecutionSummary } from "./derive-runtime-execution-summary";
import {
  evaluateRuntimeTaskActionability,
  evaluateSkeletonTaskActionability,
  type ActiveHoldForActionabilityBridge,
  type TaskActionability,
} from "../eligibility/task-actionability";
import {
  runtimeTaskBlockedByActiveHolds,
  skeletonStartBlockedByActiveHolds,
} from "../eligibility/hold-eligibility";

/** Bump when row shape or eligibility wiring changes (Epic 39 / holds backbone). */
export const GLOBAL_WORK_FEED_SCHEMA_VERSION = 4 as const;

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
  displayTitle: string;
  nodeId: string;
  createdAt: Date;
  execution: RuntimeTaskExecutionSummary;
  actionability: TaskActionability;
  lane: GlobalWorkFeedRuntimeLane;
};

/**
 * Pre-job operational row (`PreJobTask`). **Not** runtime task actionability —
 * `status` is the source of truth; DONE/CANCELLED are omitted from the feed.
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
 * Workflow skeleton row (template task id on pinned snapshot). Same execution summary + lane
 * derivation as per-flow feed; **not** a `RuntimeTask` — deep link is always the parent flow.
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
  /** True when the pre-job task DB fetch hit the cap. */
  preJobTruncated: boolean;
  /** True when the flow scan for skeleton tasks hit the cap. */
  skeletonFlowScanTruncated: boolean;
  /** Runtime manifest tasks; excludes accepted (terminal) rows. */
  rows: GlobalWorkFeedRuntimeTaskReadRow[];
  /** Open pre-job work (not DONE/CANCELLED), sorted for stable scanning — not dispatch priority. */
  preJobRows: GlobalWorkFeedPreJobTaskReadRow[];
  /** Skeleton tasks from pinned workflow snapshots; excludes accepted; capped after stable sort. */
  skeletonRows: GlobalWorkFeedSkeletonTaskReadRow[];
  /** True when skeleton rows were sliced after the global skeleton row cap. */
  skeletonRowsTruncated: boolean;
};

const DEFAULT_FETCH_CAP = 400;
const MAX_EXPORT = 200;
const PREJOB_FETCH_CAP = 300;
const PREJOB_MAX_EXPORT = 200;
/** Flows scanned for skeleton parse + SKELETON executions (not dispatch priority). */
const SKELETON_FLOW_SCAN_CAP = 120;
const SKELETON_MAX_EXPORT = 200;

const PREJOB_STATUS_SORT: PreJobTaskStatus[] = ["OPEN", "READY", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"];

function preJobStatusRank(s: PreJobTaskStatus): number {
  const i = PREJOB_STATUS_SORT.indexOf(s);
  return i === -1 ? 99 : i;
}

/** `PreJobTask` rows included on `/work` (open lifecycle only). */
export function isPreJobTaskOpenInWorkFeedStatus(status: PreJobTaskStatus): boolean {
  return status !== "DONE" && status !== "CANCELLED";
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

function compareSkeletonFeedRows(a: GlobalWorkFeedSkeletonTaskReadRow, b: GlobalWorkFeedSkeletonTaskReadRow): number {
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
  return a.skeletonTaskId.localeCompare(b.skeletonTaskId);
}

function comparePreJobRows(a: GlobalWorkFeedPreJobTaskReadRow, b: GlobalWorkFeedPreJobTaskReadRow): number {
  const c1 = a.customerName.localeCompare(b.customerName);
  if (c1 !== 0) return c1;
  const c2 = a.flowGroupName.localeCompare(b.flowGroupName);
  if (c2 !== 0) return c2;
  const st = preJobStatusRank(a.status) - preJobStatusRank(b.status);
  if (st !== 0) return st;
  const t = a.createdAt.getTime() - b.createdAt.getTime();
  if (t !== 0) return t;
  return a.preJobTaskId.localeCompare(b.preJobTaskId);
}

/**
 * Tenant-wide work discovery (Epic 39): **runtime** manifest tasks + **pre-job** site tasks.
 *
 * Runtime:
 * - Reuses `deriveRuntimeExecutionSummary` + `evaluateRuntimeTaskActionability` (same gates as per-flow API).
 * - Omits tasks whose execution summary is `accepted`.
 * - Sort: stable lexicographic on customer, quote, project, flow, node, then task time (no scheduling rank).
 *
 * Pre-job:
 * - `PreJobTask` rows not in `DONE` / `CANCELLED` (lifecycle `status` only — no payment/flow gates).
 * - Optional quote context only when `quoteVersion` resolves; otherwise site-level row.
 *
 * Skeleton:
 * - Parsed from each flow’s `workflowVersion.snapshotJson` + `TaskExecution` rows (`taskKind: SKELETON`), same as
 *   `getFlowExecutionReadModel`.
 * - `evaluateSkeletonTaskActionability` + payment gates targeting `SKELETON` + `skeletonTaskId`.
 * - Flow scan order: stable `createdAt`, `id` (not “most important job” ranking); `skeletonFlowScanTruncated` when capped.
 */
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

export async function getGlobalWorkFeedReadModelForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    fetchCap?: number;
    maxRows?: number;
    preJobFetchCap?: number;
    preJobMaxRows?: number;
    skeletonFlowScanCap?: number;
    skeletonMaxRows?: number;
  },
): Promise<GlobalWorkFeedReadModel> {
  const fetchCap = params.fetchCap ?? DEFAULT_FETCH_CAP;
  const maxRows = params.maxRows ?? MAX_EXPORT;
  const preJobFetchCap = params.preJobFetchCap ?? PREJOB_FETCH_CAP;
  const preJobMaxRows = params.preJobMaxRows ?? PREJOB_MAX_EXPORT;
  const skeletonFlowScanCap = params.skeletonFlowScanCap ?? SKELETON_FLOW_SCAN_CAP;
  const skeletonMaxRows = params.skeletonMaxRows ?? SKELETON_MAX_EXPORT;

  const skeletonFlowRaw = await prisma.flow.findMany({
    where: { tenantId: params.tenantId },
    take: skeletonFlowScanCap + 1,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      jobId: true,
      workflowVersionId: true,
      activation: { select: { id: true } },
      workflowVersion: { select: { snapshotJson: true } },
      quoteVersion: {
        select: {
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
      taskExecutions: {
        where: { taskKind: "SKELETON" },
        select: {
          skeletonTaskId: true,
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

  const skeletonFlowScanTruncated = skeletonFlowRaw.length > skeletonFlowScanCap;
  const skeletonFlowSlice = skeletonFlowScanTruncated
    ? skeletonFlowRaw.slice(0, skeletonFlowScanCap)
    : skeletonFlowRaw;

  const skeletonHoldsByJob = await activeHoldsByJobId(
    prisma,
    params.tenantId,
    skeletonFlowSlice.map((f) => f.jobId),
  );

  const skeletonMapped: GlobalWorkFeedSkeletonTaskReadRow[] = [];
  for (const f of skeletonFlowSlice) {
    const snapshotJson = f.workflowVersion.snapshotJson;
    const skeletonBase = parseSkeletonTasksFromWorkflowSnapshot(snapshotJson);
    const eventsBySkeletonId = new Map<
      string,
      {
        eventType: string;
        createdAt: Date;
        notes?: string | null;
        completionProof?: {
          note: string | null;
          attachments: { fileName: string; storageKey: string; contentType: string }[];
          checklistJson?: unknown;
          measurementsJson?: unknown;
          identifiersJson?: unknown;
          overallResult?: string | null;
        } | null;
      }[]
    >();
    for (const ev of f.taskExecutions) {
      if (!ev.skeletonTaskId) continue;
      const list = eventsBySkeletonId.get(ev.skeletonTaskId) ?? [];
      list.push({
        eventType: ev.eventType,
        createdAt: ev.createdAt,
        notes: ev.notes,
        completionProof: ev.completionProof,
      });
      eventsBySkeletonId.set(ev.skeletonTaskId, list);
    }
    const hasActivation = f.activation != null;
    const paymentGates = f.job.paymentGates.map((g) => ({
      id: g.id,
      status: g.status as "UNSATISFIED" | "SATISFIED",
      title: g.title,
      targets: g.targets.map((tg) => ({
        taskId: tg.taskId,
        taskKind: tg.taskKind as "RUNTIME" | "SKELETON",
      })),
    }));
    const q = f.quoteVersion.quote;
    for (const sk of skeletonBase) {
      const execution = deriveRuntimeExecutionSummary(eventsBySkeletonId.get(sk.skeletonTaskId) ?? []);
      if (execution.status === "accepted") {
        continue;
      }
      const hasUnsatisfiedPaymentGate = paymentGates.some(
        (g) =>
          g.status === "UNSATISFIED" &&
          g.targets.some((tg) => tg.taskKind === "SKELETON" && tg.taskId === sk.skeletonTaskId),
      );
      const jobHolds = skeletonHoldsByJob.get(f.jobId) ?? [];
      const hasHold = skeletonStartBlockedByActiveHolds(
        jobHolds.map((h) => ({ runtimeTaskId: h.runtimeTaskId })),
      );
      const actionability = evaluateSkeletonTaskActionability(
        hasActivation,
        execution,
        hasUnsatisfiedPaymentGate,
        hasHold,
        {
          skeletonTaskId: sk.skeletonTaskId,
          paymentGates,
          activeHolds: jobHolds,
        },
      );
      skeletonMapped.push({
        skeletonTaskId: sk.skeletonTaskId,
        flowId: f.id,
        workflowVersionId: f.workflowVersionId,
        jobId: f.jobId,
        flowGroupId: q.flowGroup.id,
        flowGroupName: q.flowGroup.name,
        customerId: q.customer.id,
        customerName: q.customer.name,
        quoteNumber: q.quoteNumber,
        displayTitle: sk.displayTitle,
        nodeId: sk.nodeId,
        execution,
        actionability,
        lane: classifyGlobalWorkFeedRuntimeLane(actionability),
      });
    }
  }
  skeletonMapped.sort(compareSkeletonFeedRows);
  const skeletonRowsFull = skeletonMapped;
  const skeletonRowsTruncated = skeletonRowsFull.length > skeletonMaxRows;
  const skeletonRows = skeletonRowsTruncated
    ? skeletonRowsFull.slice(0, skeletonMaxRows)
    : skeletonRowsFull;

  const preJobRaw = await prisma.preJobTask.findMany({
    where: {
      tenantId: params.tenantId,
      status: { notIn: ["DONE", "CANCELLED"] },
      flowGroup: { tenantId: params.tenantId },
    },
    take: preJobFetchCap + 1,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      taskType: true,
      sourceType: true,
      quoteVersionId: true,
      dueAt: true,
      createdAt: true,
      flowGroup: {
        select: {
          id: true,
          name: true,
          customer: { select: { id: true, name: true } },
        },
      },
      quoteVersion: {
        select: {
          id: true,
          versionNumber: true,
          quote: { select: { id: true, quoteNumber: true } },
        },
      },
      assignedToUser: { select: { email: true, displayName: true } },
    },
  });

  const preJobTruncated = preJobRaw.length > preJobFetchCap;
  const preJobSlice = preJobTruncated ? preJobRaw.slice(0, preJobFetchCap) : preJobRaw;

  const preJobMapped: GlobalWorkFeedPreJobTaskReadRow[] = preJobSlice.map((row) => {
    const qv = row.quoteVersion;
    const assignedToLabel = row.assignedToUser
      ? row.assignedToUser.displayName?.trim() || row.assignedToUser.email
      : null;
    return {
      preJobTaskId: row.id,
      title: row.title,
      status: row.status,
      taskType: row.taskType,
      sourceType: row.sourceType,
      flowGroupId: row.flowGroup.id,
      flowGroupName: row.flowGroup.name,
      customerId: row.flowGroup.customer.id,
      customerName: row.flowGroup.customer.name,
      quoteVersionId: row.quoteVersionId,
      quoteId: qv?.quote.id ?? null,
      quoteNumber: qv?.quote.quoteNumber ?? null,
      quoteVersionNumber: qv?.versionNumber ?? null,
      dueAt: row.dueAt,
      createdAt: row.createdAt,
      assignedToLabel,
    };
  });
  preJobMapped.sort(comparePreJobRows);

  const raw = await prisma.runtimeTask.findMany({
    where: {
      tenantId: params.tenantId,
      changeOrderIdSuperseded: null,
      flow: { tenantId: params.tenantId },
    },
    take: fetchCap + 1,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
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
    mapped.push({
      runtimeTaskId: row.id,
      flowId: row.flow.id,
      jobId: row.flow.jobId,
      flowGroupId: q.flowGroup.id,
      flowGroupName: q.flowGroup.name,
      customerId: q.customer.id,
      customerName: q.customer.name,
      quoteNumber: q.quoteNumber,
      displayTitle: row.displayTitle,
      nodeId: row.nodeId,
      createdAt: row.createdAt,
      execution,
      actionability,
      lane: classifyGlobalWorkFeedRuntimeLane(actionability),
    });
  }

  mapped.sort(compareFeedRows);

  return {
    schemaVersion: GLOBAL_WORK_FEED_SCHEMA_VERSION,
    runtimeTruncated,
    preJobTruncated,
    skeletonFlowScanTruncated,
    skeletonRowsTruncated,
    rows: mapped.slice(0, maxRows),
    preJobRows: preJobMapped.slice(0, preJobMaxRows),
    skeletonRows,
  };
}
