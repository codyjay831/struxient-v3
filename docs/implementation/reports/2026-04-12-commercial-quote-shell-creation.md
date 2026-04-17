# After-action report: commercial quote shell creation (authenticated) — 2026-04-12

## 1. Objective

Deliver the **first authenticated, tenant-bound commercial shell creation path** so an **office** user can stand up **Customer → FlowGroup → Quote → initial QuoteVersion (DRAFT) → default ProposalGroup** without relying on seed scripts alone. Tenant identity must come from the **session principal** (`User.tenantId`), not from request bodies. No job, activation, runtime, or workflow pin in this slice.

## 2. Scope completed

- **Single transactional mutation** `createCommercialQuoteShellForTenant` in slice1: one Prisma `$transaction` creates the full shell or rolls back entirely.
- **Protected HTTP API:** `POST /api/commercial/quote-shell` with `requireApiPrincipalWithCapability("office_mutate")` (same pattern as send/sign/activate and proposal-group PATCH).
- **Stable JSON DTO** in the response `data` object (ids + key scalar fields only; no raw Prisma graph).
- **Validation** for names, optional `quoteNumber`, optional `customerBillingAddressJson` (must be a plain object if present), optional `proposalGroupName`.
- **Conflict handling:** duplicate `quoteNumber` per tenant → **409** (`QUOTE_NUMBER_TAKEN`), including a **P2002** fallback for races.
- **Minimal dev UI:** `/dev/new-quote-shell` (client form + `credentials: "include"`).
- **Home link** to the dev page alongside other dev helpers.
- **Auth integration smoke** extended: office creates shell + `GET …/scope` on the new `quoteVersionId`; READ_ONLY gets **403** on the same POST.

## 3. Files changed (grouped by purpose)

| Purpose | Files |
|--------|--------|
| Core mutation + DTOs | `src/server/slice1/mutations/create-commercial-quote-shell.ts` |
| Slice1 public exports | `src/server/slice1/index.ts` |
| API route | `src/app/api/commercial/quote-shell/route.ts` |
| Dev verification UI | `src/app/dev/new-quote-shell/page.tsx` |
| Discoverability | `src/app/page.tsx` |
| Integration smoke | `scripts/integration/auth-spine.integration.test.ts` |
| This report | `docs/implementation/reports/2026-04-12-commercial-quote-shell-creation.md` |

## 4. Creation / bootstrapping decisions applied

| Decision | Choice |
|----------|--------|
| **Route shape** | One endpoint `POST /api/commercial/quote-shell` (not separate `/api/customers` + `/api/flow-groups` + `/api/quotes`) to avoid half-valid intermediate states and to match “single transactional entry” recommendation. |
| **Initial QuoteVersion** | **Yes.** `versionNumber: 1`, `status: DRAFT`, `pinnedWorkflowVersionId: null`, `createdById` = authenticated user (must exist in tenant or transaction aborts with `CREATED_BY_NOT_IN_TENANT` → **400 INVALID_ACTOR**). |
| **Initial ProposalGroup** | **Yes.** Default name **`Main`**, **`sortOrder: 0`**, aligned with seed conventions so line-item APIs that require `proposalGroupId` have a valid default group without DB surgery. |
| **Quote number** | Caller may supply `quoteNumber`; if omitted or empty, server allocates a tenant-unique **`AUTO-…`** string (with retry loop inside the transaction). |
| **Customer billing** | Optional `customerBillingAddressJson` stored on `Customer.billingAddressJson` when provided (JSON object only). |
| **Capabilities** | **Office only** (`office_mutate`). Field and READ_ONLY roles are not granted creation here. |
| **Schema migration** | **None.** Existing Prisma models already support this graph. |

## 5. Behavioral impact

- **New records:** Each successful POST creates **five** rows: `Customer`, `FlowGroup`, `Quote`, `QuoteVersion`, `ProposalGroup`.
- **Existing flows:** Draft quote-version routes (scope, line items, compose-preview, etc.) can target the returned `quoteVersion.id` immediately after creation, subject to their own rules (e.g. compose still needs pinned workflow when enforced elsewhere).
- **Tenant boundary:** `tenantId` is always `authGate.principal.tenantId`; bodies cannot assert a different tenant.
- **Errors:** Structured `error.code` values for validation, **415** for non-JSON POST, **409** for quote number collision.

## 6. Validation performed

- `npm run build` — **pass** (compile, lint, typecheck as part of Next build).

Integration tests (`npm run test:integration`) were **authored** for the new route; running them still requires a live Next server, Postgres, and seed per existing suite prerequisites.

## 7. Known gaps / follow-ups

- **No `GET` list APIs** for customers/quotes in this slice — creation only.
- **No “attach to existing customer/flow group”** mode — every call creates a **new** customer and flow group (intentionally smallest path; a future endpoint could accept optional `customerId` / `flowGroupId` with tenant checks).
- **Catalog / scope packets / workflow templates** remain seed- or admin-driven; this slice does not create `ScopePacket`, `WorkflowVersion`, or pins.
- **Job / pre-job / activation** are untouched — still not created here.
- **Separate granular routes** (`POST /api/customers`, etc.) were deferred to keep surface area and invalid states minimal.

## 8. Risks / caveats

- **Auto quote numbers** use time + randomness; extreme collision rates could still hit **P2002** (handled as **409**).
- **CREATED_BY_NOT_IN_TENANT** should be impossible for a normal session (principal `userId` should always belong to `tenantId`); if it fires, it indicates a data/auth inconsistency worth investigating.
- **Dev page** assumes the user already has an office session cookie (same as other dev tools).

## 9. Explicit answers (success criteria checklist)

| Question | Answer |
|----------|--------|
| Does quote creation work **without** seed-only setup? | **Yes**, for the **commercial shell** graph: office user + DB is enough to create a new quote path via API. |
| Is an initial **QuoteVersion** auto-created? | **Yes** — v1, DRAFT, no workflow pin. |
| Is a default **ProposalGroup** auto-created? | **Yes** — default name **Main**, sort order **0** (override via `proposalGroupName`). |
| What is **still** seed-only (or otherwise out of band) after this slice? | **Scope/catalog** data, **workflow versions** and **pins**, **activation/runtime** fixtures, **multi-user tenants** beyond whatever seed creates, and any **job** creation. |
| Recommended next step | **Optional:** “attach” mode for existing Customer/FlowGroup; **or** first **authenticated read/list** slice for office (customers/quotes) to navigate shells created via API; **or** tighten compose/line-item docs when no pinned workflow yet. |

## 10. API contract (summary)

**`POST /api/commercial/quote-shell`**  
Headers: `Content-Type: application/json`, session cookie.  
Body (required): `customerName` (string), `flowGroupName` (string).  
Optional: `quoteNumber`, `customerBillingAddressJson` (object), `proposalGroupName`.  

**200:** `{ data: CommercialQuoteShellDto, meta: apiAuthMeta }`  
**400 / 403 / 409 / 415:** `{ error: { code, message, … } }` per route handler.
