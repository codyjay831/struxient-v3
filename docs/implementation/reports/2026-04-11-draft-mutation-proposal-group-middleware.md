# After-action report: draft-only proposal group rename + `/dev` production block

**Date:** 2026-04-11

---

## 1. Objective

First **tenant-scoped mutation** with **QV-4 draft guard**, plus **production blocking** of dev-only routes.

---

## 2. Scope completed

- **`assertQuoteVersionDraft`** — throws `InvariantViolationError` (`QUOTE_VERSION_NOT_DRAFT`) when `status !== DRAFT` (`docs/schema-slice-1/04-slice-1-relations-and-invariants.md` QV-4).
- **`renameProposalGroupForTenant`** — loads group → checks **tenant** via `quote.tenantId`, **path version id** matches `proposalGroup.quoteVersionId`, applies draft assert, updates `name` (trim, max 200 chars).
- **`PATCH /api/quote-versions/[quoteVersionId]/proposal-groups/[proposalGroupId]`** — JSON `{ "name": "string" }`; **404** if tenant/version/group mismatch (no cross-tenant leakage); **409** for sent version; **400** invalid name/body; **422** other invariants (e.g. version mismatch).
- **`src/middleware.ts`** — in **`NODE_ENV === 'production'`**, **`/dev` and `/dev/*`** return **404 JSON** (minimal surface).

---

## 3. Files (grouped)

| Area | Paths |
|------|--------|
| Invariants | `src/server/slice1/invariants/quote-version.ts`, `errors.ts`, `invariants/index.ts` |
| Mutation | `src/server/slice1/mutations/rename-proposal-group.ts` |
| Barrel | `src/server/slice1/index.ts` |
| API | `src/app/api/quote-versions/[quoteVersionId]/proposal-groups/[proposalGroupId]/route.ts` |
| Middleware | `src/middleware.ts` |
| UI copy | `src/app/page.tsx` |
| Report | `docs/implementation/reports/2026-04-11-draft-mutation-proposal-group-middleware.md` |

---

## 4. Validation

- `npm run build` — run after edits (expected pass).

---

## 5. Known gaps / follow-ups

- **Auth** — still dev tenant env/header; mutations inherit same contract as reads.
- **Idempotency / concurrency** — no optimistic locking on `ProposalGroup` row.
- **Audit** — no `AuditEvent` on rename (epic 57 later).
- **Refactor** — tenant + Prisma error handling duplicated across API routes; extract shared helper when a third route appears.

---

## 6. Example (dev)

```http
PATCH /api/quote-versions/<quoteVersionId>/proposal-groups/<proposalGroupId>
Content-Type: application/json

{"name":"Sections"}
```

Use `STRUXIENT_DEV_TENANT_ID` in `.env.local` or `x-struxient-tenant-id` (non-production).
