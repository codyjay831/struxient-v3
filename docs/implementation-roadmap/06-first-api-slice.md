# Struxient v3 — First API / service slice (recommendation)

**Goal:** Contracts that prove **compose + freeze** and establish **non-negotiable API habits** before execution endpoints exist.  
**Companion:** `planning/04-api-surface-outline.md`, `planning/01-id-spaces-and-identity-contract.md`, `02-vertical-slices.md` (**V2**).

---

## What to build first: the **Freeze vertical API** (not “CRUD everything”)

**Single slice name:** **“QuoteVersion freeze pipeline”**

It bundles:

1. Draft quote read/write (minimal).
2. **Compose preview** (dry-run).
3. **Send** (transactional freeze).

**Why not start with CRM-only endpoints?** They do not exercise **canon** constraints. **Why not start with execution?** Execution **depends** on frozen package correctness — building it first invites fake data.

---

## Contracts to define first (ordered)

### 1) **ExecutableTaskRef** schema component (shared)

Define **once** in OpenAPI/JSON Schema and **import** everywhere:

- `kind`: `SKELETON` | `RUNTIME`
- `skeletonTaskId?` / `runtimeTaskId?` (exactly one)
- `flowId?` (optional for non-execution contexts)

**Even if execution endpoints are not built yet**, define this **now** so first real execution PR cannot ship a bare `taskId`.

---

### 2) CRM minimal

| Contract responsibility | Notes |
|-------------------------|--------|
| `POST /customers`, `POST /flow-groups` | Minimal fields per `epics 02–03` |
| `GET` by id for picker | Used by quote wizard |

**Stub:** leads, contacts.

---

### 3) Catalog read (seed-backed)

| Contract responsibility | Notes |
|-------------------------|--------|
| `GET /catalog/packet-revisions?key=` | Returns **published** revision id for picker |
| `GET /catalog/workflow-versions?templateId=` | Returns published version for picker |

**Stub:** full authoring CRUD — seeds only.

---

### 4) Quote draft

| Contract responsibility | Notes |
|-------------------------|--------|
| `POST /quotes` + initial `QuoteVersion` | `epics 07–08` |
| `PATCH /quote-versions/{id}` | draft-only fields |
| `POST /quote-versions/{id}/line-items` | upsert pattern acceptable |

**Validation:** manifest-scoped lines satisfy **scope pin XOR** (`scopePacketRevisionId` *or* `quoteLocalPacketId` resolves per `04`); `workflowVersionId` pin set before compose.

---

### 5) Compose preview (dry-run)

| Contract responsibility | Notes |
|-------------------------|--------|
| `POST /quote-versions/{id}/compose:preview` | Computes plan+package **without** persisting freeze |

**Response must include**

- `errors[]` (blocking)
- `warnings[]` (non-blocking)
- `stats` (counts by node/source) for UI trust

**Idempotency:** not required (read-only compute), but **POST** chosen to allow large payloads later.

---

### 6) Send (freeze transaction)

| Contract responsibility | Notes |
|-------------------------|--------|
| `POST /quote-versions/{id}/send` | Atomic `draft→sent` + persist snapshots |

**Headers**

- **`Idempotency-Key` required** (`planning/04`)

**Body**

- `acknowledgedWarningCodes[]` matching preview warnings (`epic 12`)

**Errors**

- `COMPOSE_ERRORS_BLOCK_SEND`
- `STALE_PREVIEW` (if quote changed since preview token — optional **ETag** pattern)

**Response**

- frozen `quoteVersion` summary + hashes

---

## Service ownership for slice 1 (can be monolith modules)

| Module | Owns |
|--------|------|
| **crm** | customers, flow groups |
| **catalogRead** | packet + template published reads |
| **quotes** | quote/version/line items |
| **compose** | pure functions + called by quotes |
| **freezeWriter** | transaction orchestration (may be same deployable as **quotes** initially) |

**Do not split into microservices** until **V4** stabilizes — **modular monolith** reduces coordination overhead.

---

## Explicitly defer (first API slice)

| Area | Defer until |
|------|-------------|
| `POST .../activate` | After sign + schema slice 2 |
| `POST .../tasks:start` | After activation |
| Portal auth | After office path works (`O17`) |
| Payment gates | Phase 9 (`01-v3-build-sequence.md`) |
| Notifications fan-out | Log + async later (`epic 56`) |

---

## First contract tests (behavioral, not code here)

- Send **twice** with same idempotency key → **one** sent version state.
- Send with **errors** → **no** `sent`, **no** partial snapshots.
- Preview → change line → send without re-preview → **reject** or **force** explicit refresh (pick one; **reject** is safer).

---

## Summary one-liner

**Define `ExecutableTaskRef` + implement `compose:preview` + `send` as the first API milestone**, supported by minimal CRM/catalog read + quote line CRUD.
