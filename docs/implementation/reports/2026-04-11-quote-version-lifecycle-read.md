# After-action: quote version lifecycle read (Phase 5 → 6 bridge)

**Date:** 2026-04-11  
**Intent:** Thin vertical slice after sign + job shell: expose **tenant-scoped** lifecycle data (version status, `Job` via `FlowGroup`, `QuoteSignature`) without yet introducing `Flow`, `Activation`, or `RuntimeTask` (Phase 6).

## What shipped

- **`GET /api/quote-versions/[quoteVersionId]/lifecycle`** — same tenant resolution as other quote-version JSON routes (`requireTenantJson`).
- **`getQuoteVersionLifecycleReadModel`** — Prisma read: `QuoteVersion` → `Quote` → `FlowGroup.job`, plus `quoteSignature`.
- **`toQuoteVersionLifecycleApiDto`** — ISO-8601 for dates.
- **Dev** `…/dev/quote-scope/[quoteVersionId]` — second JSON block labeled `GET …/lifecycle`.
- **Home** — one-line pointer to the new route.

## Rationale

Phase 6 (activation + runtime materialization) is a larger migration. A **read-only lifecycle** endpoint lets integrators and dev pages confirm **SENT → SIGNED**, **Job** presence, and signature metadata before building **POST …/activate** (or equivalent).

## Deferred

- `Flow` / `Activation` / `RuntimeTask` (Phase 6).
- `GET /api/jobs/[id]` (optional follow-up if job-centric APIs are preferred over quote-scoped reads).

## Files touched (summary)

- `src/server/slice1/reads/quote-version-lifecycle.ts`
- `src/lib/quote-version-lifecycle-dto.ts`
- `src/app/api/quote-versions/[quoteVersionId]/lifecycle/route.ts`
- `src/server/slice1/index.ts` (export)
- `src/app/dev/quote-scope/[quoteVersionId]/page.tsx`
- `src/app/page.tsx`
