# Epic 37 — Change Order Backbone Pass

## 1. Summary of Changes
This pass implements the core backbone for post-activation scope mutation via **Change Orders**. The system now supports a controlled lifecycle for modifying the execution manifest of a job while preserving the original frozen truth and maintaining commercial safety through Payment Gating integration.

## 2. Technical Implementation

### A. Schema Modifications (`prisma/schema.prisma`)
- Added `ChangeOrderStatus` enum: `DRAFT`, `PENDING_CUSTOMER`, `READY_TO_APPLY`, `APPLIED`, `VOID`.
- Added `ChangeOrder` model:
    - Linked to `Job`, `Quote`, and a specific `draftQuoteVersion`.
    - Tracks `reason`, `status`, `appliedAt`, and `appliedById`.
- Updated `RuntimeTask` model:
    - Added `changeOrderIdCreated`: Link to the CO that introduced the task.
    - Added `changeOrderIdSuperseded`: Link to the CO that replaced/removed the task.
    - This allows for full auditability of "what work belongs to which contract version."

### B. Core Mutations
- `src/server/slice1/mutations/create-change-order.ts`:
    - Derives the primary quote from the job's active flow.
    - Forks the current head version into a new `DRAFT` for Change Order authoring.
    - Ensures only one active `DRAFT` CO exists per job.
- `src/server/slice1/mutations/apply-change-order.ts`:
    - The "Commercial Delta" enforcement engine.
    - Atomically activates the CO's `QuoteVersion` into a new `Flow`.
    - **Reconciliation Logic**:
        - Supersedes all previously active `RuntimeTask` rows for the job.
        - **Execution Transfer**: If a task with the same `packageTaskId` exists in the new flow, it copies its `TaskExecution` history. This preserves "Started" or "Completed" status across change orders.
    - **Payment Gating Integration**: Blocks application if any superseded task is a target of an `UNSATISFIED` payment gate, preventing the loss of commercial enforcement.

### C. Read Model Updates
- `src/server/slice1/reads/change-order-reads.ts`: New read model for CO listing and detail.
- `src/server/slice1/reads/job-shell.ts` & `src/server/slice1/reads/flow-execution.ts`:
    - Updated to filter out `RuntimeTask` rows where `changeOrderIdSuperseded` is not null.
    - This ensures the operator work feed always reflects the *current* approved scope.

### D. API Routes
- `GET/POST /api/jobs/[jobId]/change-orders`: List and create COs.
- `POST /api/change-orders/[coId]/apply`: Apply an approved CO.

## 3. Original Truth Preservation
- The original `Activation` and `Flow` records remain immutable.
- The `QuoteVersion` snapshots for the original signed package are never modified.
- Change Orders layer as subsequent `Flow` records on the same `Job`, providing a chronological audit trail of scope evolution.

## 4. Payment Gating Interaction
- **Strict Enforcement**: If a Change Order attempts to supersede a task that is currently "locked" by an unsatisfied payment gate, the application fails.
- This forces the operator to either satisfy the gate or explicitly handle the commercial conflict before the work can be changed.

## 5. Tests
- `scripts/integration/change-orders.integration.test.ts`:
    - Setup V1 activation.
    - Start a task to establish progress.
    - Apply CO that adds a new task.
    - **Verify Execution Transfer**: Confirmed the old task's progress moved to the new flow's task row.
    - **Verify Gate Blocking**: Confirmed an unsatisfied gate prevents CO application.

## 6. Known Remaining Gaps & Risks
- **Commercial Adjustments**: This backbone handles the *execution* delta. Commercial adjustments (price changes) are handled via the `QuoteVersion` linked to the CO, but full automated billing synchronization is out of scope.
- **Detour Interaction**: The interaction between manual "Detours" (ad-hoc task shifts) and formal "Change Orders" is governed by the rule that COs supersede the *manifest* baseline.
- **UI**: The production workspace gains CO visibility, but complex "Diff" views (comparing V1 vs V2 line items) remain a future UI epic.

## 7. Next Recommended Epic
**Runtime Execution Surface (Epic 41 / 44)**: Now that we have Production Shell, Payment Gating, and Change Orders, the "Spine" is complete. The next step is to build the production-ready work feed and task execution surfaces for field users.
