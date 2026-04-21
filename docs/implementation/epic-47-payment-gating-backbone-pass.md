# Epic 47 — Payment Gating Backbone Pass

## Implementation Summary
The Payment Gating Backbone provides a server-side enforcement layer that prevents field execution (task starts) until required commercial conditions (e.g., deposits) are satisfied. This addresses the "Field Ready Illusion" identified in the verified audit.

## Schema Changes
- **`PaymentGate` model**: Job-scoped commercial gate with `UNSATISFIED` or `SATISFIED` status.
- **`PaymentGateTarget` model**: Links a gate to specific `RUNTIME` or `SKELETON` task IDs.
- **`PaymentGateStatus` enum**: `UNSATISFIED`, `SATISFIED`.

## Enforcement Point
- **`evaluateRuntimeTaskActionability` / `evaluateSkeletonTaskActionability`**: Updated to include `PAYMENT_GATE_UNSATISFIED` as a blocking reason.
- **`startRuntimeTaskForTenant` / `startSkeletonTaskForTenant`**: These mutations now verify if any unsatisfied payment gate targets the requested task ID before allowing a `STARTED` event to be recorded. This is the canonical server-side enforcement point.

## Routes & Mutations
- **New Mutation**: `satisfyPaymentGateForTenant` in `src/server/slice1/mutations/satisfy-payment-gate.ts`.
- **New API Route**: `POST /api/payment-gates/[gateId]/satisfy` for office-authorized gate clearance.
- **Updated Mutations**: `startRuntimeTaskForTenant` and `startSkeletonTaskForTenant` now include gating logic.

## UI Surfaces Updated
- **`src/app/(office)/quotes/[quoteId]/page.tsx`**: Added a "Commercial Controls" section to the sidebar/workspace that shows gate status.
- **`QuoteWorkspacePaymentGates` component**: Allows office users with `office_mutate` capability to satisfy gates directly from the workspace.

## Tests Added
- **`scripts/integration/payment-gating.integration.test.ts`**: A new end-to-end integration test proving:
  1. Tasks can start normally without gates.
  2. Tasks are blocked from starting when an unsatisfied gate targets them.
  3. Office-authorized satisfaction unlocks the tasks.
  4. Tasks can start normally after satisfaction.

## Intentionally Left Out
- **Auto-release logic**: Gates must be satisfied manually for now.
- **Granular Hold logic**: While `Decision 02` mentions Holds, this pass focused on the durable `PaymentGate` backbone as requested.
- **Change Order Retargeting**: Deferred to Epic 37 (Change Orders).

## Known Follow-up Risks
- **Change Orders**: When a Change Order removes or replaces a task that was a gate target, the gate policy will need to be explicitly updated or remapped. This is a known subquestion in `Decision 02`.
