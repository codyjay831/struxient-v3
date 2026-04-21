# Viewer Access Telemetry Backbone Pass

## Mission
Implement the smallest durable telemetry layer for the verified evidence viewer so office users can see whether and when a shared viewer link has been accessed.

## Changes

### Schema Updates
- Added telemetry fields to the `Flow` model in `prisma/schema.prisma`:
  - `publicShareFirstViewedAt` (DateTime?)
  - `publicShareLastViewedAt` (DateTime?)
  - `publicShareViewCount` (Int, default: 0)
- Sync'd schema with `npx prisma db push`.

### Server Mutations
- Created `src/server/slice1/mutations/flow-share-telemetry.ts` with `recordFlowShareAccess`.
- This mutation increments the view count and updates the last viewed timestamp. It also sets the first viewed timestamp if it is not already set.

### Telemetry Recording
- Updated `src/app/portal/flows/[shareToken]/page.tsx` (the customer viewer portal) to record a valid access event after verifying the share token.
- The recording is triggered via `void recordFlowShareAccess(...)` to avoid blocking the customer's page render.

### Server Reads & DTOs
- Updated `FlowExecutionReadModel` and `getFlowExecutionReadModel` in `src/server/slice1/reads/flow-execution.ts` to fetch and include the new telemetry fields.
- Updated `FlowExecutionApiDto` and `toFlowExecutionApiDto` in `src/lib/flow-execution-dto.ts` to propagate these fields to the office UI.

### Office UI
- Updated `FlowShareControls` in `src/components/execution/flow-share-controls.tsx`:
  - Added a "Viewer Activity" section that appears only if the portal has been viewed at least once.
  - Displays the total view count, the date of the first access, and the date of the latest access.
  - Color-coded (sky blue) to distinguish from governance and delivery status.

## Verified
- Created an integration test `scripts/integration/customer-viewer-telemetry.integration.test.ts` that verified the following sequence:
  1. Initial state: view count 0, first viewed null.
  2. First access: view count increments to 1, both timestamps are set.
  3. Second access: view count increments to 2, first viewed remains unchanged, last viewed is updated.
- Manually verified UI rendering of activity state.

## Next Step
**Field Evidence Delivery (Automatic Follow-up & Reminders)**: Now that we have reliable viewer telemetry, the next step is to add "intelligence" such as automatic reminders if a shared link has *not* been viewed after a certain period of time, or notifying the office when it is first accessed.
