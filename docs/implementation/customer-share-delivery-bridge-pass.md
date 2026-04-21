# Implementation Report: Customer Share Delivery Bridge

## Mission
Implement the minimum durable office-side send/delivery bridge for published customer evidence links. This pass moves the share workflow from just "copying a link" to an auditable delivery intent, establishing the foundation for automated notifications while keeping the initial footprint minimal and durable.

## What Changed
- **Schema**:
    - Added `FlowShareDelivery` model to track history of sent links.
    - Added `PublicShareDeliveryMethod` enum (`EMAIL`, `SMS`, `MANUAL_LINK`).
    - Added `FLOW_SHARE_DELIVERED` to `AuditEventType` for higher-level audit tracking.
    - Linked `FlowShareDelivery` to `Flow`, `Tenant`, and `User` (actor).
- **Mutations**:
    - Created `src/server/slice1/mutations/flow-share-delivery.ts` with `sendFlowShareForTenant` which validates the flow is `PUBLISHED` and logs the delivery record + audit event.
- **API (Delivery Bridge)**:
    - Created `/api/flows/[flowId]/share/deliver` as a POST route for office users with the `office_mutate` capability to record delivery intents.
- **Server Reads**:
    - Updated `getFlowExecutionReadModel` to fetch the delivery history for the flow, ordered by most recent first.
- **DTOs**:
    - Updated `FlowExecutionApiDto` to carry the delivery history to the frontend.
- **Office UI**:
    - Enhanced `FlowShareControls` component:
        - Added "Send to Customer" workflow.
        - Integrated a delivery form to select a method (Email/SMS/Manual) and enter recipient details.
        - Added a "Delivery History" section showing exactly what was sent, to whom, and when.
        - Preserved "Copy Portal Link" and other governance controls.

## Exact Files Changed
- `prisma/schema.prisma`
- `src/server/slice1/mutations/flow-share-delivery.ts` (New)
- `src/app/api/flows/[flowId]/share/deliver/route.ts` (New)
- `src/server/slice1/reads/flow-execution.ts`
- `src/lib/flow-execution-dto.ts`
- `src/components/execution/flow-share-controls.tsx`
- `src/app/(office)/flows/[flowId]/page.tsx`
- `src/app/dev/work-feed/[flowId]/page.tsx`

## Delivery Bridge Behavior
- **Publish-State Enforcement**: The delivery action is strictly blocked unless the flow status is `PUBLISHED`. Revoked or unpublished flows cannot be "delivered" through the system.
- **Audit History**: Every time a user clicks "Send", a `FlowShareDelivery` record is created. This provides a durable history of customer communication efforts.
- **Manual vs. Automation**: This pass focuses on the "Bridge"—the office intent and logging. While it doesn't integrate with a live SMTP/SMS provider yet, it creates the perfect hook point for future integration.

## Tests Added/Updated
- Created and successfully ran an integration test `scripts/integration/customer-share-delivery.integration.test.ts` (deleted after run) which verified:
    - Delivery is blocked when flow is `UNPUBLISHED`.
    - Delivery succeeds and creates records when flow is `PUBLISHED`.
    - Read model correctly reflects the communication history.

## What was Intentionally Left Out
- **Live SMTP/SMS**: No direct integration with Postmark, SendGrid, or Twilio in this pass.
- **Templating Engine**: Messages are currently conceptual; the bridge records the *intent* and *detail*.
- **Customer Reply Tracking**: No tracking of whether the customer actually opened the link.

## Known Follow-up Gaps
- **Email/SMS Automation**: The next logical step is wiring the `sendFlowShareForTenant` mutation to a real delivery provider.
- **Contact Selection**: Pre-filling recipient details from the `Customer` record (requires epic 04 data to be fully wired).
