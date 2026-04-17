# Slice 1 — API DTO draft (JSON)

**Status:** Contract draft for handlers (not implemented here).  
**Defaults:** Send requires **full server-side warning acknowledgment**; `GET /quote-versions/{id}` **omits** `generatedPlanSnapshot` and `executionPackageSnapshot` unless `?include=snapshots`.

**Conventions:** ISO-8601 UTC; money in **cents** (`Int`); opaque string IDs.

---

## Shared pieces

### Error response (example)

```json
{
  "error": {
    "code": "STALE_COMPOSE_TOKEN",
    "message": "Compose preview is stale; run preview again.",
    "details": { "quoteVersionId": "qv_…" }
  }
}
```

### Validation issue item (preview / send)

```json
{
  "code": "LINE_PACKET_MISSING",
  "message": "Line item has no valid scope pin (catalog revision or quote-local packet).",
  "lineItemId": "li_…",
  "details": {}
}
```

---

## Create customer

**`POST /api/v1/customers`**

### Request

```json
{
  "name": "Acme Homeowner",
  "billingAddressJson": {
    "line1": "123 Main St",
    "city": "Austin",
    "region": "TX",
    "postalCode": "78701"
  }
}
```

### Response `201`

```json
{
  "id": "cus_…",
  "tenantId": "ten_…",
  "name": "Acme Homeowner",
  "billingAddressJson": { "line1": "123 Main St", "city": "Austin", "region": "TX", "postalCode": "78701" },
  "createdAt": "2026-04-11T12:00:00.000Z",
  "updatedAt": "2026-04-11T12:00:00.000Z"
}
```

---

## Create flow group

**`POST /api/v1/flow-groups`**

### Request

```json
{
  "customerId": "cus_…",
  "name": "123 Main — Roof replacement"
}
```

### Response `201`

```json
{
  "id": "fg_…",
  "tenantId": "ten_…",
  "customerId": "cus_…",
  "name": "123 Main — Roof replacement",
  "createdAt": "2026-04-11T12:01:00.000Z"
}
```

---

## Create quote

**`POST /api/v1/quotes`**

### Request

```json
{
  "customerId": "cus_…",
  "flowGroupId": "fg_…",
  "quoteNumber": "Q-1042"
}
```

### Response `201`

```json
{
  "id": "qt_…",
  "tenantId": "ten_…",
  "customerId": "cus_…",
  "flowGroupId": "fg_…",
  "quoteNumber": "Q-1042",
  "createdAt": "2026-04-11T12:02:00.000Z"
}
```

---

## Create quote version

**`POST /api/v1/quotes/{quoteId}/versions`**

Creates **draft** `QuoteVersion` **and** default `ProposalGroup` (`name`: `"Items"`, `sortOrder`: `0`). Sets `composePreviewStalenessToken` to new opaque value.

### Request

```json
{
  "title": "Option A — Architectural shingles",
  "pinnedWorkflowVersionId": null
}
```

### Response `201`

```json
{
  "id": "qv_…",
  "quoteId": "qt_…",
  "versionNumber": 1,
  "status": "DRAFT",
  "pinnedWorkflowVersionId": null,
  "title": "Option A — Architectural shingles",
  "createdAt": "2026-04-11T12:03:00.000Z",
  "createdById": "usr_…",
  "sentAt": null,
  "sentById": null,
  "composePreviewStalenessToken": "st_abc123",
  "snapshots": null,
  "snapshotHashes": null
}
```

---

## Patch quote version (draft only)

**`PATCH /api/v1/quote-versions/{quoteVersionId}`**

### Request

```json
{
  "title": "Option A — revised title",
  "pinnedWorkflowVersionId": "wv_…"
}
```

### Response `200`

Same shape as create; **`composePreviewStalenessToken`** rotated if any field changed.

### Errors

- `409` — not `DRAFT`

---

## Create quote line item

**`POST /api/v1/quote-versions/{quoteVersionId}/line-items`**

### Request

```json
{
  "proposalGroupId": "pg_…",
  "sortOrder": 10,
  "scopePacketRevisionId": "spr_…",
  "tierCode": "GOLD",
  "quantity": 1,
  "executionMode": "SOLD_SCOPE",
  "title": "Roof — full replacement",
  "description": "Tear-off, ice & water, architectural shingles.",
  "unitPriceCents": 2500000,
  "lineTotalCents": 2500000
}
```

**Scope pin (manifest lines):** send **`scopePacketRevisionId` *or* `quoteLocalPacketId`**, never both, never neither when the line requires packet-backed scope (`04`, `planning/01` §5–6). Example above is the **catalog** path.

### Response `201`

```json
{
  "id": "li_…",
  "quoteVersionId": "qv_…",
  "proposalGroupId": "pg_…",
  "sortOrder": 10,
  "scopePacketRevisionId": "spr_…",
  "quoteLocalPacketId": null,
  "tierCode": "GOLD",
  "quantity": 1,
  "executionMode": "SOLD_SCOPE",
  "title": "Roof — full replacement",
  "description": "Tear-off, ice & water, architectural shingles.",
  "unitPriceCents": 2500000,
  "lineTotalCents": 2500000
}
```

**Side effect:** parent `QuoteVersion.composePreviewStalenessToken` rotated.

---

## Update quote line item

**`PATCH /api/v1/quote-versions/{quoteVersionId}/line-items/{lineItemId}`**

### Request (partial)

```json
{
  "quantity": 2,
  "lineTotalCents": 5000000
}
```

### Response `200` — full line DTO (same as create body + `id`).

### Errors

- `409` — version not `DRAFT`

---

## Delete quote line item

