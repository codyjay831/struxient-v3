# Project Response Notification Hardening

## Mission
Implement the smallest durable hardening layer for project-level customer response notifications.

## What Changed
- **Schema**: Added `PROJECT_SHARE_MANAGED` to `AuditEventType` to provide first-class audit coverage for project sharing actions (Acknowledgment, Clarification, Resolution).
- **Mutations**: Updated `manageProjectShareForTenant`, `acknowledgeProjectShareReceipt`, `requestProjectShareClarification`, and `resolveProjectShareClarificationForTenant` to use the new `PROJECT_SHARE_MANAGED` event type.
- **Read Model & DTO**: Hardened the notification contract by centralizing state calculation in the read model:
    - Added `notificationPriority` ("NONE" | "INFO" | "URGENT") to `ProjectEvidenceRollupDto`.
    - Added `isClarificationUnresolved` (boolean) to `ProjectEvidenceRollupDto`.
- **Office UI**: 
    - Updated `ProjectShareControls` to use the centralized priority state.
    - Added visual distinction between "URGENT" (Clarification Requested) and "INFO" (Acknowledgment) alerts.
    - Ensured that "URGENT" alerts are more prominent (amber color) compared to "INFO" alerts (emerald color).

## Notification Contract & Priority
- **NONE**: No new activity since the notification was last marked as seen.
- **INFO**: Customer has acknowledged receipt of the project roll-up, but the notification has not yet been marked as seen by an office user.
- **URGENT**: Customer has requested a clarification, which takes priority over other acknowledgment events. This state remains URGENT until either marked seen or resolved.

## Seen/Dismiss Behavior
The "Dismiss" action updates the `publicShareNotificationLastSeenAt` timestamp, which clears the `notificationPriority`. However, an "URGENT" clarification remains marked as `isClarificationUnresolved: true` until an explicit resolution is provided by the office.

## Tests Added
- `scripts/integration/project-notification-hardening.integration.test.ts` (Run and deleted) verified the priority logic:
    - Acknowledgment triggers "INFO".
    - Clarification triggers "URGENT", even if acknowledgment occurred previously.
    - Marking as seen clears the priority but preserves the unresolved clarification state.

## What was Intentionally Left Out
- **Global Office Alert System**: Notifications remain local to the project evidence dashboard.
- **External Escalation**: No email/SMS notifications to office staff were added as no existing internal alert pattern was found in the codebase.
- **Task-Level Alerts**: Notifications remain at the project (FlowGroup) level.

## Next Recommended Epic
**Project Portal Response Provider Automation**: Now that the notification logic is hardened, the next step is to explore provider-level automation for project-level responses, such as automatically notifying office users via external channels (Email/SMS) when urgent clarifications are requested, reusing the communication patterns established for individual flows.
