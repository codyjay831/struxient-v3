# Epic: Task-Definition-Driven Form Hardening

## 1. Summary of Changes
This pass implements the **Task-Definition-Driven Form Hardening**, creating a durable link between authored work standards and field structured-data capture. It allows `TaskDefinition` or authored packet task metadata to declare completion requirements (checklists, measurements, identifiers) and instructions, which then pre-shape the completion form in the field UI.

## 2. Technical Implementation

### A. Schema Extensions (`prisma/schema.prisma`)
- **TaskDefinition**: Added `instructions` (String) and `completionRequirementsJson` (Json) to store reusable work intelligence.
- **PacketTaskLine**: Added `taskDefinitionId` (FK) and added `LIBRARY` to `PacketTaskLineKind` to support referencing global standards.
- **RuntimeTask**: Added `instructions` and `completionRequirementsJson` to store a frozen snapshot of the authored standards at the moment of activation.

### B. Compose & Activation Pipeline
- **Compose Engine (`src/server/slice1/compose-preview/compose-engine.ts`)**: Updated to fetch `instructions` and `completionRequirementsJson` from either the referenced `TaskDefinition` or the embedded payload. These are carried into the `executionPackageSnapshot`.
- **Activation (`src/server/slice1/mutations/activate-quote-version.ts`)**: Updated to copy the frozen standards from the package snapshot into the `RuntimeTask` row, ensuring durability even if the global library changes later.

### C. Read Models & DTOs
- **Surfacing Standards**: Updated `getFlowExecutionReadModel` and `getJobShellReadModel` to fetch the new standards from the `RuntimeTask`.
- **DTO Alignment**: Extended `FlowExecutionApiDto` and `JobShellApiDto` to carry these standards to the UI.

### D. Field UI Hardening (`src/components/execution/execution-work-item-card.tsx`)
- **Form Pre-shaping**: When a field tech opens the completion entry UI, the form is automatically pre-populated with authored checklist items, measurement prompts, and identifiers.
- **Instruction Visibility**: Displayed authored instructions directly on the task card to provide context for the work being completed.
- **Manual Entry Preservation**: Maintained the ability to add ad hoc checklist/measurement items even when pre-defined standards exist.

## 3. Semantics Preserved
- **Frozen Manifest**: Standards are snapshotted into the `RuntimeTask` at activation, preserving the original intent of the signed quote.
- **Unified Capture**: Data captured via pre-defined prompts still persists through the existing `CompletionProof` structured-data contract.

## 4. Tests
- **`scripts/integration/task-definition-driven-form.integration.test.ts`**: New integration test verifying:
    1. Creating a `TaskDefinition` with specific requirements.
    2. Composing and freezing a quote using that definition.
    3. Activating the quote and verifying the `RuntimeTask` received the snapshotted requirements.
    4. Verifying the read model surfaces them correctly for the UI.

## 5. Known Gaps & Follow-ups
- **Required Fields Enforcement**: The schema supports a `required` flag in requirements, but the UI/API does not yet enforce this during completion.
- **Workflow Skeleton Integration**: Skeleton tasks (authored directly in the workflow template) do not yet support these structured requirements.
- **Authoring UI**: Global `TaskDefinition` authoring is not yet built; records must currently be seeded or added via API/Console.

## 6. Next Recommended Epic
**Field Validation & Required-Field Enforcement**: Now that standards drive the form, the next step is to enforce that "required" checklist items or measurements must be satisfied before the task can be marked as complete.
