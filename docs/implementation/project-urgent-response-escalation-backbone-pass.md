# Project Urgent Response Escalation Backbone

## Mission
Implement the smallest durable escalation layer for urgent project-level customer responses.

## What Changed
- **Schema**: Added `publicShareClarificationEscalatedAt` to the `FlowGroup` model to track when an unresolved project clarification has been escalated for office awareness.
- **Mutations**: 
    - Created `escalateProjectShareClarificationForTenant` in `src/server/slice1/mutations/project-share-response.ts`.
    - Updated `requestProjectShareClarification` to clear any existing `publicShareClarificationEscalatedAt` on new requests.
- **API Routes**: Added `POST /api/projects/[flowGroupId]/share/escalate` for office users to escalate a clarification.
- **Read Model & DTO**: Updated `ProjectEvidenceRollupDto` and `getProjectEvidenceRollupReadModel` to include and map the `publicShareClarificationEscalatedAt` field.
- **Office UI**: 
    - Updated `ProjectShareControls` to show an "Escalate" action for unresolved clarification requests.
    - Added an escalation marker (red indicator) when a clarification is escalated.
    - Improved priority signaling in the office view (red for escalated, amber for normal clarification, emerald for acknowledgment).

## Escalation Contract
- **Eligible Event**: Any unresolved project clarification request can be escalated.
- **Durable State**: Escalation is recorded with a timestamp in `publicShareClarificationEscalatedAt`.
- **Reset Behavior**: Escalation is automatically cleared when the clarification is resolved or if the customer submits a new clarification (which reopens the local notification state).

## Office Visibility
Office users see a clear "ESCALATED" label and a red pulse indicator when a project clarification has been explicitly escalated. This provides a clear visual signal that the clarification requires immediate attention beyond a standard notification.

## Tests Added
- `scripts/integration/project-escalation.integration.test.ts` (Run and deleted) verified:
    - Escalation correctly records a timestamp and persists in the read model.
    - Escalation is correctly cleared when a new clarification is requested (reopened).
    - Escalation status is correctly reflected in the project roll-up DTO.

## What was Intentionally Left Out
- **Global Office Alert System**: Escalation remains local to the project evidence dashboard.
- **Automated Routing**: No automated assignment or escalation to specific users.
- **Escalated Follow-ups**: No automated communication provider actions (Email/SMS) were added in this pass, as the bridge stops at the durable escalation intent.

## Next Recommended Epic
**Project Portal Status Hardening**: Now that we have a full lifecycle of sharing, delivery, telemetry, response, and escalation, the next step is to harden the overall project-level status model (e.g. project-wide "Verified" or "Action Required" statuses) to ensure coherence across all these interactions.
