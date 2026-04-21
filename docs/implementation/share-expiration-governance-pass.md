# Share Expiration Governance Pass

## Mission
Implement the smallest durable expiration-governance layer for customer share access.

## Changes

### Schema Updates
- Added `publicShareExpiresAt` (DateTime?) to the `Flow` model in `prisma/schema.prisma`.
- Sync'd schema with `npx prisma db push`.

### Access Enforcement
- **Portal Viewer**: Updated `getFlowEvidenceReportReadModel` in `src/server/slice1/reads/flow-evidence-report.ts` to block access if `publicShareExpiresAt` is set and has passed.
- **Media Retrieval**: Updated `src/app/api/media/[storageKey]/route.ts` to include an expiration check when a share token is used for access.

### Server Mutations & API
- Updated `manageFlowShareForTenant` in `src/server/slice1/mutations/flow-share.ts`:
  - Added `SET_EXPIRATION` action.
  - Added optional `expiresAt` parameter.
  - Audits expiration changes.
- Updated `POST /api/flows/[flowId]/share` to support the new action and field.

### Server Reads & DTOs
- Updated `FlowExecutionReadModel` and `FlowExecutionApiDto` to include `publicShareExpiresAt`.
- Updated `FlowEvidenceReportDto` to include `expiresAt` for customer visibility.

### Office UI
- Updated `FlowShareControls` in `src/components/execution/flow-share-controls.tsx`:
  - Added an **Expiration Section** that shows the current expiry status.
  - Added an **"Edit Expiry"** workflow allowing office users to set or clear a date-bound expiration.
  - Highlights expired state with a red indicator.

### Portal UI
- Updated `FlowEvidenceReportView` in `src/components/report/flow-evidence-report-view.tsx` to display the access expiration date to the customer if one is set.

## Verified
- Created an integration test `scripts/integration/customer-share-expiration.integration.test.ts` that verified:
  1. Access is allowed when no expiration is set.
  2. Access is allowed when expiration is in the future.
  3. Access is blocked (returns null/404) when expiration is in the past.
  4. Manual revocation works independently of expiration.
- Manually verified UI workflows for setting and clearing expiration.

## Next Step
**Verification & Audit Finalization**: Now that the full lifecycle (share -> deliver -> view -> response -> resolve -> expire) is implemented, the final step is a comprehensive audit and verification pass to ensure all cross-epic interactions are stable and ready for production.
