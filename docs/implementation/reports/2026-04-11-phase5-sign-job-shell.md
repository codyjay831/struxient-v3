# After-action report: Phase 5 slice — sign + Job shell (go 3)

**Date:** 2026-04-11  
**Authority:** `docs/decisions/04-job-anchor-timing-decision.md`, epic 13 / 34 (minimal office-recorded sign).

---

## Objective

After **SENT**, allow **office-recorded acceptance**: transition **SENT → SIGNED**, **idempotently ensure one `Job` per `FlowGroup`**, persist **`QuoteSignature`**, append **`QUOTE_VERSION_SIGNED` audit**, and keep **freeze JSON** readable for **SENT** and **SIGNED**.

---

## Schema (migration `20260413100000_phase5_job_sign`)

| Change | Detail |
|--------|--------|
| `QuoteVersionStatus` | **`SIGNED`** |
| `AuditEventType` | **`QUOTE_VERSION_SIGNED`** |
| `QuoteSignatureMethod` | **`OFFICE_RECORDED`** |
| `Job` | `tenantId`, **`flowGroupId` @unique** (one job anchor per flow group) |
| `QuoteSignature` | **`quoteVersionId` @unique**, `recordedById`, `method`, `signedAt` |
| `QuoteVersion` | **`signedAt`**, **`signedById`** (optional FK to `User`) |

---

## Service

**`signQuoteVersionForTenant`** (`mutations/sign-quote-version.ts`):

- Transaction + **`FOR UPDATE`** on `QuoteVersion`.
- **Idempotent replay:** if already **`SIGNED`**, return job + signature ids (or **500** `signed_state_inconsistent` if rows missing).
- **Not `SENT`:** **409** path (`not_sent`).
- **`Job`:** `upsert` on **`flowGroupId`** (create with quote’s tenant).
- **`QuoteSignature`:** `OFFICE_RECORDED`, **`recordedById`** from body or **`sentById`** / **`createdById`**.
- **`AuditEvent`:** `QUOTE_VERSION_SIGNED` with `{ jobId, quoteSignatureId }`.

---

## HTTP

**`POST /api/quote-versions/[quoteVersionId]/sign`** — optional `{ "recordedByUserId": "…" }`.

| Result | HTTP |
|--------|------|
| Success / idempotent | **200** |
| Not found | **404** |
| Not SENT | **409** `QUOTE_VERSION_NOT_SENT` |
| Bad actor | **400** |
| Inconsistent SIGNED | **500** |

---

## Related adjustments

- **`GET …/freeze`:** allows **`SENT`** or **`SIGNED`**; draft still **409** (`QUOTE_VERSION_NOT_FROZEN`).
- **`POST …/send`:** **409** if status is **`SIGNED`** (clearer than generic sent conflict).

---

## Files (grouped)

- `prisma/schema.prisma`, `prisma/migrations/20260413100000_phase5_job_sign/migration.sql`
- `mutations/sign-quote-version.ts`, `app/api/quote-versions/[quoteVersionId]/sign/route.ts`
- `reads/quote-version-freeze.ts`, `app/api/quote-versions/[quoteVersionId]/freeze/route.ts`
- `mutations/send-quote-version.ts` (SIGNED guard)
- `server/slice1/index.ts`, `app/page.tsx`

---

## Validation

`npm run build` (after DB `migrate deploy`). Regenerate Prisma client if Windows file lock blocked `prisma generate`.

---

## Deferred

- Customer portal / e-sign, **Flow** + activation, **`createJobOnSign` tenant flag**, job status / void, portal signatures (epic 13 / 54).
