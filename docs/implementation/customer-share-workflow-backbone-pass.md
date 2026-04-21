# Implementation Report: Customer Share Workflow Backbone

## Mission
Implement the smallest durable office-side workflow for publishing, managing, and sharing the customer-facing verified evidence viewer. This pass moves the share-token mechanism from a basic persistence layer to a governed office-side workflow with explicit lifecycle controls (Publish, Revoke, Regenerate).

## What Changed
- **Schema**:
    - Added `PublicShareStatus` enum (`UNPUBLISHED`, `PUBLISHED`).
    - Added `publicShareStatus` (default: `UNPUBLISHED`) and `publicShareTokenGeneratedAt` (DateTime, optional) to the `Flow` model.
    - Updated `AuditEvent` to optionally track `targetFlowId` and added `FLOW_SHARE_MANAGED` event type for auditability of share actions.
- **Mutations**:
    - Created `src/server/slice1/mutations/flow-share.ts` with `manageFlowShareForTenant` to handle `PUBLISH`, `REVOKE`, and `REGENERATE` actions in an auditable way.
- **API (Share Governance)**:
    - Created `/api/flows/[flowId]/share` as a POST route for office users with the `office_mutate` capability to manage share settings.
- **Enforcement Layer**:
    - **Report Read Model**: Updated `getFlowEvidenceReportReadModel` to block tokenized retrieval unless `publicShareStatus` is `PUBLISHED`.
    - **Media Retrieval**: Updated `/api/media/[storageKey]` to block access via token unless the associated flow's `publicShareStatus` is `PUBLISHED`. Access remains through `taskExecution.flow` to handle both runtime and skeleton task evidence.
- **Office UI**:
    - Created `FlowShareControls` component providing a clear governance surface:
        - Visible share status (Published/Unpublished) with indicators.
        - "Publish Evidence" button for initial sharing.
        - "Copy Portal Link" for easy delivery.
        - "Regenerate Token" for rotating access.
        - "Revoke Access" for immediate removal of public availability.
    - Integrated these controls into the production flow execution page and the development work feed page.

## Exact Files Changed
- `prisma/schema.prisma`
- `src/server/slice1/mutations/flow-share.ts` (New)
- `src/app/api/flows/[flowId]/share/route.ts` (New)
- `src/server/slice1/reads/flow-evidence-report.ts`
- `src/server/slice1/reads/flow-execution.ts`
- `src/app/api/media/[storageKey]/route.ts`
- `src/lib/flow-execution-dto.ts`
- `src/components/execution/flow-share-controls.tsx` (New)
- `src/app/(office)/flows/[flowId]/page.tsx`
- `src/app/dev/work-feed/[flowId]/page.tsx`

## Token Lifecycle Behavior
- **Initial State**: All flows start as `UNPUBLISHED`. While a token exists by default (due to schema defaults), it is not functional for public retrieval until the office clicks "Publish".
- **Publish**: Sets status to `PUBLISHED`, making the evidence viewable.
- **Revoke**: Sets status to `UNPUBLISHED`. All existing public links immediately stop functioning.
- **Regenerate**: Generates a new `publicShareToken`. This immediately invalidates the old link, even if the status is `PUBLISHED`.

## Tests Added/Updated
- Created and successfully ran an integration test `scripts/integration/customer-share-workflow.integration.test.ts` which verified:
    - Tokenized access is blocked in `UNPUBLISHED` state.
    - Access is granted after `PUBLISH`.
    - Access is revoked after `REVOKE`.
    - Access works for new tokens after `REGENERATE`, while the old token remains blocked.
    - The test was subsequently deleted after verification.

## What was Intentionally Left Out
- **Automated Delivery**: No built-in email or SMS delivery system (the "Copy Link" workflow fulfills the minimal durable requirement).
- **Notifications**: No automated notifications to customers when evidence is published.
- **Permissions**: No granular controls (e.g., share ONLY certain tasks); sharing currently applies to the entire verified evidence log.

## Known Follow-up Gaps
- **Delivery Integration**: Future epics could integrate with an email provider (Postmark, SendGrid) for one-click delivery.
- **Access Logs**: No customer-specific access logging (to see who/when the link was opened).
- **Expiration**: No support for time-bound share links (e.g., expires in 7 days).