**`DELETE /api/v1/quote-versions/{quoteVersionId}/line-items/{lineItemId}`**

### Response `204`

**Side effect:** staleness token rotated.

### Errors

- `409` — version not `DRAFT`

---

## Compose preview (synchronous)

**`POST /api/v1/quote-versions/{quoteVersionId}/compose-preview`**

### Request

```json
{
  "clientStalenessToken": "st_abc123",
  "acknowledgedWarningCodes": ["MISSING_OPTIONAL_DESCRIPTION"]
}
```

### Response `200`

```json
{
  "quoteVersionId": "qv_…",
  "stalenessToken": "st_abc123",
  "staleness": "fresh",
  "errors": [],
  "warnings": [
    {
      "code": "MISSING_OPTIONAL_DESCRIPTION",
      "message": "Line item has no description.",
      "lineItemId": "li_…",
      "details": {}
    }
  ],
  "stats": {
    "lineItemCount": 3,
    "planTaskCount": 17,
    "packageTaskCount": 12,
    "skeletonSlotCount": 4,
    "soldSlotCount": 8
  },
  "planPreview": {
    "schemaVersion": "generatedPlanSnapshot.v0",
    "rows": []
  },
  "packagePreview": {
    "schemaVersion": "executionPackageSnapshot.v0",
    "slots": [],
    "diagnostics": { "errors": [], "warnings": [] }
  }
}
```

### Errors

- `409` — version `SENT` (preview forbidden)
- `200` with non-empty `errors` — **blocking** (send not allowed until fixed)

---

## Send (freeze)

**`POST /api/v1/quote-versions/{quoteVersionId}/send`**

### Preconditions (all enforced)

- `status === DRAFT`
- `clientStalenessToken` **matches** `composePreviewStalenessToken`
- `acknowledgedWarningCodes` contains **every** warning code returned by the **last successful preview** for this token (or re-run preview in same request — **not** in v0; **strict:** client must send ack list matching **current** warnings from latest preview)

**Slice 1 strict rule:** Server compares `acknowledgedWarningCodes` to the set of `warnings[].code` from **compose result inside the transaction** (re-run compose). Caller must pass ack for **all** warning codes from that compose run. Mismatch → `422` + `WARNINGS_NOT_ACKNOWLEDGED`.

### Request

```json
{
  "clientStalenessToken": "st_abc123",
  "acknowledgedWarningCodes": ["MISSING_OPTIONAL_DESCRIPTION"],
  "sendClientRequestId": "idempotency-key-uuid"
}
```

### Response `200` — **Get quote version (without snapshots)**

Same as **Get quote version** below: **no** large blobs by default (even after send).

```json
{
  "id": "qv_…",
  "quoteId": "qt_…",
  "versionNumber": 1,
  "status": "SENT",
  "pinnedWorkflowVersionId": "wv_…",
  "title": "Option A — Architectural shingles",
  "createdAt": "2026-04-11T12:03:00.000Z",
  "createdById": "usr_…",
  "sentAt": "2026-04-11T12:10:00.000Z",
  "sentById": "usr_…",
  "composePreviewStalenessToken": null,
  "snapshotHashes": {
    "planSnapshotSha256": "…64 hex…",
    "packageSnapshotSha256": "…64 hex…"
  },
  "snapshots": null,
  "proposalGroups": [],
  "quoteLineItems": []
}
```

### Errors

| Code | HTTP |
|------|------|
| Stale token | `422` `STALE_COMPOSE_TOKEN` |
| Warnings not ack’d | `422` `WARNINGS_NOT_ACKNOWLEDGED` |
| Compose errors | `422` with compose errors in body |
| Not draft / concurrent send | `409` |
| Idempotent replay | `200` same summary |

---

## Get quote version (default: omit snapshots)

**`GET /api/v1/quote-versions/{quoteVersionId}`**

No query → **omit** `generatedPlanSnapshot` / `executionPackageSnapshot`.

### Response `200`

```json
{
  "id": "qv_…",
  "quoteId": "qt_…",
  "versionNumber": 1,
  "status": "SENT",
  "pinnedWorkflowVersionId": "wv_…",
  "title": "Option A — Architectural shingles",
  "createdAt": "2026-04-11T12:03:00.000Z",
  "createdById": "usr_…",
  "sentAt": "2026-04-11T12:10:00.000Z",
  "sentById": "usr_…",
  "composePreviewStalenessToken": null,
  "snapshotHashes": {
    "planSnapshotSha256": "…",
    "packageSnapshotSha256": "…"
  },
  "snapshots": null,
  "proposalGroups": [
    { "id": "pg_…", "quoteVersionId": "qv_…", "name": "Items", "sortOrder": 0 }
  ],
  "quoteLineItems": []
}
```

---

## Get quote version with snapshots

**`GET /api/v1/quote-versions/{quoteVersionId}?include=snapshots`**

### Response `200`

Same as above, plus:

```json
{
  "snapshots": {
    "generatedPlanSnapshot": { "schemaVersion": "generatedPlanSnapshot.v0", "rows": [] },
    "executionPackageSnapshot": { "schemaVersion": "executionPackageSnapshot.v0", "slots": [], "diagnostics": { "errors": [], "warnings": [] } }
  }
}
```

**Behavior:** For `DRAFT`, `snapshots` is **`null`** (no blobs). For `SENT`, blobs populated when included.

### Errors

- `403` / `404` — auth, missing version

---

## Deferred DTOs

Catalog listing, proposal-group CRUD, user auth — **out of this file** or minimal stubs in implementation.

---

## Classification

| Topic | Type |
|------|------|
| Strict warning ack on send | **Codepack default** |
| Default omit snapshots | **Codepack default** |
