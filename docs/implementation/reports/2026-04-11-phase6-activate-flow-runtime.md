# After-action: Phase 6 shell — activate, Flow, RuntimeTask

**Date:** 2026-04-11  
**Intent:** First **idempotent activation** transaction aligned with **`docs/canon/03-quote-to-execution-canon.md`** and **`docs/epics/33-activation-epic.md`**: **SIGNED** quote version with valid freeze → **Flow** (pinned workflow) + **RuntimeTask** rows from **`executionPackageSnapshot.v0`** + **Activation** row + **`QUOTE_VERSION_ACTIVATED`** audit. **Job** is **reused** from sign (**`decisions/04`**).

## Schema

- Migration **`20260414120000_phase6_flow_activation_runtime`** (applied **after** Phase 5 Job/sign migration so `Job` FK exists).
- **`Flow`**: `tenantId`, `jobId`, `workflowVersionId`, unique `quoteVersionId`.
- **`Activation`**: unique `quoteVersionId`, unique `flowId`, `packageSnapshotSha256`, `activatedById`.
- **`RuntimeTask`**: unique `(flowId, packageTaskId)`; stores `nodeId`, `lineItemId`, `planTaskIds` (JSON), `displayTitle`.
- **`AuditEventType.QUOTE_VERSION_ACTIVATED`**.

## API

- **`POST /api/quote-versions/[quoteVersionId]/activate`**  
  Optional JSON: `{ "activatedByUserId": "<userId>" }` (defaults `signedBy` / `createdBy`).  
  **409** if not `SIGNED`, missing freeze blobs, hash mismatch, or missing `Job`.  
  **400** if package JSON does not match `executionPackageSnapshot.v0` shape.

## Integrity checks

- Canonical **SHA-256** of `executionPackageSnapshot` must match stored **`packageSnapshotSha256`** (same canonicalization as send/freeze).
- **`pinnedWorkflowVersionId`** inside the frozen package must match the quote version’s pin.

## Lifecycle read

- **`GET …/lifecycle`** now includes **`flow`** (with `runtimeTaskCount`) and **`activation`** when present.

## Deferred

- **WORKFLOW** skeleton slots (if introduced later) must still be **skipped** for `RuntimeTask` per canon — v0 compose emits manifest-originated slots only.
- **TaskExecution**, payment gates on runtime, auto-activate on sign, tenant policy flags.

## Files touched (summary)

- `prisma/schema.prisma`, `prisma/migrations/20260414120000_phase6_flow_activation_runtime/migration.sql`
- `src/server/slice1/compose-preview/execution-package-for-activation.ts`
- `src/server/slice1/mutations/activate-quote-version.ts`
- `src/app/api/quote-versions/[quoteVersionId]/activate/route.ts`
- `src/server/slice1/reads/quote-version-lifecycle.ts`, `src/lib/quote-version-lifecycle-dto.ts`
- `src/server/slice1/index.ts`, `src/app/page.tsx`

## Windows note

If **`npx prisma generate`** fails with **EPERM** on `query_engine-windows.dll.node`, stop **`npm run dev`**, regenerate, restart.
