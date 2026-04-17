# After-action report: customer read/list (discovery) — 2026-04-12

## 1. Objective

Add the **first authenticated, tenant-scoped customer discovery API** so read-capable users can **list and open `Customer` rows by id** without seed-only env ids, supporting **`POST /api/commercial/quote-shell` attach-mode** (`customerId` + `flowGroupName` or + `flowGroupId`).

## 2. Scope completed

- **`GET /api/customers`** — `requireApiPrincipalWithCapability("read")`; `where: { tenantId }`; `orderBy: createdAt desc`; optional **`?limit=`** (default **50**, max **100**, same discipline as quotes).
- **`GET /api/customers/[customerId]`** — same capability; **`findFirst({ id, tenantId })`**; **404** `NOT_FOUND` when missing or wrong tenant (non-leak).
- **DTO** `CustomerSummaryDto` for list and detail: `id`, `name`, `createdAt` (ISO-8601), **`flowGroupCount`**, **`quoteCount`** (Prisma `_count` on `flowGroups` and `quotes` — one query, no N+1).
- **Slice1 read module** + exports on the slice boundary.
- **Dev page** `/dev/customers` (server-rendered, `tryGetApiPrincipal` + list) with links to JSON detail, new quote shell, quote list.
- **Home** link: “Dev — customers (read)”.
- **Integration smoke:** unauthenticated list **401**; office creates shell → customer appears in list → detail **200**; tenant B detail **404** `NOT_FOUND`.

## 3. Files changed (grouped by purpose)

| Purpose | Files |
|--------|--------|
| Read model + mapping | `src/server/slice1/reads/customer-reads.ts` |
| Slice1 exports | `src/server/slice1/index.ts` |
| API routes | `src/app/api/customers/route.ts`, `src/app/api/customers/[customerId]/route.ts` |
| Dev UI | `src/app/dev/customers/page.tsx` |
| Discoverability | `src/app/page.tsx` |
| Integration smoke | `scripts/integration/auth-spine.integration.test.ts` |
| This report | `docs/implementation/reports/2026-04-12-customer-read-list-slice.md` |

## 4. Read/list decisions applied

| Topic | Decision |
|--------|-----------|
| **Capability** | **`read`** — same as `GET /api/quotes` and quote-version scope. |
| **List ordering** | **`Customer.createdAt` descending** (newest first). |
| **Counts** | **`flowGroupCount`** and **`quoteCount`** included on list and detail (cheap `_count` in the same `findMany` / `findFirst`). |
| **Billing / PII** | **`billingAddressJson` not exposed** in this slice (discovery + ids/names only). |
| **Pagination** | **Limit only** (no cursors), aligned with quotes list. |

## 5. Behavioral impact

- Attach-mode quote shell creation can be driven from **discovered `customerId`** values without copying ids from a prior POST response only.
- **Tenant B** cannot read tenant A customer by id (**404**, same posture as quotes).

## 6. Validation performed

- `npm run build` — expected pass.

Full integration run unchanged in prerequisites (live Next, DB, seed, cookies).

## 7. Known gaps / follow-ups

- **No `GET /api/flow-groups`** (or per-customer FG list) — next bottleneck for picking **`flowGroupId`** without quote list indirection.
- **No customer CRUD**, search, fuzzy match, or merge.
- **No `updatedAt` on `Customer`** in schema for “last changed” UX (only `createdAt` exposed).

## 8. Risks / caveats

- Large tenants may hit the **100-row cap** without pagination.
- Counts are **snapshot at read time** — not a workflow guarantee.

## 9. Exposed fields (explicit)

| Field | Meaning |
|--------|---------|
| `id` | Customer primary key (use for attach). |
| `name` | Display name. |
| `createdAt` | ISO string. |
| `flowGroupCount` | Number of flow groups for this customer. |
| `quoteCount` | Number of quotes for this customer. |

## 10. Recommended next step

- **Flow-group discovery read** scoped by `customerId` (e.g. `GET /api/customers/[id]/flow-groups` or `GET /api/flow-groups?customerId=`) with the same `read` + tenant rules.
