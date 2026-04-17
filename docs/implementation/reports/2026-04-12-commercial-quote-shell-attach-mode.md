# After-action report: commercial quote-shell attach mode — 2026-04-12

## 1. Objective

Extend **`POST /api/commercial/quote-shell`** so office users can create a new **Quote + QuoteVersion + ProposalGroup** while **reusing tenant-owned `Customer` and/or `FlowGroup`**, instead of always creating duplicate anchors. Preserve **one transaction**, **`office_mutate`**, **principal-derived `tenantId`**, and the **existing response DTO** shape.

## 2. Scope completed

- **Discriminated server input** `CreateCommercialQuoteShellInput` with three modes (`kind`).
- **Route parser** enforces mutually exclusive customer and flow-group strategies and rejects ambiguous combinations.
- **Tenant checks** inside the transaction: `customerId` / `flowGroupId` resolved with `tenantId` from the principal; wrong tenant → same **404** posture as “not found” (`CUSTOMER_NOT_FOUND` / `FLOW_GROUP_NOT_FOUND`).
- **Linkage check:** `attach_customer_attach_flow_group` requires `flowGroup.customerId === customerId` → **400** `FLOW_GROUP_CUSTOMER_MISMATCH`.
- **`customerBillingAddressJson`:** only on **new customer** path; forbidden on attach paths (parser + mutation).
- **Dev page** `/dev/new-quote-shell`: optional `customerId` / `flowGroupId` fields and short contract hint.
- **Integration smoke:** attach customer + new FG; attach both; tenant B cannot attach tenant A customer; FG/customer mismatch; `customerName`+`customerId` conflict; `flowGroupId` without `customerId`.

## 3. Files changed (grouped by purpose)

| Purpose | Files |
|--------|--------|
| Transactional mutation + types | `src/server/slice1/mutations/create-commercial-quote-shell.ts` |
| HTTP parse + error mapping | `src/app/api/commercial/quote-shell/route.ts` |
| Dev verification | `src/app/dev/new-quote-shell/page.tsx` |
| Integration smoke | `scripts/integration/auth-spine.integration.test.ts` |
| This report | `docs/implementation/reports/2026-04-12-commercial-quote-shell-attach-mode.md` |

## 4. Attach-mode decisions applied

| Allowed mode | Body shape | Behavior |
|--------------|------------|----------|
| **A — new customer, new flow group** | `customerName` + `flowGroupName` (no ids) | Same as original slice: create `Customer`, create `FlowGroup`, then quote shell. Optional `customerBillingAddressJson` (object only). |
| **B — attach customer, new flow group** | `customerId` + `flowGroupName` (no `flowGroupId`, no `customerName`) | Load `Customer` by `id` + `tenantId`; create new `FlowGroup` under that customer; then quote shell. |
| **C — attach customer, attach flow group** | `customerId` + `flowGroupId` (no names) | Load both under `tenantId`; require `flowGroup.customerId === customerId`; then quote shell. |

| Rejected combination | HTTP | Code |
|---------------------|------|------|
| `customerName` + `customerId` | 400 | `SHELL_INPUT_CONFLICT` |
| `flowGroupName` + `flowGroupId` | 400 | `SHELL_INPUT_CONFLICT` |
| `flowGroupId` without `customerId` | 400 | `SHELL_INPUT_CONFLICT` (explicit customer strategy required) |
| `flowGroupId` + `customerName` (no `customerId`) | 400 | `SHELL_INPUT_CONFLICT` |
| `customerBillingAddressJson` on attach modes | 400 | `SHELL_INPUT_CONFLICT` (parser) or `BILLING_JSON_ATTACH_FORBIDDEN` (mutation safety) |
| Customer / flow group not in tenant | 404 | `CUSTOMER_NOT_FOUND` / `FLOW_GROUP_NOT_FOUND` |
| FG belongs to another customer | 400 | `FLOW_GROUP_CUSTOMER_MISMATCH` |

**Route surface:** **Extended existing** `POST /api/commercial/quote-shell` only (no new parallel create APIs).

**Tenant ownership:** Every attach lookup uses `where: { id, tenantId: params.tenantId }` so another tenant’s ids never resolve.

## 5. Behavioral impact

- Office can add **multiple quotes** on the **same customer** and/or **same flow group** without duplicating those rows.
- **Response DTO** unchanged: still returns `customer`, `flowGroup`, `quote`, `quoteVersion`, `proposalGroup`.
- **Read/list** (`GET /api/quotes`) needs no change; new quotes still appear with correct customer/FG summaries.

## 6. Validation performed

- `npm run build` — pass.

Integration tests authored for attach and negative cases; full run still requires live Next + DB + seed per existing suite docs.

## 7. Known gaps / follow-ups

- **No `GET /api/customers`** or FG list — discover ids via quote list/detail or prior create responses (same as before attach).
- **No “implicit customer from flowGroupId only”** — client must pass **`customerId`** with **`flowGroupId`** to avoid ambiguous ownership.
- **No customer update** via this route (billing still create-only).

## 8. Risks / caveats

- **Wrong-id mistakes** are possible without list UIs; **mismatch** and **404** errors are intentional guardrails.
- **Parser** must stay in sync with **mutation** `kind` branches when adding future modes.

## 9. Duplication risk reduced vs before

- **Customer** and **FlowGroup** rows are no longer forced to duplicate for every new quote when anchors already exist.

## 10. Recommended next step

- **Narrow read list for customers** (`GET /api/customers?limit=`) or quote-centric **“recent customers”** embed — improves attach UX without CRM CRUD sprawl.
