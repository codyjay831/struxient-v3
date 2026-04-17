# After-action: Phase 7 — SKELETON TaskExecution start/complete

**Date:** 2026-04-11  
**Intent:** Extend append-only **`TaskExecution`** to **workflow skeleton** tasks (`canon/04`, `epic 41`), mirroring the RUNTIME API and feeding **`GET /api/flows/[flowId]`** projections.

## Database

- Migration **`20260417120000_task_execution_skeleton_unique`**: partial unique index  
  **`(flowId, skeletonTaskId, eventType)`** where **`taskKind = 'SKELETON'`** — at most one STARTED and one COMPLETED per skeleton task on a flow. RUNTIME rows keep **`@@unique([runtimeTaskId, eventType])`**; NULL **`skeletonTaskId`** on runtime rows does not collide with this index.

## Mutations

- **`startSkeletonTaskForTenant`** / **`completeSkeletonTaskForTenant`** (`skeleton-task-execution.ts`): tenant flow lock, **`unknown_skeleton_task`** if id not in **`parseSkeletonTasksFromWorkflowSnapshot`**, same **`flow_not_activated`** / actor checks as runtime, idempotent on unique violation.

## API

- **`POST /api/flows/[flowId]/skeleton-tasks/[skeletonTaskId]/start`**
- **`POST /api/flows/[flowId]/skeleton-tasks/[skeletonTaskId]/complete`**  
  Body: **`{ "actorUserId", "notes?" }`**. Errors: **`UNKNOWN_SKELETON_TASK`** (400), **`SKELETON_TASK_ALREADY_COMPLETED`** / **`SKELETON_TASK_NOT_STARTED`** (409), **`FLOW_NOT_ACTIVATED`** (409).

## Read model

- **`getFlowExecutionReadModel`**: loads SKELETON **`TaskExecution`** rows for the flow, **`deriveRuntimeExecutionSummary`** per **`skeletonTaskId`**; **`skeletonTasks`** and merged **`workItems`** now include real **`execution`** (not always **`not_started`**).

## Seed

- **`prisma/seed.js`**: workflow snapshot **`node-roof`** includes **`tasks[]`** with **`sk-site-prep`** so a fresh **`db:seed` + `db:seed:activated`** path can smoke skeleton start/complete. Existing databases keep prior snapshot JSON until re-seeded or updated manually.

## Deferred

- Holds / scheduling eligibility (**`epic 30`**), evidence gates, skeleton id disambiguation if duplicate template ids appear on one snapshot.

## Files touched (summary)

- `prisma/migrations/20260417120000_task_execution_skeleton_unique/migration.sql`
- `src/server/slice1/mutations/skeleton-task-execution.ts`
- `src/app/api/flows/[flowId]/skeleton-tasks/[skeletonTaskId]/start/route.ts`, `complete/route.ts`
- `src/server/slice1/reads/flow-execution.ts`, `src/lib/flow-execution-dto.ts`
- `src/server/slice1/index.ts`, `src/app/page.tsx`, `prisma/seed.js`
