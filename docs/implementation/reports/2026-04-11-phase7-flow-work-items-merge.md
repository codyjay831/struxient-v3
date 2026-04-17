# After-action: Phase 7 — merged `workItems` on flow execution read

**Date:** 2026-04-11  
**Intent:** Single **node-ordered feed** for UI: **`workItems`** on **`GET /api/flows/[flowId]`** interleaves **skeleton** tasks (from snapshot) and **RUNTIME** `RuntimeTask` rows **per workflow node**, aligned with **`epic 36`** / Phase 8 work list direction.

## Behavior

- **`parseWorkflowNodeIdsInOrder(snapshotJson)`** — node ids in **`nodes`** array order (deduped).
- **`mergeNodeOrder`** — snapshot order first; any **`nodeId`** appearing only on skeleton/runtime rows is appended (lexicographic).
- For each node in that order: emit all **SKELETON** rows for the node (snapshot iteration order), then **RUNTIME** tasks sorted by **`createdAt`**, **`id`**.
- **`SKELETON`** items include **`execution: { status: "not_started", … }`** until **SKELETON** `TaskExecution` APIs exist.

## API shape

- **`FlowExecutionApiDto`** adds **`workflowNodeOrder`** and **`workItems`**; existing **`skeletonTasks`** and **`runtimeTasks`** unchanged for clients that prefer raw lists.

## Files touched (summary)

- `src/server/slice1/compose-preview/workflow-snapshot-skeleton-tasks.ts` (`parseWorkflowNodeIdsInOrder`)
- `src/server/slice1/reads/flow-execution.ts` (`workflowNodeOrder` on read model)
- `src/lib/flow-execution-dto.ts` (`FlowWorkItemApiDto`, `buildWorkItems`)
- `src/app/page.tsx`
