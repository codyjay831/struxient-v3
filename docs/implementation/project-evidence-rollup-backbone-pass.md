# Project Evidence Roll-up Backbone

## Mission
Implement the smallest durable roll-up backbone for verified evidence across all relevant flows in a FlowGroup / project.

## What Changed
- **Schema**: Added `publicShareToken`, `publicShareStatus`, `publicShareTokenGeneratedAt`, and `publicShareExpiresAt` to the `FlowGroup` model to enable project-level sharing governance.
- **Read Model**: Created `getProjectEvidenceRollupReadModel` to aggregate evidence stats across all flows in a project.
- **Mutation**: Created `manageProjectShareForTenant` to handle project-level publishing and expiration.
- **Office UI**: Added a Project Evidence Roll-up page to the office interface for aggregating progress across multiple flows.

## Exact Files Changed
- `prisma/schema.prisma`
- `src/lib/project-evidence-rollup-dto.ts` (New)
- `src/server/slice1/reads/project-evidence-rollup.ts` (New)
- `src/server/slice1/mutations/project-share.ts` (New)
- `src/app/(office)/projects/[flowGroupId]/evidence/page.tsx` (New)
- `src/app/(office)/flows/[flowId]/page.tsx` (Updated with link to roll-up)

## Roll-up Truth Contract
- **Aggregation Level**: `FlowGroup` (mapped to `Job`).
- **Evidence Source**: Child `Flows` associated with the `Job`.
- **Inclusion Rules (Office)**: Includes all child flows, providing a comprehensive view of project progress.
- **Inclusion Rules (Public)**: Includes only `PUBLISHED` child flows. If a project-level share token is used, it respects project-level expiration.
- **Stats**: Aggregates `totalTasks`, `completedTasks`, and `acceptedTasks` (verified) across all included flows.

## Relationship to Flow-Level Share Governance
The project roll-up **respects** child-flow share governance for public views. A customer viewing a project roll-up only sees evidence for flows that have been individually `PUBLISHED` by the office.

## Viewing Surface
- **Office**: `/projects/[flowGroupId]/evidence` - A summary of all flows in the project with progress bars and verification stats.
- **Public**: The backbone is ready for a `/portal/projects/[shareToken]` page, but it is not yet fully implemented in the portal UI in this pass (staying narrow).

## Tests Added
- `scripts/integration/project-rollup.integration.test.ts` (Run and deleted) verified:
    - Office view sees all flows.
    - Public view only sees `PUBLISHED` flows.
    - Project-level expiration blocks access.

## What was Intentionally Left Out
- **Full Project Portal UI**: The portal-side page for project-level roll-up is not built yet to keep scope narrow.
- **Task-Level Detail in Roll-up**: The roll-up currently shows flow-level summaries; a detailed interleaved task view is deferred.
- **Project-Level Delivery**: Sending the project-level link (email/SMS) is deferred to a follow-up.

## Next Recommended Epic
**Project Portal Execution**: Now that the roll-up backbone exists, the next step is to build the customer-facing project portal page that uses the project-level share token and provides a unified project dashboard.
