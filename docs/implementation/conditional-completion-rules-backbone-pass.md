# Implementation Report: Conditional Completion Rules Backbone

## Mission
Implement the smallest durable conditional-rule layer that can require additional completion proof (like notes or attachments) when certain authored outcomes (like FAIL or checklist "no") occur.

## What Changed
- **Schema (`prisma/schema.prisma`)**:
  - Added `conditionalRulesJson` to `TaskDefinition` and `RuntimeTask`.
- **Compose Engine (`src/server/slice1/compose-preview/compose-engine.ts`)**:
  - Extended `ComposePackageSlotDto` to include `conditionalRulesJson`.
  - Updated `runComposeFromReadModel` to propagate rules from `TaskDefinition` or `PacketTaskLine.embeddedPayloadJson`.
- **Activation Pipeline**:
  - `execution-package-for-activation.ts`: Updated `ActivationPackageSlot` and parser to handle `conditionalRulesJson`.
  - `freeze-snapshots.ts`: Updated `packageSlotToFrozenJson` to include rules in the frozen package snapshot.
  - `activate-quote-version.ts`: Updated `activateQuoteVersionInTransaction` to copy rules from the frozen slot to the `RuntimeTask` record.
- **Read Models & DTOs**:
  - Updated `FlowExecutionReadModel` and `JobShellReadModel` to fetch `conditionalRulesJson`.
  - Updated `FlowExecutionApiDto`, `JobShellApiDto`, and `FlowWorkItemApiDto` to carry rules to the UI.
- **Server Mutation (`src/server/slice1/mutations/runtime-task-execution.ts`)**:
  - Implemented conditional validation logic in `completeRuntimeTaskForTenant`.
  - Supported rules triggered by `overallResult` value or `checklist` item status.
  - Supported conditional requirements for `note`, `attachment`, `measurement`, and `identifier`.
- **Field UI (`src/components/execution/execution-work-item-card.tsx`)**:
  - Added logic to detect triggered rules based on current entry state.
  - Displayed red asterisks `*` next to fields that become required due to a rule.
  - Highlighted Attachment and Note fields when they are conditionally required.

## Exact Conditional Rules Contract Chosen
Rules are stored as an array of objects:
```typescript
type ConditionalRule = {
  id: string;
  trigger: {
    kind: "result" | "checklist";
    label?: string; // only if trigger.kind === 'checklist'
    value: string;  // e.g. "FAIL" or "no"
  };
  require: {
    kind: "note" | "attachment" | "measurement" | "identifier";
    label?: string;   // only if require.kind is 'measurement' or 'identifier'
    message?: string; // custom error message
  };
};
```

## Where Enforcement Happens
Enforcement happens in the `completeRuntimeTaskForTenant` mutation inside a database transaction. It runs after the standard "required field" validation.

## API/Error Contract Chosen
Uses the same `validation_failed` error contract as the standard required field enforcement:
- Status: 400 Bad Request
- Code: `VALIDATION_FAILED`
- Details: Array of `{ message: string, field?: string }`

## UI Feedback Changes
- **Asterisks**: Red asterisks appear next to labels when a field is conditionally required.
- **Color Coding**: The "Add Photo" button turns amber (amber-900/40) when an attachment is required by a rule.
- **Validation Alert**: On failure, specific error messages from the server are displayed in a validation errors alert box.

## What Execution Semantics Remained Unchanged
- Task actionability (START/COMPLETE eligibility) remains driven by the existing state machine.
- Completion proof still persists to the same `CompletionProof` and `CompletionProofAttachment` tables.
- No changes to the `STARTED` event or its validation.

## Tests Added/Updated
- **Integration Test**: Created (and deleted) `scripts/integration/conditional-completion-rules.integration.test.ts` which verified:
  - Blocking completion when FAIL is selected but no attachment is provided.
  - Allowing completion when FAIL is selected and attachment is provided.
  - Blocking completion when a checklist "no" is selected but no note is provided.
  - Allowing completion when a checklist "no" is selected and note is provided.
  - Allowing completion when no rules are triggered.

## What Was Intentionally Left Out
- **Complex Logic**: No boolean operators (AND/OR) for triggers; each rule has one trigger.
- **Office Correction**: No path for office users to reject evidence and send it back to "in-progress" (future epic).
- **Auto-Fill**: No logic to automatically change the UI (e.g., hiding/showing sections) based on triggers; only validation and markers are used.

## Known Follow-Up Gaps
- **Trade-Specific Logic**: Future epics may need specialized triggers for certain trades.
- **Visual Conditional Hiding**: The UI could hide non-triggered conditional fields to reduce clutter, but currently shows them with markers to maintain layout stability.
