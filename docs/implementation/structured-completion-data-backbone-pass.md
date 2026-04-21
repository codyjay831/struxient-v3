# Epic: Structured Completion Data Backbone

## 1. Summary of Changes
This pass implements the **Structured Completion Data Backbone**, extending the completion proof contract beyond freeform notes and media. It adds a durable persistence layer for structured data such as checklists, measurements, equipment identifiers, and overall results. It also hardens the field execution UI to allow workers to capture this structured evidence during task completion and ensures it is surfaced in both field and office views.

## 2. Technical Implementation

### A. Schema Changes (`prisma/schema.prisma`)
- **CompletionProof Extension**: Added new fields to store structured data as `Json` and a top-level string for the overall result.
    - `checklistJson`: Stores an array of checklist items (label + status).
    - `measurementsJson`: Stores an array of measured values (label + value + unit).
    - `identifiersJson`: Stores equipment/serial identifiers.
    - `overallResult`: Stores a summary outcome (e.g., "PASS", "FAIL").

### B. Mutations & API (`src/server/slice1/mutations/runtime-task-execution.ts`)
- **Extended Request Body**: Updated `RuntimeTaskExecutionRequestBody` to include structured data fields.
- **Durable Storage**: Updated `completeRuntimeTaskForTenant` to persist the new structured data into the `CompletionProof` record within the completion transaction.

### C. Read Models & DTOs (`src/server/slice1/reads/`, `src/lib/`)
- **Aggregated Summary**: Updated `deriveRuntimeExecutionSummary` to correctly extract and map the new structured fields from the database.
- **Flow & Job Reads**: Updated `getFlowExecutionReadModel` and `getJobShellReadModel` to fetch the new structured data fields for both field and office surfaces.
- **DTO Alignment**: Updated `FlowExecutionApiDto` and `JobShellApiDto` to include the structured proof data in the `execution` object.

### D. Field UI Hardening (`src/components/execution/execution-work-item-card.tsx`)
- **Structured Data Entry**: Added a new section to the completion proof entry UI.
    - **Checklist Support**: Allows workers to dynamically add checklist items with "Yes/No/NA" status.
    - **Measurement Support**: Allows capturing labels, values, and units for technical data.
    - **Outcome Selection**: Added a dropdown for the overall task result (Pass/Fail).
- **Post-Completion Display**: Updated the card to show captured structured data (checkmarks, measurement table, and result badge) once the task is completed.

## 3. Semantics Preserved
- **Atomic Integrity**: Completion and structured data capture remain a single atomic operation.
- **Commercial Backbone**: Payment gating and change-order logic continue to function normally.
- **Backbone Contract**: The system remains "folded" per decision `03`, using manifest tasks rather than a parallel inspection truth table.

## 4. Tests
- **`scripts/integration/structured-completion-data.integration.test.ts`**: New integration test verifying:
    1. Starting a task.
    2. Completing with a complex structured payload (checklist + measurements + result).
    3. Verifying database persistence.
    4. Verifying the read model and DTO surface the data correctly.

## 5. Known Gaps & Follow-ups
- **Pre-defined Checklists**: The current UI allows manual entry; future work should support loading pre-defined checklists from task definitions or packet metadata.
- **Validation Rules**: No client or server-side validation for "required" checklist items was added in this backbone pass.
- **Office Editing**: Office users can view but not yet modify captured structured data.

## 6. Next Recommended Epic
**Task-Definition-Driven Form Hardening**: Now that the backbone supports structured data, the next step is to link this to the `TaskDefinition` or `ScopePacket` so the UI automatically presents the correct checklist/measurement fields for specific units of work.
