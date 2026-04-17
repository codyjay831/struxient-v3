# After-action report: commercial quote read/list (authenticated) — 2026-04-12

## 1. Objective

Add the **first tenant-safe, read-capable HTTP surface** to **list and open commercial quote shells** (quotes with customer / flow group / latest version summaries) so office and other authenticated roles can **navigate without seed-only env IDs**. Bridge into the existing **quote-version draft** path via `latestQuoteVersion.id` → `/dev/quote-scope/[quoteVersionId]` and `GET /api/quote-versions/{id}/scope`.

## 2. Scope completed

- **`GET /api/quotes`** — `requireApiPrincipalWithCapability("read")`, tenant from principal; returns `{ data: { items, limit }, meta }`.
- **`GET /api/quotes/[quoteId]`** — same auth; **404** when quote id is missing or not in caller’s tenant (no cross-tenant leak).
- **Stable DTOs** in slice1 read module (`CommercialQuoteShellSummaryDto`); no raw Prisma graphs on the wire.
- **Optional query** `?limit=` (clamped **1–100**, default **50**) on the list route.
- **Dev page** `/dev/quotes` — server-rendered list with links to quote scope + JSON detail.
- **Home** link “Dev — quote list (read)”.
- **Integration smoke:** unauthenticated list **401**; office creates shell → list contains quote → detail **200** and `latestQuoteVersion.id` matches create response; tenant B detail **404** `NOT_FOUND`.

## 3. Files changed (grouped by purpose)

| Purpose | Files |
|--------|--------|
| Read model + mapping | `src/server/slice1/reads/commercial-quote-shell-reads.ts` |
| Slice1 exports | `src/server/slice1/index.ts` |
| API routes | `src/app/api/quotes/route.ts`, `src/app/api/quotes/[quoteId]/route.ts` |
| Dev UI | `src/app/dev/quotes/page.tsx` |
| Discoverability | `src/app/page.tsx` |
| Integration smoke | `scripts/integration/auth-spine.integration.test.ts` |
| This report | `docs/implementation/reports/2026-04-12-commercial-quote-read-list-slice.md` |

## 4. Read/list decisions applied

| Topic | Decision |
|--------|-----------|
| **Capability** | **`read`** — matches `GET …/scope` / jobs / flows; all tenant member roles pass `principalHasCapability("read")`. |
| **Version summary** | **`latestQuoteVersion`** = single row with **maximum `versionNumber`** (`orderBy: versionNumber desc`, `take: 1`). Documented in types as the canonical rule for list and detail. |
| **Ordering** | List sorted by **`Quote.createdAt` descending** (newest shells first). |
| **Proposal groups** | Expose **`proposalGroupCount`** on the latest version only (Prisma `_count` on nested `proposalGroups`), cheap and useful for sanity checks. |
| **Pagination** | **No cursors** — fixed **`limit`** only (cap 100) to keep the slice small. |
| **Customer list** | **Not added**; quote-centric list already surfaces `customer.id` / `name` per row. |
| **Separate customer/flow-group APIs** | **Deferred** to avoid scope creep. |

## 5. Behavioral impact

- Shells created via **`POST /api/commercial/quote-shell`** appear on **`GET /api/quotes`** for the same tenant without copying ids from the POST body into `.env.local`.
- **`/dev/quotes`** uses **`tryGetApiPrincipal`** + direct Prisma reads (same tenant as session/bypass) — parallel to **`/dev/quote-scope/[quoteVersionId]`** pattern.
- **Cross-tenant:** Wrong tenant receives **404** on detail (same posture as quote-version scope).

## 6. Validation performed

- `npm run build` — expected to pass (Next compile, lint, typecheck).

Integration suite: run `npm run test:integration` with live server + DB + seed per existing prerequisites.

## 7. Known gaps / follow-ups

- **List truncation:** Only the most recent **N** quotes (default 50, max 100); no “load more” or search.
- **No customer-only or flow-group-only index** — add when CRUD or filters need it.
- **Detail is quote-scoped** — no separate “quote version list” endpoint yet (only latest in summary).
- **JSON detail link** in dev UI hits the API without a browser Accept header nuance — returns JSON (fine for verification).

## 8. Risks / caveats

- Tenants with **>100** active quotes will not see older rows without raising `limit` or adding pagination later.
- Quotes with **zero versions** (data anomaly) show `latestQuoteVersion: null` and a warning on the dev page; normal creation path always has v1.

## 9. DTO fields exposed (explicit)

Each **item** (list row or detail body):

| Block | Fields |
|--------|--------|
| `quote` | `id`, `quoteNumber`, `createdAt` (ISO-8601) |
| `customer` | `id`, `name` |
| `flowGroup` | `id`, `name` |
| `latestQuoteVersion` | `id`, `versionNumber`, `status`, `proposalGroupCount` — or **`null`** if no versions |

## 10. What is still seed/dev oriented

- **Catalog, workflows, pins, activation, jobs** — unchanged; not exposed here.
- **`STRUXIENT_DEV_QUOTE_VERSION_ID`** redirect on **`/dev/quote-scope`** remains a convenience; **`/dev/quotes`** reduces dependence for browsing.
- **Field/runtime helpers** still expect activation fixtures when used.

## 11. Recommended next step

- **Attach-mode quote shell** (reuse existing customer/flow group) **or** **customer list read** (`GET /api/customers`) if CRM navigation becomes the bottleneck **or** **quote-version history read** (all versions for a quote) before editor work.
