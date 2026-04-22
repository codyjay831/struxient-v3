# Epic: Field Validation & Required-Field Enforcement

## 1. Summary of Changes
This pass implements the **Field Validation & Required-Field Enforcement**, hardening the compliance loop by blocking task completion when required authored data is missing. It uses the frozen requirements on the `RuntimeTask` as the source of truth, enforcing checklist completion, measurement capture, and identifier recording at the server level and providing clear feedback in the field UI.

## 2. Technical Implementation

### A. Enforcement Rules
The system now enforces the following rules during task completion based on the authored standard frozen at activation:
- **Required Checklists**: Every checklist item marked as `required` must have a status of "yes", "no", or "na".
- **Required Measurements**: Every measurement prompt marked as `required` must have a non-empty value.
- **Required Identifiers**: Every identifier prompt (e.g., Serial #) marked as `required` must have a non-empty value.
- **Required Overall Result**: If a `result` requirement is marked as `required`, the user must select a top-level Pass/Fail status.

### B. Server-Side Mutations (`src/server/slice1/mutations/runtime-task-execution.ts`)
- **Validation Engine**: Updated `completeRuntimeTaskForTenant` to iterate through the frozen `completionRequirementsJson` and compare it against the submitted `completionProof`.
- **Result Contract**: Added a new `validation_failed` failure kind to the mutation result, returning a structured list of missing fields and human-readable messages.

### C. API & Error Contract (`src/app/api/runtime-tasks/[runtimeTaskId]/complete/route.ts`)
- **Structured Errors**: The completion API now returns a `400 Bad Request` with a `VALIDATION_FAILED` error code and a `details` array containing specific field errors when requirements are not met.

### D. Field UI Feedback (`src/components/execution/execution-work-item-card.tsx`)
- **Required Markers**: Added red asterisks (*) next to labels for all required fields in the completion entry UI.
- **Inline Error Highlighting**: Fields that fail validation are now highlighted with a red border and ring.
- **Validation Summary**: Added a "Validation Errors" alert box at the top of the structured-data entry drawer that lists all missing requirements after a failed attempt.
- **Real-time Error Sync**: Updated `ExecutionWorkFeed` to pass error details to the individual task cards for precise UI feedback.

## 3. Semantics Preserved
- **Execution Truth**: Validation logic remains strictly coupled to the **frozen** requirements on the task instance, not the live library.
- **Atomic Persistence**: Validation and persistence happen within the same database transaction.
- **Commercial Spine**: Change Orders and Payment Gates are unaffected by these enforcement rules.

## 4. Tests
- **`scripts/integration/required-field-enforcement.integration.test.ts`**: Verified:
    1. Completion is blocked when required checklist/measurement items are empty.
    2. Completion is blocked when only partial required data is provided.
    3. Completion is allowed and persisted once all requirements are satisfied.

## 5. Known Gaps & Follow-ups
- **Numeric Validation**: Measurements currently accept any string; future hardening could enforce numeric ranges or format masks based on metadata.
- **Ad Hoc Requirement Conflict**: Ad hoc (manually added) fields are not validated; only authored prompts carry enforcement rules.
- **Skeleton Task Validation**: Wired to the same `validateCompletionProofAgainstContract` path as runtime complete (`skeleton-task-execution` + frozen snapshot contract lookup). See `scripts/integration/skeleton-task-completion-validation.integration.test.ts`.

## 6. Next Recommended Epic
**Field Evidence Expansion (Checklist Rule Overlays)**: Now that completion is enforced, the next step is to add conditional logic (e.g. "if result is FAIL, a photo is required") to further refine the field compliance contract.
