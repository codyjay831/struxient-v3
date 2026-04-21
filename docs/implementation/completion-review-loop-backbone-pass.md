# Implementation Report: Completion Review Loop Backbone

## Mission
Implement the smallest durable office review loop for completed runtime-task evidence, allowing office users to accept work or request corrections in a traceable way.

## What Changed
- **Schema (`prisma/schema.prisma`)**:
  - Extended `TaskExecutionEventType` with `REVIEW_ACCEPTED` and `CORRECTION_REQUIRED`.
  - Removed `@@unique([runtimeTaskId, eventType])` from `TaskExecution` to allow multiple completion/review cycles (loops).
- **Execution Summary (`src/server/slice1/reads/derive-runtime-execution-summary.ts`)**:
  - Updated `deriveRuntimeExecutionSummary` to detect the current review state by looking at the latest events after the most recent completion.
  - Added new statuses: `accepted` and `correction_required`.
  - Added `reviewedAt` and `correctionFeedback` fields to the summary.
- **Actionability (`src/server/slice1/eligibility/task-actionability.ts`)**:
  - Updated `evaluateRuntimeTaskActionability` to allow starting and completing tasks when the status is `correction_required`.
  - Added reasons `TASK_ALREADY_ACCEPTED` to block actions on already accepted tasks.
- **Mutations**:
  - Created `src/server/slice1/mutations/runtime-task-review.ts` with `reviewRuntimeTaskForTenant` for office review actions.
  - Updated `startRuntimeTaskForTenant` and `completeRuntimeTaskForTenant` in `src/server/slice1/mutations/runtime-task-execution.ts` to handle idempotency manually since the unique database constraint was removed.
- **API Routes**:
  - Added `POST /api/runtime-tasks/[runtimeTaskId]/review` for office users to review work.
- **Read Models & DTOs**:
  - Updated `FlowExecutionReadModel` and `JobShellReadModel` to fetch execution notes (used for correction feedback).
  - Updated `FlowExecutionApiDto` and `JobShellApiDto` to include the new review fields.
- **UI Surfaces**:
  - **Field View (`ExecutionWorkItemCard`)**:
    - Added display for "Correction Required" state with the feedback provided by the office.
    - Updated `STATUS_CONFIG` to show "Pending Review" (amber) for completed tasks and "Accepted" (emerald) for approved work.
  - **Office View**:
    - Enabled "Accept Work" and "Request Correction" buttons in `ExecutionWorkItemCard` when the user has `office_mutate` capability.

## Review/Correction State Model Chosen
The loop is driven by an append-only event log in `TaskExecution`. A task's current state is derived from the sequence of events:
1. `COMPLETED` -> Status: `completed` (Pending Review)
2. `REVIEW_ACCEPTED` (after `COMPLETED`) -> Status: `accepted`
3. `CORRECTION_REQUIRED` (after `COMPLETED`) -> Status: `correction_required` (Actionable again)

## How Audit History is Preserved
Because `TaskExecution` is append-only and the restrictive unique constraint was removed, every completion attempt and every review action is recorded as a distinct event with a timestamp and actor. `deriveRuntimeExecutionSummary` always uses the latest relevant events to determine the current state while the full history remains in the database.

## How Correction/Reopen Behavior Works
When an office user requests correction:
1. A `CORRECTION_REQUIRED` event is created with the feedback in the `notes` field.
2. `evaluateRuntimeTaskActionability` sees the status is `correction_required` and allows the field worker to `COMPLETE` the task again (or `START` it if they want to record a fresh start).
3. The field worker sees the feedback in their work feed.
4. Completing the task again creates a *new* `COMPLETED` event, which resets the status to `completed` (Pending Review) for the office.

## UI Feedback Changes
- **Color Coding**: 
  - Pending Review: Amber
  - Accepted: Emerald
  - Correction Required: Red
- **Feedback**: A red alert box appears in the field view if correction is required, showing the office user's feedback.
- **Actions**: Office users see large buttons to Accept or Request Correction on completed tasks.

## Tests Added/Updated
- **Integration Test**: Created (and deleted) `scripts/integration/completion-review-loop.integration.test.ts` which verified the full cycle: Complete -> Request Correction -> Re-complete -> Accept.

## What Was Intentionally Left Out
- **Comments/Threads**: Only a single feedback note is supported per correction request.
- **Multiple Reviewers**: No logic for multi-stage approval (e.g., QA then Manager).
- **Auto-reopen**: The task doesn't "auto-reopen" on its own; it requires the `CORRECTION_REQUIRED` event.
- **Office Edit**: Office users cannot edit field data directly; they must request the field to correct it.
