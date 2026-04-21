# Customer Follow-up Automation Backbone Pass

## Mission
Implement the smallest durable automation backbone for customer follow-up around shared verified evidence links.

## Changes

### Schema Updates
- Added `publicShareLastFollowUpSentAt` (DateTime?) to the `Flow` model in `prisma/schema.prisma` to track the most recent nudge.
- Added `isFollowUp` (Boolean, default: false) to the `FlowShareDelivery` model to distinguish original sends from follow-ups in the audit history.
- Sync'd schema with `npx prisma db push`.

### Server Mutations & Content
- Updated `SendFlowShareRequestBody` in `src/server/slice1/mutations/flow-share-delivery.ts` to include an optional `isFollowUp` flag.
- Modified `sendFlowShareForTenant` to:
  - Persist the `isFollowUp` flag on the delivery record.
  - Update `publicShareLastFollowUpSentAt` on the `Flow` record if `isFollowUp` is true.
  - Included `isFollowUp` in the idempotency check so original sends and follow-ups do not block each other within the 60-second window.
- Updated `renderEmailContent` and `renderSmsContent` in `src/server/comms/delivery-content.ts` to support follow-up variations of subject and body content.

### API Layer
- Updated the delivery API route (`src/app/api/flows/[flowId]/share/deliver/route.ts`) to accept and propagate the `isFollowUp` parameter from the client.

### Server Reads & DTOs
- Updated `FlowExecutionReadModel` and `getFlowExecutionReadModel` in `src/server/slice1/reads/flow-execution.ts` to include `publicShareLastFollowUpSentAt`.
- Updated `FlowExecutionApiDto` and `toFlowExecutionApiDto` in `src/lib/flow-execution-dto.ts` to propagate this field to the UI.

### Office UI
- Updated `FlowShareControls` in `src/components/execution/flow-share-controls.tsx`:
  - Implemented **Follow-up Recommendation Logic**:
    - `NEVER_VIEWED`: Triggered if the link was sent but the portal view count is 0.
    - `FIRST_VIEW`: Triggered if the portal was viewed but no follow-up has been sent yet.
  - Added a **Recommendation Banner** to the UI when a follow-up is suggested.
  - Updated the "Send" button to reflect "Send Follow-up" when a recommendation is active, automatically setting the `isFollowUp` flag.
  - Displayed "Follow-up Sent: [Date]" in the viewer telemetry section.

## Verified
- Created an integration test `scripts/integration/customer-follow-up-automation.integration.test.ts` that verified the following:
  1. Original share send does not trigger follow-up timestamps.
  2. Follow-up share send (with `isFollowUp: true`) updates `lastFollowUpSentAt` and records a follow-up delivery.
  3. Content rendering correctly switches to follow-up templates.
  4. Idempotency correctly distinguishes between original sends and follow-ups.
- Manually verified UI rendering of recommendation banners and button labels.

## Next Step
**Customer Feedback Backbone**: Now that delivery and follow-up are structured and observable, the next step is to add a narrow feedback loop directly in the customer portal, allowing customers to "acknowledge receipt" or "request clarification" on specific evidence items.
