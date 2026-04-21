# Clarification Resolution Backbone Pass

## Mission
Implement the smallest durable office-side resolution loop for customer clarification requests.

## Changes

### Schema Updates
- Added resolution fields to the `Flow` model in `prisma/schema.prisma`:
  - `publicShareClarificationResolvedAt` (DateTime?)
  - `publicShareClarificationResolutionNote` (String?)
- Sync'd schema with `npx prisma db push`.

### Server Mutations
- Updated `src/server/slice1/mutations/flow-share-response.ts`:
  - Added `resolveFlowShareClarificationForTenant`: Records a resolution timestamp and optional internal note.
  - Updated `requestFlowShareClarification`: Automatically clears previous resolution state when a new request is made, ensuring the office is re-alerted to the latest customer concern.
- Updated `manageFlowShareForTenant` in `src/server/slice1/mutations/flow-share.ts`:
  - Ensures resolution state is reset when a share token is regenerated.

### API Routes
- Added `POST /api/flows/[flowId]/share/resolve-clarification` for office users to resolve pending clarification requests.

### Server Reads & DTOs
- Updated `FlowExecutionReadModel` and `FlowExecutionApiDto` to include the new resolution fields.

### Office UI
- Updated `FlowShareControls` in `src/components/execution/flow-share-controls.tsx`:
  - **Resolution Workflow**:
    - If a clarification is pending, a "Resolve" button is shown next to the notification.
    - Clicking "Resolve" opens a narrow form for an optional internal resolution note.
  - **Alert Logic**:
    - The "Clarification Required" alert box remains active until the request is explicitly resolved or dismissed.
    - Updated alert styles to pulse when unresolved.
  - **Activity Visibility**:
    - The activity section now clearly distinguishes between "Requested" and "Resolved" statuses.
    - Resolution notes are displayed within the activity log with distinct styling (green border/text).

## Verified
- Created an integration test `scripts/integration/customer-clarification-resolution.integration.test.ts` that verified the following:
  1. Clarification request creates an unresolved state.
  2. Resolve action persists the resolution timestamp and note.
  3. Subsequent clarification requests from the customer correctly reset the resolution state.
- Manually verified UI flow: request -> alert -> resolve -> status update.

## Next Step
**Share Expiration Governance**: Now that we have a full lifecycle of sharing, telemetry, response, and resolution, the next step is to add expiration rules to share tokens to ensure access is time-bound and automatically governed.
