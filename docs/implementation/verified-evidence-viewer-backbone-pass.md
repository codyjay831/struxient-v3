# Implementation Report: Verified Evidence Viewer Backbone

## Mission
Implement the smallest durable customer-safe viewer for verified evidence/report truth. This epic exposes verified evidence safely in a read-only customer-facing view without requiring a full customer account or portal platform initially.

## What Changed
- **Schema**: Added `publicShareToken` (String, unique, optional) to the `Flow` model to allow tokenized read-only access to specific flow evidence.
- **Read Model**: Updated `getFlowEvidenceReportReadModel` to support fetching by `shareToken` as an alternative to `tenantId` + `flowId`.
- **API (Media)**: Updated the media download route (`/api/media/[storageKey]`) to allow access via a `token` query parameter, ensuring customers can view private media linked to the verified evidence log.
- **Components**:
    - Created `FlowEvidenceReportView` shared component to unify the report rendering for both office and portal routes.
    - Updated `MediaThumbnail` and `MediaViewerModal` to support an optional `token` for media retrieval.
- **Portal Route**: Added `/portal/flows/[shareToken]` as a public (tokenized) route for customers to view the Verified Evidence Log.
- **Office Integration**: Added a "🔗 Portal" link on the office flow execution page to let staff easily access/share the customer-facing view.
- **Status Derivation**: Hardened `deriveRuntimeExecutionSummary` with a millisecond-safe tie-breaker for event sorting to ensure correct status derivation during fast-firing execution/review cycles.

## Exact Files Changed
- `prisma/schema.prisma`
- `src/server/slice1/reads/flow-evidence-report.ts`
- `src/server/slice1/reads/derive-runtime-execution-summary.ts`
- `src/server/slice1/reads/flow-execution.ts`
- `src/app/api/media/[storageKey]/route.ts`
- `src/components/execution/execution-media-ux.tsx`
- `src/components/report/flow-evidence-report-view.tsx` (New)
- `src/app/(office)/flows/[flowId]/report/page.tsx`
- `src/app/(office)/flows/[flowId]/page.tsx`
- `src/app/portal/flows/[shareToken]/page.tsx` (New)
- `src/lib/flow-execution-dto.ts`

## Access & Truth Model
- **Access**: Access is granted via an obscure `publicShareToken` unique to each `Flow`. No login is required for this specific view, satisfying the "one customer-safe route" requirement.
- **Truth**: The viewer reuses the same verified evidence read model as the office report, ensuring consistency. It displays the interleaved log of skeleton and runtime tasks with their accepted proof.

## Media Handling
Media access for customers is secured by requiring the valid `shareToken` of the associated `Flow`. The media route verifies that the requested `storageKey` is indeed linked to a task within the flow identified by the token.

## Tests Added/Updated
- Created and successfully ran an integration test `scripts/integration/verified-evidence-viewer.integration.test.ts` (deleted after run) which verified:
    - Successful report retrieval via valid `publicShareToken`.
    - Correct verified status for accepted tasks in the public view.
    - Access denial when using an invalid token.
    - Compatibility with the derived status logic.

## What was Intentionally Left Out
- **Full Portal**: No customer account management, dashboard, or multi-job views.
- **Customer Interaction**: No ability for customers to comment, approve, or reject evidence (read-only only).
- **Branding**: No customer-specific branding or custom themes.

## Known Follow-up Gaps
- **Token Management**: No office-side UI to regenerate or revoke a `shareToken` yet.
- **Delivery**: No built-in email/SMS sharing of the portal link.
- **Authentication**: Future transition to full customer accounts if required.
