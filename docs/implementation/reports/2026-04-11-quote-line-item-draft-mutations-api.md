# After-action report: Draft quote line item mutations + shared tenant API helpers

**Date:** 2026-04-11  
**Authority:** Original implementation prompt (canon-safe boundaries, after-action reports), `docs/epics/09-quote-line-items-epic.md`, `docs/schema-slice-1/04-slice-1-relations-and-invariants.md`, prior slice-1 schema + invariant modules.

---

## 1. Objective

Ship **tenant-scoped, draft-only** persistence for **QuoteLineItem** (create, partial update, delete) with **service-layer** enforcement of **manifest scope XOR**, **proposal-group / version alignment**, and **tenant-safe scope pins**—matching epic 09 and slice-1 `04`, without UI, compose, or send.

---

## 2. Scope completed

### Service (`src/server/slice1/mutations/quote-line-item-mutations.ts`)

- **`createQuoteLineItemForTenant`** — requires **DRAFT** quote version for tenant; validates **proposal group** on that version; loads scope revision / quote-local packet when ids provided; runs **`assertQuoteLineItemInvariants`**; validates **quantity ≥ 1**, **title** non-empty (trim, max 500), **description** length (max 4000), **sortOrder** integer, **money** fields non-negative integer cents.
- **`updateQuoteLineItemForTenant`** — same draft + tenant gates; **merges** patch with existing row; **re-loads** pin targets and **re-runs full line invariants** on merged state (supports changing `executionMode`, pins, group, etc.).
- **`deleteQuoteLineItemForTenant`** — **hard delete** on draft only (epic 09 §12), tenant + version scoped.

### New `Slice1InvariantCode` values (`errors.ts`)

- `INVALID_LINE_QUANTITY`, `INVALID_LINE_SORT_ORDER`, `INVALID_LINE_TITLE`, `INVALID_LINE_DESCRIPTION`, `INVALID_LINE_MONEY`, `SCOPE_PACKET_REVISION_NOT_FOUND`, `QUOTE_LOCAL_PACKET_NOT_FOUND`.

### HTTP API

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/quote-versions/[quoteVersionId]/line-items` | Create line; **201** + DTO; **404** if version/group/tenant mismatch. |
| `PATCH` | `/api/quote-versions/[quoteVersionId]/line-items/[lineItemId]` | Partial update; **400** empty patch. |
| `DELETE` | same | **200** `{ deleted: true, id }`. |

**Status mapping** (via `jsonResponseForCaughtError`): **`QUOTE_VERSION_NOT_DRAFT` → 409**; validation / missing pin refs → **400**; other invariants → **422** (e.g. XOR, `PROPOSAL_GROUP_VERSION_MISMATCH` on line invariants).

### Shared API utilities (`src/lib/api/tenant-json.ts`)

- **`requireTenantJson`** — same tenant rules as before (env + header policy).
- **`jsonResponseForCaughtError`** — centralizes **Prisma init**, **`DATABASE_URL`** message, **`InvariantViolationError` → HTTP**.

### Refactors

- **`GET .../scope`** and **`PATCH .../proposal-groups/...`** now use **`requireTenantJson` + `jsonResponseForCaughtError`** (behavior preserved; less duplication).

### Product copy

- **`src/app/page.tsx`** — documents line-item **POST/PATCH/DELETE** endpoints.

### Exports

- **`src/server/slice1/index.ts`** — exports line mutation functions + DTO/patch types.

---

## 3. Files changed (grouped)

| Group | Paths |
|--------|--------|
| Errors | `src/server/slice1/errors.ts` |
| Mutations | `src/server/slice1/mutations/quote-line-item-mutations.ts` |
| API helpers | `src/lib/api/tenant-json.ts` |
| Routes | `src/app/api/quote-versions/[quoteVersionId]/line-items/route.ts`, `.../line-items/[lineItemId]/route.ts`, `scope/route.ts`, `proposal-groups/[proposalGroupId]/route.ts` |
| Barrel | `src/server/slice1/index.ts` |
| UI | `src/app/page.tsx` |
| Report | `docs/implementation/reports/2026-04-11-quote-line-item-draft-mutations-api.md` |

---

## 4. Architecture / canon decisions

| Decision | Rationale |
|----------|-----------|
| Reuse **`assertQuoteLineItemInvariants`** on every create/update | Single source of truth with read-model checks; XOR + tenant pins stay aligned with `04`. |
| **No `PUBLISHED`-only** check on library revision at write time | Epic 09: published required **at send**; draft lines may reference revisions still in **DRAFT** during authoring—send/compose service will enforce publish policy later. |
| **404** for wrong tenant / missing row | Avoid leaking ids across tenants. |
| **`PROPOSAL_GROUP_VERSION_MISMATCH`** from `assertQuoteLineItemInvariants` if URL `quoteVersionId` ≠ group’s version | Path consistency; throws when moving line to group on another version. |

---

## 5. Behavioral impact

**Now possible**

- Programmatically add/edit/remove **draft** lines under a tenant-bound quote version with **DB + service** alignment to manifest XOR and pins.

**Unchanged**

- No compose, send, snapshots, audit events, archive flag, or real auth.
- **`/dev/*`** production block from prior middleware unchanged.

---

## 6. Validation performed

| Command | Result |
|---------|--------|
| `npm run build` | **Passed** (compile, lint, types) |

**Not run:** live HTTP integration tests against Docker Postgres (manual `curl`/REST client recommended).

---

## 7. Known gaps / follow-ups

1. **Published revision policy at save** — optional stricter validation if product wants “only published pins” while still in draft.
2. **Structured answers / dependencies** — epic 09 delete “confirm dependencies” not modeled.
3. **`archived` flag** — schema does not yet have `archived`; soft-remove deferred.
4. **Decimal quantity** — schema remains **Int**; epic mentions decimal—future migration.
5. **Audit** — no `AuditEvent` on line CRUD (epic 57).
6. **Rate limiting / API auth** — still dev tenant only.

---

## 8. Risks / caveats

| Risk | Note |
|------|------|
| **Race conditions** | Two editors updating same draft line—no optimistic locking. |
| **Large PATCH surface** | Clients can change pins and mode in one call; invariants must stay comprehensive as fields grow. |
| **Money** | Only non-negative integer cents; no tax/discount rules. |

---

## 9. Recommended next step

Add a **minimal compose-preview read** (draft-only): server function that consumes **`getQuoteVersionScopeReadModel`** output and returns a **stub plan DTO** (or first slice of `07-compose-engine-input-output-spec.md`) so API shape is fixed before implementing the real composer.
