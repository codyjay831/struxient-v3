# Customer Receipt & Clarification Backbone Pass

## Mission
Implement the smallest durable customer-side interaction backbone for the verified evidence viewer.

## Changes

### Schema Updates
- Added customer response fields to the `Flow` model in `prisma/schema.prisma`:
  - `publicShareReceiptAcknowledgedAt` (DateTime?)
  - `publicShareClarificationRequestedAt` (DateTime?)
  - `publicShareClarificationReason` (String?)
- Made `AuditEvent.actorId` and the `actor` relation optional to allow logging customer-originated events in the audit log.
- Sync'd schema with `npx prisma db push`.

### Server Mutations
- Created `src/server/slice1/mutations/flow-share-response.ts` with:
  - `acknowledgeFlowShareReceipt`: Acknowledges receipt of the portal link.
  - `requestFlowShareClarification`: Records a structured clarification request.
- Updated `manageFlowShareForTenant` in `src/server/slice1/mutations/flow-share.ts` to reset customer responses when a share token is regenerated.

### API Routes
- Added `POST /api/portal/flows/[shareToken]/acknowledge` for customer receipt acknowledgment.
- Added `POST /api/portal/flows/[shareToken]/clarification` for structured clarification requests.

### Server Reads & DTOs
- Updated `FlowEvidenceReportDto` and its read model to include the new response fields for the portal view.
- Updated `FlowExecutionReadModel` and its API DTO to surface these statuses in the office UI.

### Portal UI
- Updated `FlowEvidenceReportView` in `src/components/report/flow-evidence-report-view.tsx`:
  - Added a "Portal Review Actions" section for customers.
  - Included an "Acknowledge Receipt" button.
  - Included a structured "Request Clarification" form.
  - Added visual status indicators for when an action has been taken.

### Office UI
- Updated `FlowShareControls` in `src/components/execution/flow-share-controls.tsx`:
  - Added a "Customer Response" section in the telemetry/activity area.
  - Displays the acknowledgment date and any clarification requests with their provided reasons.

## Verified
- Created an integration test `scripts/integration/customer-receipt-clarification.integration.test.ts` that verified the following:
  1. Customer actions (acknowledge, request clarification) are correctly persisted.
  2. Audit events are created for these actions without an internal user actor.
  3. Office read model correctly reflects the customer response.
  4. Token regeneration correctly resets the customer response state.
- Manually verified the portal UI actions and office-side status updates.

## Next Step
**Portal Notification Engine (MVP)**: Now that we have customer responses, the next step is to notify the office users when a customer acknowledges receipt or requests clarification.
