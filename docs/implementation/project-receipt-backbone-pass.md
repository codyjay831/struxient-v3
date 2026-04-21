# Project Receipt Backbone

## Mission
Implement the smallest durable project-level receipt acknowledgment layer for the customer-facing project viewer.

## What Changed
- **Schema**: Added `publicShareReceiptAcknowledgedAt` to the `FlowGroup` model to persist project-level acknowledgment status.
- **Mutations**: 
    - Created `acknowledgeProjectShareReceipt` in `src/server/slice1/mutations/project-share-response.ts`.
    - Updated `manageProjectShareForTenant` to reset acknowledgment on project `REGENERATE`.
    - Updated `manageFlowShareForTenant` to reset parent project acknowledgment whenever a child flow's share status is changed (`PUBLISH`, `REVOKE`, `REGENERATE`), ensuring the customer is re-prompted when the project truth changes.
- **API Routes**: Added `POST /api/portal/projects/[shareToken]/acknowledge` for customer portal interaction.
- **Read Model & DTO**: Updated `ProjectEvidenceRollupDto` and its read model to include `publicShareToken` and `publicShareReceiptAcknowledgedAt`.
- **Portal UI**: Added an "Acknowledge Project Receipt" action section to the project dashboard.
- **Office UI**: 
    - Added an "Acknowledged" badge to the project share controls.
    - Included the acknowledgment timestamp in the project viewer telemetry card.

## Exact Files Changed
- `prisma/schema.prisma`
- `src/server/slice1/mutations/project-share.ts`
- `src/server/slice1/mutations/flow-share.ts`
- `src/server/slice1/mutations/project-share-response.ts` (New)
- `src/app/api/portal/projects/[shareToken]/acknowledge/route.ts` (New)
- `src/lib/project-evidence-rollup-dto.ts`
- `src/server/slice1/reads/project-evidence-rollup.ts`
- `src/components/report/project-evidence-rollup-view.tsx`
- `src/components/report/project-share-controls.tsx`
- `src/app/(office)/projects/[flowGroupId]/evidence/page.tsx`

## Project Receipt Contract
- **Definition**: A project acknowledgment signals that the customer has seen and accepted the project roll-up state as it existed at that moment.
- **Reset/Reopen Behavior**: 
    - **Regeneration**: If the office regenerates the project token, all responses are reset.
    - **Visibility Change**: If any child flow is published, revoked, or regenerated, the parent project's acknowledgment is automatically reset. This ensures the customer must re-acknowledge if the "project truth" has been updated with new or removed evidence.

## Office Visibility
Office users can see the "Acknowledged" status directly on the project evidence page, including the exact timestamp of the customer's action.

## Relationship to Flow Acknowledgment
Project-level acknowledgment is a distinct signal from individual flow-level acknowledgments. A customer can acknowledge the entire project dashboard even if they haven't explicitly acknowledged every individual flow report.

## Tests Added
- `scripts/integration/project-receipt.integration.test.ts` (Run and deleted) verified:
    - Successful project-level acknowledgment recording.
    - Reset of acknowledgment on project `REGENERATE`.
    - Reset of acknowledgment on child flow `PUBLISH`.

## What was Intentionally Left Out
- **Project-Level Clarifications**: The project portal currently only supports "Acknowledge". Questions/Clarifications still happen at the individual flow level for maximum audit precision.
- **Notification Alerts**: No automated alerts (email/Slack) are triggered for project-level acknowledgments in this pass.

## Next Recommended Epic
**Project Portal Notification Backbone**: Now that we have project-level delivery, telemetry, and receipt, the next step is to notify office users when these events occur, similar to the existing flow-level notification system.
