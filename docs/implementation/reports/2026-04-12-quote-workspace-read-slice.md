# After-action report: quote workspace read — 2026-04-12

## 1. Objective

Provide a **single read** surface that composes **quote shell** (quote + customer + flow group) and **full quote-version history** with a **latest-version shortcut** and **route hints**, so office users need fewer round-trips to navigate commercial work without building an editor.

## 2. Scope completed

- **`GET /api/quotes/[quoteId]/workspace`** — `requireApiPrincipalWithCapability("read")`; **404** `NOT_FOUND` when the quote is not in the tenant.
- **`QuoteWorkspaceDto`**: `quote`, `customer`, `flowGroup`, **`versions`** (same item shape and **versionNumber descending** order as `GET /api/quotes/:quoteId/versions`), **`latestQuoteVersionId`** (= `versions[0]?.id`), **`routeHints`** (static template strings for related APIs).
- **One Prisma query** in `getQuoteWorkspaceForTenant` (no internal HTTP calls to other routes).
- **Exported** `mapQuoteVersionRowToHistoryItem` from `quote-version-history-reads.ts` so workspace and history share one mapper (no drift in version row shape).
- **Dev page** `/dev/quotes/[quoteId]` — server-rendered workspace summary + links to scope, lifecycle/freeze JSON, customer/FG JSON, workspace/versions JSON.
- **Dev quote list** — link “Workspace (dev)” per quote.
- **Integration smoke:** unauthenticated workspace **401**; office workspace **200** with consistent ids; tenant B **404**.

## 3. Files changed (grouped by purpose)

| Purpose | Files |
|--------|--------|
| History mapper export | `src/server/slice1/reads/quote-version-history-reads.ts` |
| Workspace read | `src/server/slice1/reads/quote-workspace-reads.ts` |
| Slice1 exports | `src/server/slice1/index.ts` |
| API | `src/app/api/quotes/[quoteId]/workspace/route.ts` |
| Dev UI | `src/app/dev/quotes/[quoteId]/page.tsx`, `src/app/dev/quotes/page.tsx` |
| Smoke | `scripts/integration/auth-spine.integration.test.ts` |
| This report | `docs/implementation/reports/2026-04-12-quote-workspace-read-slice.md` |

## 4. Workspace / read decisions applied

| Topic | Decision |
|--------|-----------|
| **Latest version** | **`latestQuoteVersionId`** = id of the first row in **`versions`** (list sorted **`versionNumber` desc**) — same rule as quote list’s “latest” and version history API. |
| **Version rows** | **`QuoteVersionHistoryItemDto[]`** — identical fields to history read (status, sent/signed timestamps, flags, `proposalGroupCount`). |
| **Route hints** | **Literal strings** with `:quoteId` / `:quoteVersionId` placeholders — documentation for clients, not server-side link building. |
| **Capability** | **`read`** — workspace is visibility/navigation only. |

## 5. Behavioral impact

- Clients can replace **separate** `GET /api/quotes/:id` + `GET …/versions` calls with **one** workspace call when a full snapshot is enough; existing endpoints remain unchanged.

## 6. Validation performed

- `npm run build` — after implementation.

## 7. Known gaps / follow-ups

- **No mutation** hints beyond static `POST …/versions` string (no idempotency or body docs in DTO).
- **No embedded** scope/lifecycle payloads — only links/hints + ids.
- **No home-page** marketing link (dev list entry is sufficient for this slice).

## 8. Risks / caveats

- **Payload size** grows with version count; no pagination on workspace (same as history list today).

## 9. Bridged routes (explicit)

| Use | Hint / path |
|-----|----------------|
| Version list (same shape subset) | `routeHints.versionHistoryGet` |
| Next draft clone | `routeHints.nextVersionPost` |
| Draft scope | `routeHints.quoteVersionScopeGet` |
| Lifecycle / freeze reads | `quoteVersionLifecycleGet`, `quoteVersionFreezeGet` |
| Customer / FG discovery | `customerDetailGet`, `flowGroupDetailGet` |

## 10. Recommended next step

- **Thin office UI** consuming `workspace` + `routeHints`, or **workspace pagination** if version counts grow large.
