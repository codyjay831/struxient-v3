# After-action report: flow-group read/list (discovery) — 2026-04-12

## 1. Objective

Add **authenticated, tenant-scoped flow-group discovery** so read-capable users can **list and open `FlowGroup` rows** and obtain **`flowGroupId` + `customer.id`** for **`POST /api/commercial/quote-shell`** attach mode, without relying on prior POST responses or seed-only ids.

## 2. Scope completed

- **`GET /api/flow-groups`** — `requireApiPrincipalWithCapability("read")`; `where: { tenantId }`; `orderBy: createdAt desc`; **`?limit=`** default **50**, max **100** (`clampFlowGroupListLimit`).
- **`GET /api/flow-groups/[flowGroupId]`** — same capability; **`findFirst({ id, tenantId })`**; **404** `NOT_FOUND` when absent or wrong tenant.
- **DTO** `FlowGroupSummaryDto` (list + detail): `id`, `name`, `createdAt` (ISO-8601), **`customer: { id, name }`**, **`quoteCount`** (`_count.quotes`), **`jobId`** (`Job.id` when optional `job` exists, else **`null`**).
- **Slice1** read module + exports.
- **Dev** `/dev/flow-groups` (server list + links to JSON detail, customers, new quote shell).
- **Home** link: “Dev — flow groups (read)”.
- **Integration smoke:** unauthenticated list **401**; office creates quote shell → FG in list with matching **customer** → detail **200**; tenant B **404** `NOT_FOUND`.

**Naming:** **`/api/flow-groups`** is distinct from **`/api/flows/[flowId]`** (runtime flow execution).

## 3. Files changed (grouped by purpose)

| Purpose | Files |
|--------|--------|
| Read model | `src/server/slice1/reads/flow-group-reads.ts` |
| Slice1 exports | `src/server/slice1/index.ts` |
| API routes | `src/app/api/flow-groups/route.ts`, `src/app/api/flow-groups/[flowGroupId]/route.ts` |
| Dev UI | `src/app/dev/flow-groups/page.tsx` |
| Discoverability | `src/app/page.tsx` |
| Integration smoke | `scripts/integration/auth-spine.integration.test.ts` |
| This report | `docs/implementation/reports/2026-04-12-flow-group-read-list-slice.md` |

## 4. Read/list decisions applied

| Topic | Decision |
|--------|-----------|
| **Capability** | **`read`**, aligned with quotes and customers. |
| **Customer linkage** | **Always included** on list and detail (`customer.id`, `customer.name`) — required for attach-mode sanity. |
| **Quote summary** | **`quoteCount`** only (single `_count` per row). |
| **Job summary** | **`jobId`** string or **`null`** — one optional relation select; indicates whether a **Job** shell exists for this anchor (e.g. post-sign), without loading job graphs. |
| **Filters** | **None** (no `customerId` query param in this slice). |
| **Pagination** | **Limit only** (no cursors). |

## 5. Behavioral impact

- Attach **`customerId` + `flowGroupId`** can be filled from **list/detail** without copying from a prior create response.
- Cross-tenant **detail** remains **404** (non-leak), consistent with quotes and customers.

## 6. Validation performed

- `npm run build` — run in workspace after changes.

Integration: same prerequisites as existing suite (Next + DB + seed + sessions).

## 7. Known gaps / follow-ups

- **No `?customerId=` filter** on list — add if FG lists become noisy.
- **No flow-group CRUD**, search, or rename via this slice (rename may exist elsewhere on quote-version paths only).
- **No pre-job / quote list** embedded — only **quote count** and **job id** flags.

## 8. Risks / caveats

- **`jobId`** appears when a `Job` row exists; it is **not** an activation/runtime dashboard (see `/api/flows/[flowId]` for execution reads).
- **100-row cap** on list without pagination.

## 9. Exposed fields (explicit)

| Field | Meaning |
|--------|---------|
| `id` | Flow group id (attach `flowGroupId`). |
| `name` | Flow group display name. |
| `createdAt` | ISO string. |
| `customer.id` / `customer.name` | Owning customer (must match attach `customerId`). |
| `quoteCount` | Number of quotes on this flow group. |
| `jobId` | Job primary key if present; else `null`. |

## 10. Recommended next step

- **Optional query `?customerId=`** on `GET /api/flow-groups` with tenant-safe customer check, or **attach-mode dev helper** that prefills ids from list selections.
