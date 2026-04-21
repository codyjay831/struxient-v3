# Project Viewer Telemetry Backbone

## Mission
Implement the smallest durable telemetry layer for the project-level evidence viewer so office users can see whether and when a project link has been accessed.

## What Changed
- **Schema**: Added `publicShareFirstViewedAt`, `publicShareLastViewedAt`, and `publicShareViewCount` to the `FlowGroup` model.
- **Mutation**: Created `recordProjectShareAccess` to track valid project-level portal accesses.
- **Portal Route**: Integrated `recordProjectShareAccess` into the `/portal/projects/[shareToken]` route to trigger on every valid view.
- **Read Model & DTO**: Updated `getProjectEvidenceRollupReadModel` and `ProjectEvidenceRollupDto` to include the new telemetry fields.
- **Office UI**: Added a "Project Viewer Telemetry" section to the office project evidence page to display access stats.

## Exact Files Changed
- `prisma/schema.prisma`
- `src/server/slice1/mutations/project-share-telemetry.ts` (New)
- `src/app/portal/projects/[shareToken]/page.tsx`
- `src/lib/project-evidence-rollup-dto.ts`
- `src/server/slice1/reads/project-evidence-rollup.ts`
- `src/app/(office)/projects/[flowGroupId]/evidence/page.tsx`

## Telemetry Contract
- **Meaning**: Tracks *access* to the project portal link, not comprehension or engagement with individual flows.
- **Fields**:
    - `viewCount`: Total number of times a valid project-level share token was used to load the portal.
    - `firstAccessedAt`: Timestamp of the very first valid access.
    - `lastAccessedAt`: Timestamp of the most recent valid access.

## Office Visibility
Office users can now see a dedicated telemetry card on the project evidence page. This card displays the total view count and the specific timestamps for first and last access, providing operational visibility into customer engagement.

## Relationship to Flow Telemetry
Project-level telemetry is distinct from Flow-level telemetry. Accessing the project portal records a view for the project, while clicking through to a specific flow report records a view for that flow. This preserves granular auditability.

## Tests Added
- `scripts/integration/project-telemetry.integration.test.ts` (Run and deleted) verified:
    - Initial telemetry is zeroed.
    - First access sets both `first` and `last` timestamps.
    - Subsequent access increments count and only updates `last` timestamp.
    - Office read model correctly surfaces these values.

## What was Intentionally Left Out
- **Session Tracking**: No tracking of unique visitors or session duration.
- **IP/Location Logging**: Telemetry is kept simple and operational.
- **Automated Notifications**: No alerts are triggered based on telemetry (e.g., "Customer just viewed the project").

## Next Recommended Epic
**Project Delivery Bridge**: Now that we can track access, the next step is to implement a project-level delivery bridge (Email/SMS) to automate the sharing of the project link.
