# After-action: Phase 7 — start eligibility + flow execution read

**Date:** 2026-04-11  
**Intent:** Minimal **eligibility** for runtime **start/complete** (flow must be **activated**) and a **flow-centric read** that combines **skeleton** tasks from the workflow snapshot with **runtime** tasks + execution summary (**`epic 36`** lite).

## Eligibility

- **`startRuntimeTaskForTenant`** and **`completeRuntimeTaskForTenant`** require an **`Activation`** row for the task’s **`flowId`** (`findUnique` on `Activation.flowId`).
- Failure: **`flow_not_activated`** → HTTP **409** with codes **`FLOW_NOT_ACTIVATED`**.
- Normal path: activation always exists after packaged activate; this guards corrupt/partial data.

## `GET /api/flows/[flowId]`

- Tenant-scoped; **404** if flow missing.
- **`data`**: `flow` (ids + timestamps), `activation`, `workflowVersion` (id, versionNumber, status), **`skeletonTasks`** from **`parseSkeletonTasksFromWorkflowSnapshot`**, **`runtimeTasks`** with **`execution`** projection (same as job shell).
- Parser shape: **`nodes[].tasks[]`** with **`{ id, title? }`** per node. Seed workflow (`nodes` only) yields **empty** `skeletonTasks` until templates embed tasks.

## Refactor

- **`derive-runtime-execution-summary.ts`** — shared **`deriveRuntimeExecutionSummary`** for job shell and flow read.

## Deferred

- **SKELETON** `TaskExecution` POST APIs; **holds** / **scheduling** eligibility (**`epic 30`**); richer snapshot shapes and **effective merge** rules.

## Files touched (summary)

- `src/server/slice1/reads/derive-runtime-execution-summary.ts`
- `src/server/slice1/reads/job-shell.ts`
- `src/server/slice1/compose-preview/workflow-snapshot-skeleton-tasks.ts`
- `src/server/slice1/reads/flow-execution.ts`
- `src/lib/flow-execution-dto.ts`
- `src/app/api/flows/[flowId]/route.ts`
- `src/server/slice1/mutations/runtime-task-execution.ts`
- `src/app/api/runtime-tasks/[runtimeTaskId]/start/route.ts`, `complete/route.ts`
- `src/server/slice1/index.ts`, `src/app/page.tsx`
