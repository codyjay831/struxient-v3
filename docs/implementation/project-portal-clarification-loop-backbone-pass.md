# Project Portal Clarification Loop Backbone

## Mission
Implement the smallest durable project-level clarification loop for the customer-facing project viewer and office-side project share controls.

## What Changed
- **Schema**: Added clarification fields to the `FlowGroup` model:
    - `publicShareClarificationRequestedAt`
    - `publicShareClarificationReason`
    - `publicShareClarificationResolvedAt`
    - `publicShareClarificationResolutionNote`
- **Mutations**: 
    - Created `requestProjectShareClarification` for customer requests.
    - Created `resolveProjectShareClarificationForTenant` for office resolutions.
    - Updated `markProjectShareNotificationSeenForTenant` to include resolution logic.
- **API Routes**: 
    - `POST /api/portal/projects/[shareToken]/clarify` (Customer side)
    - `POST /api/projects/[flowGroupId]/share/resolve-clarification` (Office side)
- **Read Model & DTO**: Updated `ProjectEvidenceRollupDto` and `getProjectEvidenceRollupReadModel` to include and map the new clarification fields.
- **Customer Portal**: 
    - Updated `ProjectEvidenceRollupView` to allow customers to request clarification.
    - Added display for clarification status and resolution notes.
- **Office UI**: 
    - Updated `ProjectShareControls` to show unresolved clarification requests and provide a resolution form.
    - Updated notification detection logic to include both project acknowledgments and clarification requests.

## Project Clarification Contract
- **Durable State**: Clarification requests and resolutions are persisted at the `FlowGroup` level.
- **Acknowledgment Reset**: Requesting a clarification automatically resets the project acknowledgment state (as the customer is indicating the view is not yet accepted).
- **Reopen Behavior**: Submitting a new clarification request after a resolution clears the previous resolution status and reopens the notification for office users.

## Office Notification/Visibility Behavior
- **Alerting**: Office users see a prominent alert card on the project evidence page when a customer has an unresolved clarification request or a new project activity.
- **Seen Logic**: Marking a notification as seen or resolving a clarification updates the `publicShareNotificationLastSeenAt` timestamp, clearing the alert.

## Tests Added
- `scripts/integration/project-clarification.integration.test.ts` (Run and deleted) verified the full loop:
    - Customer request correctly triggers an unresolved state and unseen notification.
    - Office resolution correctly updates the resolution status and marks the notification as seen.
    - New requests correctly clear previous resolutions and reopen notifications.

## What was Intentionally Left Out
- **Threaded Chat**: No support for multiple messages or conversation history.
- **Milestone Clarifications**: Clarification is scoped to the overall project roll-up view.
- **Email/SMS Alerts**: Notifications are purely in-app on the project evidence page.

## Next Recommended Epic
**Project Portal Response Notifications**: While we have in-app alerts, the next step is to provide more active notifications (like email/SMS) to office users when customers take significant actions on the project portal, mirroring the flow-level notification system.
