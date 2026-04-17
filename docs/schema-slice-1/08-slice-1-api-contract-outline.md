# Slice 1 — API contract outline

**Companion:** `05-compose-preview-contract.md`, `06-send-freeze-transaction-design.md`.

**Non-goals:** Execution, activation, portal, payments, leads, full catalog authoring.

---

## Conventions

- Base path illustrative: `/api/v1`.
- All responses tenant-scoped via auth.
- IDs opaque strings.
- **Errors:** problem+json or consistent `{ "error": { "code", "message", "details" } }`.

---

## Minimal CRM endpoints

### `POST /customers`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Create customer anchor |
| **Inputs** | `name`, optional `billingAddressJson` |
| **Response** | Customer DTO with `id` |
| **Idempotency** | None required |
| **Permissions** | Office user |
| **Failures** | `400` validation, `401`, `403` |

### `POST /flow-groups`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Create project/site under customer |
| **Inputs** | `customerId`, `name` |
| **Response** | FlowGroup DTO |
| **Idempotency** | Optional |
| **Permissions** | Office user; customer same tenant |
| **Failures** | `404` customer, `403` tenant |

### `GET /customers/{id}` / `GET /flow-groups/{id}`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Read anchors for quote workspace |
| **Response** | DTO |
| **Failures** | `404`, `403` |

---

## Minimal catalog read endpoints (seeded)

### `GET /scope-packets`

| Aspect | Detail |
|--------|--------|
| **Purpose** | List packets for picker |
| **Response** | `{ items: [{ id, packetKey, displayName, latestPublishedRevisionId }] }` |
| **Permissions** | Read |
| **Failures** | `401` |

### `GET /scope-packet-revisions/{id}`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Load revision detail + task lines for picker / tier validation |
| **Response** | Revision + lines (tier codes, keys, titles) |
| **Failures** | `404` |

### `GET /workflow-templates`

| Aspect | Detail |
|--------|--------|
| **Purpose** | List templates |
| **Response** | `{ items: [{ id, templateKey, displayName }] }` |

### `GET /workflow-versions/{id}`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Read-only snapshot for admin/debug; **quote pin** uses id only in Slice 1 UI |
| **Response** | Metadata + optional `snapshotJson` (may be large) |
| **Failures** | `404` |

**What not to do:** call catalog entities `*Package*` for scope (`canon/09`).

---

## Quote draft endpoints

### `POST /quotes`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Create quote shell |
| **Inputs** | `customerId`, `flowGroupId`, optional `quoteNumber` (or server-generated) |
| **Response** | Quote DTO |
| **Failures** | FK / tenant |

### `POST /quotes/{quoteId}/versions`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Create **draft** version + **default** `ProposalGroup` “Items” |
| **Inputs** | optional `title` |
| **Response** | QuoteVersion DTO (`status: draft`, `composePreviewStalenessToken` set) |
| **Failures** | Quote not found |

### `PATCH /quote-versions/{id}` (draft only)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Update `title`, `pinnedWorkflowVersionId` |
| **Response** | Updated DTO; **staleness token bumped** |
| **Failures** | `409` if not draft |

### `POST|PATCH|DELETE` line items and groups (draft only)

Illustrative:

- `POST /quote-versions/{id}/proposal-groups` — **optional** if only default group; else allow add in draft.
- `PATCH /quote-versions/{id}/proposal-groups/{gid}` — reorder/rename.
- `POST /quote-versions/{id}/line-items` — create line.
- `PATCH /quote-versions/{id}/line-items/{lid}` — edit.
- `DELETE /quote-versions/{id}/line-items/{lid}` — delete.

| Failures | `409` if version sent |

---

## Compose preview endpoint

### `POST /quote-versions/{id}/compose-preview`

Per `05-compose-preview-contract.md`.

| Idempotency | None (safe to repeat) |
| **Permissions** | Office user |
| **Failures** | `404`, `409` if `sent`, `422` if blocking errors (optional — may still return 200 with errors array; **Slice 1 decision:** return **200** with `errors[]` for preview; **422** reserved for malformed request) |

---

## Send endpoint

### `POST /quote-versions/{id}/send`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Transactional freeze (`06`) |
| **Inputs** | `clientStalenessToken`, optional `sendClientRequestId`, optional `acknowledgedWarningCodes` |
| **Response** | Full sent `QuoteVersion` DTO including snapshot presence flags + hashes (snapshots may be omitted if large — **then** require `GET` with `?include=snapshots`) |
| **Idempotency** | **Required** support via `sendClientRequestId` or `Idempotency-Key` |
| **Permissions** | Office user + send capability |
| **Failures** | `409` concurrent send / not draft, `422` validation / stale token, `401/403` |

---

## Read-only sent quote / version

### `GET /quote-versions/{id}`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Single version; if `sent`, **read-only** semantics |
| **Query** | `include=snapshots` optional |
| **Response** | Version + nested groups + lines + hashes |
| **Failures** | `404`, `403` |

### `GET /quotes/{id}`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Shell + list of version summaries |

---

## Explicitly excluded endpoints (Slice 1)

| Endpoint class | Reason |
|----------------|--------|
| Sign, activate, flow, task execution | Slice 2+ |
| Structured inputs CRUD | Excluded |
| Catalog authoring PUT/PATCH | Seeds only |
| Portal / customer-facing | Excluded |

---

## Classification

| Topic | Type |
|------|------|
| REST shape | **Slice 1 outline** — implementers may mirror with RPC |
| 200 + errors for preview | **Slice 1 decision** |
