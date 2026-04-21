# Project Share Delivery Bridge

## Mission
Implement the smallest durable office-side delivery bridge for project-level evidence links.

## What Changed
- **Schema**: Added `ProjectShareDelivery` model and `PROJECT_SHARE_DELIVERED` audit event type to track durable delivery history for projects.
- **Mutations**: 
    - Created `sendProjectShareForTenant` in `src/server/slice1/mutations/project-share-delivery.ts` to handle project link delivery via Email/SMS.
    - Updated `src/server/comms/delivery-content.ts` with project-specific message templates.
- **API Routes**:
    - Added `POST /api/projects/[flowGroupId]/share/deliver` for initiating delivery.
    - Added `POST /api/projects/[flowGroupId]/share` for managing project-level governance (Publish/Revoke/Regenerate/Expiry).
- **Read Model & DTO**: Updated `getProjectEvidenceRollupReadModel` and `ProjectEvidenceRollupDto` to include full delivery history and prefill data (customer email/phone).
- **Office UI**: 
    - Created `ProjectShareControls` component for managing project sharing and delivery.
    - Integrated controls and delivery history into the office project evidence page.

## Exact Files Changed
- `prisma/schema.prisma`
- `src/server/comms/delivery-content.ts`
- `src/server/slice1/mutations/project-share-delivery.ts` (New)
- `src/app/api/projects/[flowGroupId]/share/deliver/route.ts` (New)
- `src/app/api/projects/[flowGroupId]/share/route.ts` (New)
- `src/lib/project-evidence-rollup-dto.ts`
- `src/server/slice1/reads/project-evidence-rollup.ts`
- `src/components/report/project-share-controls.tsx` (New)
- `src/app/(office)/projects/[flowGroupId]/evidence/page.tsx`

## Project Delivery Contract
- **Governance**: Delivery is strictly gated by project publish status. A project must be `PUBLISHED` before its link can be delivered.
- **Idempotency**: Prevents duplicate sends to the same recipient/method within a 1-minute window.
- **History**: Every delivery intent is recorded with method, recipient, timestamp, and provider status.
- **Prefill**: Recipient details are automatically prefilled from the associated `Customer` record.

## Office UI / History
Office users now have a unified "Project Share Status" card on the evidence roll-up page. This card allows them to:
- Publish/Revoke the project portal.
- Set or clear access expiration.
- Send the project link via Email, SMS, or record a manual share.
- View a durable history of all previous delivery attempts.

## Tests Added
- `scripts/integration/project-delivery.integration.test.ts` (Run and deleted) verified:
    - Delivery is blocked for unpublished projects.
    - Successful delivery records durable intent in the database.
    - Delivery history is correctly surfaced in the office read model.

## What was Intentionally Left Out
- **Delivery Reliability (Retries)**: Automated retries for failed project deliveries are deferred (individual flow deliveries have them, but the project bridge is kept narrow first).
- **Follow-up Automation**: Automated follow-up recommendations based on project "seen" state are deferred.
- **Multi-Recipient Sharing**: Sharing with multiple contacts beyond the primary customer record is deferred.

## Next Recommended Epic
**Project Portal Receipt & Acknowledgment**: Now that we can deliver the project link, the next step is to allow customers to acknowledge the entire project or individual stages directly from the roll-up view.
