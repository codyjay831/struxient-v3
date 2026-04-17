# After-action: follow-ups — job read, skeleton skip, auto-activate on sign

**Date:** 2026-04-11

## 1. `GET /api/jobs/[jobId]`

- Tenant-scoped (`requireTenantJson`), **404** if job id not in tenant.
- **`data`**: `job` (id, createdAt, flowGroupId), `flowGroup` (id, name, customerId), `flows[]` each with `activation`, ordered `runtimeTasks` (id, packageTaskId, nodeId, lineItemId, displayTitle, createdAt).
- Read path: `getJobShellReadModel`, DTO `toJobShellApiDto`.

## 2. Skeleton slot skipping (forward-compatible)

- **`parseExecutionPackageSnapshotV0ForActivation`** skips slots with **`source === "WORKFLOW"`** or non-empty string **`skeletonTaskId`** (manifest v0 still uses `skeletonTaskId: null`).
- Returns **`skippedSkeletonSlotCount`**; **`ActivateQuoteVersionSuccessDto`** includes **`skippedSkeletonSlotCount`** (replay returns `0`).
- Activation audit payload records **`skippedSkeletonSlotCount`**.

## 3. `Tenant.autoActivateOnSign`

- Migration **`20260415103000_tenant_auto_activate_on_sign`**: `BOOLEAN NOT NULL DEFAULT false`.
- When **true**, successful **non-replay** `POST …/sign` calls **`activateQuoteVersionInTransaction`** in the **same** transaction after `QUOTE_VERSION_SIGNED`.
- On activation failure: transaction **rolls back** (no signature); API **`SIGN_ROLLED_BACK_AUTO_ACTIVATE_FAILED`** with nested **`activation`** error (same shape as POST …/activate).
- **Idempotent sign replay** does not re-run auto-activate (activation should already exist or use POST …/activate).
- Seed sets **`autoActivateOnSign: false`** for SeedCo.

## 4. Refactors

- **`activateQuoteVersionInTransaction(tx, …)`** + **`activateQuoteVersionForTenant`** wraps it.
- **`nextResponseForActivateQuoteFailure`** shared by activate route and sign error wrapper.
- **`AutoActivateAfterSignError`** thrown from sign transaction.

## 5. TaskExecution (deferred)

- **Not** in this change. **`TaskExecution`** append-only start/complete (**Phase 7**, `epic 41`, `canon/04`) remains a separate slice after eligibility and field APIs are defined.

## Files touched (summary)

- `prisma/schema.prisma`, `prisma/migrations/20260415103000_tenant_auto_activate_on_sign/migration.sql`, `prisma/seed.js`
- `src/server/slice1/mutations/activate-quote-version.ts`, `sign-quote-version.ts`
- `src/server/slice1/compose-preview/execution-package-for-activation.ts`
- `src/lib/api/activate-quote-failure-response.ts`
- `src/app/api/quote-versions/[quoteVersionId]/activate/route.ts`, `sign/route.ts`
- `src/server/slice1/reads/job-shell.ts`, `src/lib/job-shell-dto.ts`, `src/app/api/jobs/[jobId]/route.ts`
- `src/server/slice1/index.ts`, `src/app/page.tsx`, `.env.example`
