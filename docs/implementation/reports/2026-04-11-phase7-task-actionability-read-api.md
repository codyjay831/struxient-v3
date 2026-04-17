# After-action: Phase 7 — central task actionability (epic 30 shell)

**Date:** 2026-04-11  
**Intent:** One **MVP eligibility** computation for **start** and **complete** on executable tasks, shared by **mutations** and **`GET /api/flows/[flowId]`**, avoiding split-brain between UI and engine (`epic 30` §3).

## Module

- **`src/server/slice1/eligibility/task-actionability.ts`**
- **`TASK_ACTIONABILITY_SCHEMA_VERSION`** = `1`
- **`evaluateRuntimeTaskActionability`** / **`evaluateSkeletonTaskActionability`** (same rules today; split for future divergence)
- **Start** blocking reasons: **`FLOW_NOT_ACTIVATED`**, **`TASK_ALREADY_COMPLETED`**, **`TASK_ALREADY_STARTED`** (in progress — POST start remains **idempotent**; this flag is for **UI** disable / tooltips)
- **Complete** blocking reasons: **`FLOW_NOT_ACTIVATED`**, **`TASK_NOT_STARTED`**, **`TASK_ALREADY_COMPLETED`** (complete POST stays **idempotent** when already completed; **`canComplete`** is false so UI does not imply another completion)

## Mutations

- **`startRuntimeTaskForTenant`**, **`completeRuntimeTaskForTenant`**, **`startSkeletonTaskForTenant`**, **`completeSkeletonTaskForTenant`** load **`TaskExecution`** rows, **`deriveRuntimeExecutionSummary`**, then branch on **`evaluate*Actionability`** instead of ad hoc queries (behavior preserved; **`TASK_ALREADY_STARTED`** does not short-circuit start — unique index + idempotent replay unchanged).

## Read API

- **`toFlowExecutionApiDto`**: each **`skeletonTasks[]`**, **`runtimeTasks[]`**, and **`workItems[]`** entry includes **`actionability`**: `{ start: { schemaVersion, canStart, reasons }, complete: { … } }`.
- **`toJobShellApiDto`**: each flow’s **`runtimeTasks[]`** entry includes the same **`actionability`**, using that flow’s **`activation`** row (aligned with **`GET /api/flows/[flowId]`** for runtime tasks).

## Out of scope (explicit)

- **`HOLD_ACTIVE`**, **`PAYMENT_GATE_UNMET`**, **`NODE_NOT_READY`**, **`DETOUR_BLOCKS`**, **`STRUCTURED_INPUT_MISSING`**, scheduling (`decisions/01` MVP) — no tables wired yet.

## Files touched (summary)

- `src/server/slice1/eligibility/task-actionability.ts`
- `src/server/slice1/mutations/runtime-task-execution.ts`, `skeleton-task-execution.ts`
- `src/lib/flow-execution-dto.ts`, `src/lib/job-shell-dto.ts`
- `src/server/slice1/index.ts`, `src/app/page.tsx`
