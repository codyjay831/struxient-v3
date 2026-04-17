# After-action report: Quote version send / freeze (Phase 4 slice)

**Date:** 2026-04-11  
**Authority:** `docs/schema-slice-1/06-send-freeze-transaction-design.md`, `07-snapshot-shape-v0.md`, `05-compose-preview-contract.md`, `planning/01-id-spaces-and-identity-contract.md` §6.

---

## 1. Objective

Ship **`draft → sent`** for a tenant-scoped `QuoteVersion` in **one transaction**: row lock, compose parity with preview, **blocking compose checks**, **staleness match**, persist **`generatedPlanSnapshot`** + **`executionPackageSnapshot`** with **SHA-256**, clear **`composePreviewStalenessToken`**, set **`sentAt` / `sentById`**, optional **idempotent** replay via **`sendClientRequestId`**.

---

## 2. Scope completed

### Compose reuse

- **`compose-engine.ts`** — `runComposeFromReadModel` holds MANIFEST expansion + errors (shared by preview and send).
- **`build-compose-preview.ts`** — delegates expansion to engine; preview-only staleness + stats + strips internal `lineItemId` from package slots in the HTTP DTO.
- **`freeze-snapshots.ts`** — `buildGeneratedPlanSnapshotV0`, `buildExecutionPackageSnapshotV0`, `canonicalStringify`, `sha256HexUtf8` (sorted-key canonical JSON for hashing).

### Send service (`mutations/send-quote-version.ts`)

- **`sendQuoteVersionForTenant`**: `$transaction` + `SELECT … FOR UPDATE` on `QuoteVersion`; idempotent **200** path when already **SENT** and **`sendClientRequestId`** matches; **staleness** strict equality `clientStalenessToken` vs `composePreviewStalenessToken` (both `null` allowed); compose re-run inside txn after lock; **422**-class compose failures as structured `composeErrors`; **empty plan / empty slots** → `PLAN_SNAPSHOT_EMPTY` / `PACKAGE_SNAPSHOT_EMPTY`; **`sentByUserId`** optional, must be tenant **User**, else **`createdById`**; **`P2002`** on duplicate global **`sendClientRequestId`** → **409** in route.

### Staleness bumps (`mutations/compose-staleness.ts`)

- **`bumpComposePreviewStalenessToken`** — `updateMany` **DRAFT** only, random hex token.
- Wired after successful **create/update/delete line item** and **rename proposal group**.

### HTTP

- **`POST /api/quote-versions/[quoteVersionId]/send`** — JSON body optional; maps results to **404 / 409 / 422 / 400 / 200**.

### Scope DTO

- **`GET …/scope`** now includes **`pinnedWorkflowVersionId`** and **`composePreviewStalenessToken`** on `quoteVersion` for clients.

### Read model typing

- **`getQuoteVersionScopeReadModel`** accepts **`PrismaClient | Prisma.TransactionClient`** (`QuoteVersionScopeDb`).

### Product copy

- **`src/app/page.tsx`** — documents send + staleness.

### Exports

- **`slice1/index.ts`** — `sendQuoteVersionForTenant` + request/success types.

---

## 3. Files touched (grouped)

| Area | Paths |
|------|--------|
| Engine | `compose-preview/compose-engine.ts`, `compose-preview/build-compose-preview.ts`, `compose-preview/freeze-snapshots.ts` |
| Mutations | `mutations/send-quote-version.ts`, `mutations/compose-staleness.ts`, `mutations/quote-line-item-mutations.ts`, `mutations/rename-proposal-group.ts` |
| Reads | `reads/quote-version-scope.ts` |
| API | `app/api/quote-versions/[quoteVersionId]/send/route.ts` |
| DTO | `lib/quote-version-scope-dto.ts` |
| UI | `app/page.tsx` |
| Barrel | `server/slice1/index.ts` |
| Report | `docs/implementation/reports/2026-04-11-quote-version-send-freeze-transaction.md` |

---

## 4. Behavioral notes

| Topic | Behavior |
|--------|-----------|
| First send on fresh seed | `composePreviewStalenessToken` often **null**; client sends **`null` / omitted** → matches. |
| After any draft mutation | Token **bumps**; client must **GET scope** (or remember last preview `stalenessToken`) before send. |
| SENT version | Compose preview returns **409** `QUOTE_VERSION_NOT_DRAFT` (unchanged). |
| **SOLD_SCOPE**-only quotes | Still **no** manifest expansion → **422** `PLAN_SNAPSHOT_EMPTY` until product defines sold-line expansion. |

---

## 5. Validation

| Check | Result |
|--------|--------|
| `npm run build` | Passed |

---

## 6. Gaps / follow-ups

1. **AuditEvent** `QUOTE_VERSION_SENT` (epic 57).  
2. **SOLD_SCOPE** → plan/package semantics (epic 09 / 32).  
3. **PATCH** `pinnedWorkflowVersionId` on draft version (epic 07).  
4. **GET sent** version with inline or split snapshot payloads.  
5. **Real auth** actor instead of `sentByUserId` / `createdById` fallback.  
6. **Warning ack** mode for send (`05` / `12`).

---

## 7. Recommended next step

**Sign + job shell** (Phase 5): `QuoteSignature` + **`ensureJobForFlowGroup`** on acceptance (`decisions/04`, epic **13** / **34**), or **minimal read API** for **SENT** version (snapshots + lines) for office verification.
