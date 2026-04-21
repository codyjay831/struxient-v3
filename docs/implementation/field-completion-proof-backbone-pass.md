# Epic: Field Completion Proof Backbone

## 1. Summary of Changes
This pass implements the **Field Completion Proof Backbone**, providing a durable, structured mechanism for field workers to attach evidence (notes and photo references) during task completion. It extends the runtime task completion mutation, persists structured proof in the database, and surfaces it in both field and office views.

## 2. Technical Implementation

### A. Schema Changes (`prisma/schema.prisma`)
- **CompletionProof Model**: New model to store structured completion evidence linked to a `TaskExecution` (specifically of type `COMPLETED`).
    - Fields: `id`, `tenantId`, `runtimeTaskId`, `taskExecutionId`, `note`, `createdAt`.
- **CompletionProofAttachment Model**: New model for file-based evidence.
    - Fields: `id`, `tenantId`, `completionProofId`, `storageKey`, `fileName`, `fileSize`, `contentType`, `createdById`, `createdAt`.
- **TaskExecution Extension**: Added a one-to-one relation from `TaskExecution` to `CompletionProof`.
- **Opposite Relations**: Added necessary opposite relations to `Tenant`, `User`, and `RuntimeTask`.

### B. Mutations & API (`src/server/slice1/mutations/runtime-task-execution.ts`, `src/app/api/runtime-tasks/[runtimeTaskId]/complete/route.ts`)
- **Extended Completion Payload**: The `completeRuntimeTaskForTenant` mutation now accepts a `completionProof` object (with `note` and `attachmentKeys`).
- **Atomic Persistence**: Completion and proof creation occur within a single database transaction, ensuring atomicity.
- **API Support**: The task completion API route was updated to extract and pass the completion proof payload from the request body.

### C. Read Models & DTOs (`src/server/slice1/reads/`, `src/lib/`)
- **Rich Execution Summary**: The `deriveRuntimeExecutionSummary` function and `RuntimeTaskExecutionSummary` type were extended to include the completion proof.
- **Flow Execution Read Model**: Updated `getFlowExecutionReadModel` to fetch completion proofs and attachments for both runtime and skeleton tasks.
- **Job Shell Read Model**: Updated `getJobShellReadModel` to fetch completion proofs for office visibility in the job workspace.
- **DTO Alignment**: `FlowExecutionRuntimeTaskApiDto` and `JobShellRuntimeTaskExecutionApiDto` were updated to include the completion proof, ensuring the frontend receives the structured evidence.

### D. UI Hardening (`src/components/execution/`)
- **Proof Entry UI**: `ExecutionWorkItemCard` now features a "Completion Proof" entry step when a worker clicks "Complete Task".
    - Includes a text area for completion notes.
    - Provides immediate visual feedback and a "Confirm Completion" final action.
- **Proof Visibility**: Completed tasks now display their "Completion Proof" directly on the card in the work feed, showing the captured note and attachment count/icons.
- **Sync Support**: `ExecutionWorkFeed` was updated to pass the completion proof payload during the completion mutation.

## 3. Execution Semantics Preserved
- **Standard Completion Flow**: The underlying task completion lifecycle (STARTED -> COMPLETED) remains unchanged.
- **Commercial Controls**: Payment gating and change-order supersession continue to function as intended.
- **Skeleton Tasks**: Skeleton tasks can also hold completion proof if completed, preserving consistency across all work items.

## 4. Tests
- **`scripts/integration/completion-proof.integration.test.ts`**: New integration test verifying the entire lifecycle:
    1. Starting a task.
    2. Completing a task with a structured proof (note + attachment keys).
    3. Verifying database persistence (atomic transaction).
    4. Verifying that the read model and DTO correctly surface the proof in the API response.

## 5. Known Gaps & Follow-ups
- **File Storage**: This pass uses `storageKey` placeholders; actual file upload to S3/Blob storage and binary handling is a future infrastructure pass.
- **Rich Media**: Image thumbnails and a full gallery view are deferred to a specialized media-viewer epic.
- **Office Editing**: Office users can currently view but not edit completion proofs.

## 6. Next Recommended Epic
**Field Evidence Expansion (Media Infrastructure)**: Implement the actual file upload pipeline (signed URLs, storage adapter) and thumbnail generation to turn the `storageKey` placeholders into real visual evidence.
