# Recipient Prefill Backbone Pass

## Mission
Implement the smallest durable recipient-prefill layer for the customer share delivery workflow.

## Changes

### Schema Updates
- Added `primaryEmail` and `primaryPhone` (String?) to the `Customer` model in `prisma/schema.prisma`.
- Sync'd schema with `npx prisma db push`.

### Server Reads
- Updated `FlowExecutionReadModel` and `getFlowExecutionReadModel` in `src/server/slice1/reads/flow-execution.ts` to fetch and include `customer.email` and `customer.phone`.
- Updated `FlowExecutionApiDto` and `toFlowExecutionApiDto` in `src/lib/flow-execution-dto.ts` to propagate these fields to the API layer.

### Office UI
- Updated `FlowShareControls` in `src/components/execution/flow-share-controls.tsx`:
  - Added a `useEffect` hook that triggers when the delivery form is opened or the delivery method changes.
  - Automatically pre-fills the `recipientDetail` input with the customer's email (for EMAIL) or phone (for SMS) if available.
  - Preserves the operator's ability to override or manually enter recipient details.

### Implementation Details
- **Canonical Source**: The `Customer` model now holds the primary contact information, which is fetched alongside flow execution data.
- **Operator Control**: Prefill only happens when the delivery method changes or the form is first shown, allowing the operator to review and edit before sending.
- **Auditability**: The existing `sendFlowShareForTenant` mutation already records the `recipientDetail` actually used, so the audit trail remains truthful.

## Verified
- Created an integration test `scripts/integration/customer-recipient-prefill.integration.test.ts` that verified the read model correctly fetches prefilled data.
- Manually verified UI prefill logic in `FlowShareControls`.

## Next Step
**Field Evidence Delivery (Delivery Intelligence & Insights)**: The next step is to add intelligence to the delivery workflow, such as tracking when the portal link was first opened by the customer.
