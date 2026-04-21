# Project Portal Notification Backbone

## Mission
Implement the smallest durable office-side notification backbone for project-level customer actions.

## What Changed
- **Schema**: Added `publicShareNotificationLastSeenAt` to the `FlowGroup` model to track when office users have last viewed project portal activity.
- **Mutations**: 
    - Created `markProjectShareNotificationSeenForTenant` in `src/server/slice1/mutations/project-share-response.ts`.
- **API Routes**: Added `POST /api/projects/[flowGroupId]/share/notification-seen` to allow office users to dismiss notifications.
- **Read Model & DTO**: Updated `ProjectEvidenceRollupDto` and `getProjectEvidenceRollupReadModel` to include `publicShareNotificationLastSeenAt`.
- **Office UI**: 
    - Updated `ProjectShareControls` to detect and display unseen project acknowledgments.
    - Added a "Dismiss" action to clear the project notification.
    - Integrated acknowledgment timestamps into the project telemetry view.

## Exact Files Changed
- `prisma/schema.prisma`
- `src/server/slice1/mutations/project-share-response.ts`
- `src/app/api/projects/[flowGroupId]/share/notification-seen/route.ts` (New)
- `src/lib/project-evidence-rollup-dto.ts`
- `src/server/slice1/reads/project-evidence-rollup.ts`
- `src/components/report/project-share-controls.tsx`
- `src/app/(office)/projects/[flowGroupId]/evidence/page.tsx`

## Notification Contract
- **Trigger**: A notification is considered "unseen" if `publicShareReceiptAcknowledgedAt` is newer than `publicShareNotificationLastSeenAt`.
- **Scope**: Narrowly scoped to project-level acknowledgment. Individual flow clarifications or acknowledgments continue to use their own flow-level notification state.
- **Durable Seen State**: The "seen" status is persisted in the database, ensuring it is consistent across different office user sessions (sharing the same tenant context).

## Seen/Dismiss Behavior
Office users see a prominent alert card on the project evidence page when a new acknowledgment is received. Clicking "Dismiss" updates the `publicShareNotificationLastSeenAt` timestamp, clearing the alert for that project state.

## Reset Coherence
If a project acknowledgment is reset (due to child-flow publish or project regeneration), the notification alert is implicitly cleared as well (since `publicShareReceiptAcknowledgedAt` becomes null). A new acknowledgment will then trigger a new notification.

## Tests Added
- `scripts/integration/project-notification.integration.test.ts` (Run and deleted) verified:
    - Customer acknowledgment correctly triggers an "unseen" state.
    - Office "mark seen" mutation correctly updates the timestamp and clears the unseen state.

## What was Intentionally Left Out
- **Global Bell Center**: Notifications remain local to the specific project evidence page.
- **Push Notifications**: No email or browser push alerts are triggered.
- **Multi-User Seen State**: Seen state is tracked at the Project (FlowGroup) level, not per-individual-user.

## Next Recommended Epic
**Project Portal Clarification Loop Backbone**: Now that we have project-level receipt and notifications, the final interaction gap is allowing customers to request clarifications at the project level, and managing those resolutions.
