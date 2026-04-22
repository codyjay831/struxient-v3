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

## Freeze-sourced materialization (close-out)

- **Source of truth**: `paymentGateIntent.v0` embedded in **`executionPackageSnapshot`** at **send/freeze** (`derivePaymentGateIntentForFreeze` + `sendQuoteVersionForTenant`). Commercial line `paymentBeforeWork` drives target **`packageTaskId`** list.
- **Materialization point**: **Activation** (`activateQuoteVersionInTransaction`) maps each `targetPackageTaskId` → new **`RuntimeTask.id`** on the activation flow, then creates **`PaymentGate`** + **`PaymentGateTarget`** rows (idempotent per `quoteVersionId`).
- **Idempotent repair**: If activation already exists but the gate row is missing while the frozen snapshot still carries `paymentGateIntent`, a **replay activate** recreates the gate from the same frozen mapping (no duplicate gates).

## Change-order supersede-safe retargeting (close-out)

- **`applyChangeOrderForJob`**: After activating the CO draft version, **unsatisfied** gates that still target **about-to-be-superseded** runtime tasks → **`payment_gate_block`** (transaction refused). **Satisfied** gates → RUNTIME targets are **retargeted** by stable **`packageTaskId`** to the new flow’s runtime row, or **`payment_gate_retarget_failed`** if a target slot no longer exists (no silent dangling targets).

## Intentionally Left Out

- **Auto-satisfy / billing integration**: Gates are still cleared by **office** `satisfy` only; no PSP webhooks in this slice.
- **Epic 48 / `Hold` model**: Generic operational holds remain separate.
- **Pre-activation runtime-less gates**: Targets are **RUNTIME** ids only; intent is resolved at activation when manifest tasks exist.

## Known Follow-up Risks

- **Second gate on CO-applied quote version**: If a CO **draft** is sent with its **own** `paymentGateIntent`, activation of that version can create an **additional** job-scoped gate (`quoteVersionId` unique per version). Product may later **consolidate** job-level deposit UX.
