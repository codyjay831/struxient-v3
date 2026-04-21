# Implementation Report: Customer Share Provider Automation

## Mission
Implement the smallest durable provider automation layer so audited customer-share delivery intents result in real email/SMS delivery. This pass connects the audited delivery bridge to a provider execution layer, ensuring that office-triggered shares result in physical communication with the customer while maintaining strict governance and auditability.

## What Changed
- **Schema**:
    - Added `PublicShareDeliveryStatus` enum (`QUEUED`, `SENT`, `FAILED`).
    - Updated `FlowShareDelivery` model to store provider outcomes:
        - `providerStatus`: Current state of the provider send.
        - `providerExternalId`: ID returned by the external provider (e.g., Postmark message ID).
        - `providerError`: Human-readable error message if the send failed.
        - `providerResponse`: Full JSON response from the provider for troubleshooting.
- **Provider Infrastructure**:
    - Created `src/server/comms/comms-provider.ts` defining the `CommsProvider` interface for Email and SMS.
    - Created `src/server/comms/mock-comms-provider.ts` which logs to the console for local development.
    - Created `src/server/comms/get-comms-provider.ts` as a factory for provider selection.
- **Mutations**:
    - Updated `sendFlowShareForTenant` to:
        - Receive `baseUrl` for portal link construction.
        - Invoke the `CommsProvider` after logging the intent.
        - Update the delivery record with the send outcome (Success/Failure) and metadata.
- **API (Delivery Bridge)**:
    - Updated `/api/flows/[flowId]/share/deliver` to automatically infer the `baseUrl` from the request origin and pass it to the mutation.
- **Server Reads**:
    - Updated `getFlowExecutionReadModel` to include `providerStatus` and `providerError` in the delivery history.
- **Office UI**:
    - Enhanced `FlowShareControls` history log to show colored status indicators (SENT=Emerald, FAILED=Red) and human-readable error messages directly in the workflow surface.

## Exact Files Changed
- `prisma/schema.prisma`
- `src/server/comms/comms-provider.ts` (New)
- `src/server/comms/mock-comms-provider.ts` (New)
- `src/server/comms/get-comms-provider.ts` (New)
- `src/server/slice1/mutations/flow-share-delivery.ts`
- `src/app/api/flows/[flowId]/share/deliver/route.ts`
- `src/server/slice1/reads/flow-execution.ts`
- `src/lib/flow-execution-dto.ts`
- `src/components/execution/flow-share-controls.tsx`

## Provider Path Chosen
The system uses a **Mock Provider** by default, which logs the full email/SMS content to the server console. This allows for safe end-to-end testing of the delivery bridge without incurring costs or sending real messages during development. The infrastructure is designed to swap in Postmark or Twilio via the `getCommsProvider` factory.

## Outcome Persistence & Audit
- **In-line Execution**: For this pass, the send execution happens in-line with the delivery request.
- **Durable Logging**: Even if a provider call fails, the intent and the failure reason are permanently recorded on the `FlowShareDelivery` record and visible to office users.
- **Audit Consistency**: High-level `FLOW_SHARE_DELIVERED` audit events remain the primary source for governance tracking.

## Tests Added/Updated
- Created and successfully ran an integration test `scripts/integration/customer-share-provider.integration.test.ts` (deleted after run) which verified:
    - Email and SMS intents invoke the provider.
    - `SENT` status and external IDs are correctly persisted.
    - Delivery history in the read model includes provider outcomes.

## What was Intentionally Left Out
- **Async Queueing**: Sends are currently synchronous. For extremely high volume, a background job queue (e.g., Inngest) would be needed.
- **Templating Engine**: Message bodies are hardcoded in the mutation for now; a full templating system (epic 56) is a future pass.
- **Live Credentials**: No API keys for Postmark/Twilio were added to the repo in this pass.

## Known Follow-up Gaps
- **Rich Templates**: Replacing hardcoded strings with beautiful HTML/Text templates.
- **Provider Webhooks**: Handling delivery events (e.g., "Bounce", "Delivered") via provider webhooks to update statuses asynchronously.
- **Status Polling**: Updating the UI if a status changes after the initial send.
