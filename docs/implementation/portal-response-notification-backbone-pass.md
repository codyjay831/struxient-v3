# Portal Response Notification Backbone Pass

## Mission
Implement the smallest durable notification backbone for customer portal responses.

## Changes

### Schema Updates
- Added `publicShareNotificationLastSeenAt` (DateTime?) to the `Flow` model in `prisma/schema.prisma`.
- Sync'd schema with `npx prisma db push`.

### Server Mutations
- Updated `src/server/slice1/mutations/flow-share-response.ts` to include `markFlowShareNotificationSeenForTenant`.
- This mutation updates the `publicShareNotificationLastSeenAt` timestamp, effectively "dismissing" existing notifications.

### API Routes
- Added `POST /api/flows/[flowId]/share/notification-seen` for office users to mark notifications as seen.

### Server Reads & DTOs
- Updated `FlowExecutionReadModel` and its API DTO to include `publicShareNotificationLastSeenAt`.
- This allows the UI to derive the "unread" state by comparing response timestamps against the last seen timestamp.

### Office UI
- Updated `FlowShareControls` in `src/components/execution/flow-share-controls.tsx`:
  - Implemented **Notification Derivation Logic**:
    - Calculates the most recent customer response timestamp.
    - Compares it to the `publicShareNotificationLastSeenAt` timestamp.
  - Added a **Notification Alert Box**:
    - Displays a prominent alert if there is an unseen response.
    - Specifically highlights **"Clarification Required"** in red if a clarification request is pending.
    - Shows a milder green alert for simple receipt acknowledgments.
    - Includes a **"Dismiss"** button that calls the mark-seen API.

## Verified
- Created an integration test `scripts/integration/customer-portal-notifications.integration.test.ts` that verified the following:
  1. Receipt acknowledgment triggers an "unseen" state.
  2. Marking seen clears the "unseen" state.
  3. Subsequent clarification requests trigger a *new* "unseen" state.
- Manually verified UI rendering of notification alerts and the dismiss behavior.

## Next Step
**Evidence Sharing Governance Hardening**: Now that we have a full loop of sharing, delivery, telemetry, and response, the next step is to harden the governance, such as allowing office users to "resolve" clarification requests or adding expiration rules to share tokens.
