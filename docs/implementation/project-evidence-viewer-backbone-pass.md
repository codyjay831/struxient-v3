# Project Evidence Viewer Backbone

## Mission
Implement the smallest durable customer-facing viewer for project-level evidence roll-up.

## What Changed
- **Read Model**: Updated `getProjectEvidenceRollupReadModel` to enforce strict public visibility rules. For public views, only child flows that are both `PUBLISHED` and NOT `EXPIRED` are included.
- **DTO**: Updated `ProjectEvidenceRollupFlowDto` to include `publicShareToken` and `publicShareExpiresAt` for child flows.
- **Portal Viewer**: Created a new customer-facing project viewer component and route.
- **Office UI**: Enhanced the project roll-up view in the office to show child-flow expiration status.

## Exact Files Changed
- `src/lib/project-evidence-rollup-dto.ts`
- `src/server/slice1/reads/project-evidence-rollup.ts`
- `src/components/report/project-evidence-rollup-view.tsx` (New)
- `src/app/portal/projects/[shareToken]/page.tsx` (New)
- `src/app/(office)/projects/[flowGroupId]/evidence/page.tsx`

## Project-Viewer Truth Contract
- **Project Inclusion**: Project must be `PUBLISHED` and not expired at the project level.
- **Child Flow Inclusion**: Even if a project is shared, child flows are only visible in the rollup if they are individually `PUBLISHED` and not expired at the flow level.
- **Auditability**: The project viewer links to individual flow reports (`/portal/flows/[token]`), preserving the full auditable detail and existing media security patterns of each flow.

## Relationship to Flow-Level Share Governance
The project viewer layers on top of flow-level governance. It acts as a directory of shared flows. If a flow is revoked or expires, it immediately disappears from the project viewer, even if the project link remains active.

## Viewer Route
Customers can access the project roll-up at `/portal/projects/[shareToken]`.

## Tests Added
- `scripts/integration/project-viewer.integration.test.ts` (Run and deleted) verified:
    - Public project view correctly filters out unpublished or expired child flows.
    - Project-level expiration correctly blocks the entire roll-up view.

## What was Intentionally Left Out
- **Aggregated Task Log**: Interleaving every task from every flow into one list was deferred to keep the view focused and performant.
- **Project-Level Responses**: Acknowledgments and clarifications currently remain at the individual flow level.
- **Project Link Delivery**: Manual link generation is supported, but automated delivery is deferred.

## Next Recommended Epic
**Project Portal Interaction & Delivery**: Now that the viewer exists, the next step is to add project-level "Seen" telemetry and a project-level delivery bridge (Email/SMS) for the project link.
