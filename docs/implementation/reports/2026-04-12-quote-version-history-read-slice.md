# After-action report: quote-version history read — 2026-04-12

## 1. Objective

Expose **full `QuoteVersion` history** for a tenant-owned **quote** over **`GET /api/quotes/[quoteId]/versions`**, so read-capable users can see every version, ordering, and lightweight lifecycle hints—then open existing **`/api/quote-versions/{id}/…`** routes (scope, lifecycle, freeze, send, etc.) without ad-hoc DB access or guessing ids.

## 2. Scope completed

- **`GET /api/quotes/[quoteId]/versions`** — `requireApiPrincipalWithCapability("read")`; resolves quote by **`id` + `tenantId`**; **404** `NOT_FOUND` if missing (wrong tenant or unknown id).
- **Stable DTO** `QuoteVersionHistoryReadDto`: `quoteId`, `quoteNumber`, `versions[]`.
- **Per-version** `QuoteVersionHistoryItemDto`: `id`, `versionNumber`, `status`, `createdAt`, `sentAt`, `signedAt`, `title`, `hasPinnedWorkflow`, `hasFrozenArtifacts` (plan/package snapshot **hash presence**, not values), `proposalGroupCount`, `hasActivation`.
- **Single Prisma round-trip** via `quote.findFirst` + nested `versions` select (ordered **`versionNumber` descending** — **newest / highest version first**).
- **Dev:** link from **`/dev/quotes`** to **`/api/quotes/{id}/versions`** (JSON).
- **Integration smoke:** unauthenticated **401**; office creates shell → history **200** with expected v1 draft flags; tenant B **404**.

**Not added:** `GET /api/quote-versions/[id]` summary-only route — existing subtree already exposes **scope**, **lifecycle**, **freeze**, etc.; history list supplies **ids** for those links.

## 3. Files changed (grouped by purpose)

| Purpose | Files |
|--------|--------|
| Read model | `src/server/slice1/reads/quote-version-history-reads.ts` |
| Slice1 exports | `src/server/slice1/index.ts` |
| API route | `src/app/api/quotes/[quoteId]/versions/route.ts` |
| Dev navigation | `src/app/dev/quotes/page.tsx` |
| Integration smoke | `scripts/integration/auth-spine.integration.test.ts` |
| This report | `docs/implementation/reports/2026-04-12-quote-version-history-read-slice.md` |

## 4. Version-history decisions applied

| Topic | Decision |
|--------|-----------|
| **Ordering** | **`versionNumber` descending** — first row is the numerically latest version (aligns with “latest first” mental model for history UIs). |
| **Tenant** | Quote must exist under **`principal.tenantId`**; versions are loaded only under that quote (no cross-quote leak). |
| **Freeze signal** | **`hasFrozenArtifacts`** = `planSnapshotSha256 != null \|\| packageSnapshotSha256 != null` — booleans only; **no** snapshot JSON or hash strings on the wire. |
| **Activation** | **`hasActivation`** = optional `activation` row exists — cheap `select: { id: true }`. |
| **Pinned workflow** | **`hasPinnedWorkflow`** from `pinnedWorkflowVersionId != null`. |

## 5. Behavioral impact

- From **quote list/detail** or **history JSON**, clients can open **`GET/POST /api/quote-versions/{versionId}/scope`**, **`…/lifecycle`**, **`…/freeze`**, **`…/send`**, etc., using **`versions[].id`**.

## 6. Validation performed

- `npm run build` — expected pass after implementation.

## 7. Known gaps / follow-ups

- **No version create/clone**, compare, or editor APIs.
- **No pagination** if a quote ever has very many versions (unusual today).
- **No aggregate “current working version”** flag beyond position in list (first row = highest `versionNumber`).

## 8. Risks / caveats

- **`hasFrozenArtifacts`** is a **proxy** for freeze progress, not a substitute for **`GET …/freeze`** semantics.
- **`hasActivation`** does not describe runtime health — use existing activation/flow routes when needed.

## 9. Bridge to existing routes (explicit)

For each **`versions[i].id`**:

| Intent | Route (existing) |
|--------|-------------------|
| Draft / line scope | `GET /api/quote-versions/{id}/scope` |
| Lifecycle / job shell hints | `GET /api/quote-versions/{id}/lifecycle` |
| Freeze read | `GET /api/quote-versions/{id}/freeze` |
| Compose preview | `POST /api/quote-versions/{id}/compose-preview` |
| Send / sign / activate | `POST …/send`, `…/sign`, `…/activate` (office-gated) |

## 10. Recommended next step

- **Controlled new-version (clone) mutation** behind `office_mutate`, or **quote-version GET summary** aligned with this DTO if clients need a single-id fetch without loading scope.
