# Implementation Report: Customer Delivery Reliability Hardening

## Mission
Implement the smallest durable reliability layer for customer-share delivery so sends are more resilient to transient provider failures and operator refresh/retry behavior. This pass hardens the delivery lifecycle with idempotency, automatic retries, and manual recovery options.

## What Changed
- **Schema**:
    - Added `SENDING` to `PublicShareDeliveryStatus` to track in-progress provider calls.
    - Added `retryCount` to `FlowShareDelivery` to track attempt history.
- **Mutations**:
    - **Idempotency**: Updated `sendFlowShareForTenant` to block duplicate sends for the same flow/method/recipient within a 60-second window if a previous attempt is still pending or successful.
    - **Automatic Retries**: Implemented a synchronous 3-attempt retry loop with linear backoff (500ms * attempt) within the mutation to handle transient provider hiccups.
    - **Manual Retry**: Created `retryFlowShareDeliveryForTenant` mutation specifically to allow re-triggering a `FAILED` delivery without creating a new historical record.
- **API (Reliability)**:
    - Created `/api/flows/[flowId]/share/deliver/[deliveryId]/retry` as a POST route for office-authorized manual retries.
- **Office UI**:
    - Enhanced `FlowShareControls`:
        - Added a "Retry" button for any failed delivery in the history log.
        - Integrated `SENDING` status with an animated pulse indicator.
        - Improved status feedback to show attempt counts and specific error messages.
- **Status Lifecycle**:
    - `QUEUED`: Record created.
    - `SENDING`: Provider call in progress (locks duplicates).
    - `SENT`: Terminal success.
    - `FAILED`: Terminal failure after all retries (unlocks for manual retry).

## Exact Files Changed
- `prisma/schema.prisma`
- `src/server/slice1/mutations/flow-share-delivery.ts`
- `src/app/api/flows/[flowId]/share/deliver/[deliveryId]/retry/route.ts` (New)
- `src/components/execution/flow-share-controls.tsx`

## Reliability Model Chosen
A **state-machine based idempotency window** model. It uses the database as a coordinator to ensure that "operator refresh" doesn't spam the provider, while allowing "manual retry" to recover from persistent errors. Synchronous in-line retries provide the first line of defense against transient network issues.

## Idempotency Behavior
The system checks for any delivery of the same type/recipient created in the last 60 seconds. If an active or successful one exists, the API returns the existing ID rather than creating a duplicate. This satisfies the requirement for resilience against operator refresh/double-click.

## Retry/Deferred Execution
- **Automatic**: 3 attempts with increasing delay.
- **Manual**: Office staff can click "Retry" to trigger another full 3-attempt cycle on a failed record.

## Tests Added/Updated
- Created and successfully ran an integration test `scripts/integration/customer-delivery-reliability.integration.test.ts` (deleted after run) which verified:
    - Rapid duplicate requests return the same delivery ID (Idempotency).
    - Failed records can be successfully retried and update their status/timestamp (Manual Recovery).
    - Retry counts are correctly tracked.

## What was Intentionally Left Out
- **Durable Background Queue**: No Redis/RabbitMQ or external job system (synchronous Next.js execution with in-line retries is sufficient for MVP volume).
- **Asynchronous Webhook Reconciliation**: Statuses are updated based on the immediate provider response only.
- **Global Notification Queue**: Hardening is specific to the customer share workflow.

## Known Follow-up Gaps
- **Background Worker**: If provider calls become significantly slower, moving to a background worker (e.g., Inngest) would be the next step.
- **Retry Window Configuration**: Making the 60-second window tenant-configurable.
