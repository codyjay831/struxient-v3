# After-action: Phase 7 shell — TaskExecution for RUNTIME start/complete

**Date:** 2026-04-11  
**Intent:** First **append-only execution truth** for **manifest runtime tasks** (`canon/04`, `epic 41`, roadmap Phase 7): **STARTED** / **COMPLETED** rows, **idempotent** retries, **job shell** projection.

## Schema

- Migration **`20260416120000_phase7_task_execution`** (after Flow/RuntimeTask).
- Enums **`TaskExecutionTaskKind`** (`RUNTIME`, `SKELETON` reserved) and **`TaskExecutionEventType`** (`STARTED`, `COMPLETED`).
- **`TaskExecution`**: `tenantId`, `flowId`, `taskKind`, `runtimeTaskId?`, `skeletonTaskId?`, `eventType`, `actorUserId`, optional `notes`, `createdAt`.
- **Unique** `(runtimeTaskId, eventType)` — at most one STARTED and one COMPLETED per runtime task (MVP; no pause/resume).

## API

- **`POST /api/runtime-tasks/[runtimeTaskId]/start`** — body **`{ "actorUserId": "<tenant user id>", "notes"?: string }`**. **409** `RUNTIME_TASK_ALREADY_COMPLETED` if complete row exists. Idempotent replay if STARTED already exists (**`idempotentReplay`**).
- **`POST /api/runtime-tasks/[runtimeTaskId]/complete`** — same body shape. **409** `RUNTIME_TASK_NOT_STARTED` without STARTED. Idempotent on second COMPLETE.

## Job shell

- **`GET /api/jobs/[jobId]`** each runtime task includes **`execution`**: **`status`**, **`startedAt`**, **`completedAt`** derived from RUNTIME **`TaskExecution`** rows.

## Deferred (Phase 7+)

- **SKELETON** executions keyed by `skeletonTaskId` + flow + effective merge (`epic 36`).
- **Eligibility** service (`decisions/01`, `epic 30`) before start.
- **Outcomes**, evidence gates, cancel/fail events, multiple cycles per task.

## Files touched (summary)

- `prisma/schema.prisma`, `prisma/migrations/20260416120000_phase7_task_execution/migration.sql`
- `src/server/slice1/mutations/runtime-task-execution.ts`
- `src/app/api/runtime-tasks/[runtimeTaskId]/start/route.ts`, `complete/route.ts`
- `src/server/slice1/reads/job-shell.ts`, `src/lib/job-shell-dto.ts`
- `src/server/slice1/index.ts`, `src/app/page.tsx`
