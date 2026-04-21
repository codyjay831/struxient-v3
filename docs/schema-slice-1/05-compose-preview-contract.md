# Slice 1 — Compose preview contract

**Companion:** `06-send-freeze-transaction-design.md`, `07-snapshot-shape-v0.md`.

---

## Purpose

**Compose preview** is a **dry-run** that validates whether the current **draft** `QuoteVersion` can be frozen: expansion → plan rows → package slots, with **blocking errors** and **non-blocking warnings**. It **does not** persist freeze artifacts or change `status`.

---

## Settled vs Slice 1

| Aspect | Classification |
|--------|----------------|
| Preview must not mutate DB freeze columns | **Settled** |
| Staleness token on version bumped on draft mutation | **Slice 1 decision** |
| Warnings acknowledgeable in UI only; server may omit ack store in v0 | **Slice 1 decision** |

---

## Input data compose reads (server-side)

| Source | Fields / blobs |
|--------|----------------|
| `QuoteVersion` | `id`, `pinnedWorkflowVersionId`, `composePreviewStalenessToken` (for request echo/compare) |
| `WorkflowVersion` | `snapshotJson` for pinned id |
| `QuoteLineItem` (all for version) | `id`, `sortOrder`, **`scopePacketRevisionId`** and **`quoteLocalPacketId`** (manifest scope **XOR** — exactly one set per line when the line carries packet-backed scope; see `planning/01-id-spaces-and-identity-contract.md` §5.5, §6), `tierCode`, `quantity`, `executionMode`, commercial fields (for display in diagnostics only) |
| `ProposalGroup` | `id`, `sortOrder`, `name` |
| `ScopePacketRevision` + `PacketTaskLine` | Resolved lines per item after tier filter **when** `scopePacketRevisionId` is set |
| `QuoteLocalPacket` + `QuoteLocalPacketItem` | Resolved lines per item after tier filter **when** `quoteLocalPacketId` is set |
| Request body | Optional `clientStalenessToken`, optional `acknowledgedWarningCodes[]` |

**Does not read:** `StructuredInputAnswer`, runtime tables, leads.

---

## Output (conceptual)

| Part | Purpose |
|------|---------|
| `stalenessToken` | Current server token after read (equals `QuoteVersion.composePreviewStalenessToken`) |
| `staleness` | `fresh` \| `stale` — compare client-sent token to server |
| `errors[]` | **Blocking** — send must be rejected if any present |
| `warnings[]` | **Non-blocking** — send allowed if no errors; UI may require ack |
| `planPreview` | In-memory shape **mirroring** plan snapshot rows (not persisted) |
| `packagePreview` | In-memory shape **mirroring** package slots (not persisted) |
| `stats` | Trust metrics for UI (`05` below) |

---

## Validation: errors (blocking)

Send **must** fail if preview would produce any of these (same rules at send):

| Code (example) | Condition |
|------------------|-----------|
| `WORKFLOW_NOT_PINNED` | `pinnedWorkflowVersionId` null |
| `WORKFLOW_NOT_PUBLISHED` | Pin points to non-published version |
| `NO_LINE_ITEMS` | Zero line items on version |
| `LINE_PACKET_MISSING` | Manifest-scoped line: **neither** `scopePacketRevisionId` **nor** `quoteLocalPacketId` set (**XOR violation / missing pin**), **or** referenced revision / local packet row missing, **or** expansion yields zero tasks where the line requires scope |
| `LINE_QTY_INVALID` | `quantity` ≤ 0 or non-integer if integers only |
| `TIER_NOT_IN_PACKET` | `tierCode` invalid for revision |
| `EXPANSION_EMPTY` | After tier filter, packet yields zero tasks for a line |
| `PACKAGE_BIND_FAILED` | Cannot bind plan row to node / skeleton per workflow snapshot |
| `SNAPSHOT_SCHEMA_INVALID` | `WorkflowVersion.snapshotJson` fails structural validation |

**Slice 1:** Exact code list is **normative for product**; implementers **must not** invent silent failures.

---

## Validation: warnings (non-blocking)

Examples:

| Code | Meaning |
|------|---------|
| `COMMERCIAL_TOTAL_MISMATCH` | Sum of line totals ≠ displayed total (if UI computes) |
| `MISSING_OPTIONAL_DESCRIPTION` | Line has empty description |
| `PACKET_DEPRECATED` | Revision marked deprecated in metadata (if seeds add flag) |
| `PACKET_ITEMS_FILTERED_BY_TIER` | Tier filter excluded **some, but not all** candidate packet rows for a manifest line. Diagnostic only — inclusion/exclusion behavior is unchanged. Surfaces silent tier-mismatch risk that today only manifests as a fully-empty expansion (`EXPANSION_EMPTY`). Details: `lineTierCode`, `includedCount`, `excludedCount`, `sampleExcludedTierCodes`, plus `scopePacketRevisionId` (library packet) or `quoteLocalPacketId` (quote-local packet). |

**Slice 1 decision:** Server **returns** warnings; **optional** `acknowledgedWarningCodes` in send request — if product wants strict ack, send validates subset (**open** in `11` if not needed day one).

---

## Error vs warning JSON shape (items)

```json
{
  "code": "LINE_PACKET_MISSING",
  "message": "Line item L-42 has no valid scope pin (library revision or quote-local packet).",
  "lineItemId": "…",
  "details": {}
}
```

- **`lineItemId`**: optional, for line-scoped issues.
- **No bare `taskId`:** use `planTaskId` / `skeletonTaskId` only inside nested `details` when unambiguous.

---

## Suggested request JSON

```http
POST /api/v1/quote-versions/{quoteVersionId}/compose-preview
```

```json
{
  "clientStalenessToken": "opaque-or-null",
  "acknowledgedWarningCodes": ["MISSING_OPTIONAL_DESCRIPTION"]
}
```

---

## Suggested response JSON

```json
{
  "quoteVersionId": "…",
  "stalenessToken": "current-opaque",
  "staleness": "fresh",
  "errors": [],
  "warnings": [
    { "code": "MISSING_OPTIONAL_DESCRIPTION", "message": "…", "lineItemId": "…" }
  ],
  "stats": {
    "lineItemCount": 3,
    "planTaskCount": 17,
    "packageTaskCount": 12,
    "skeletonSlotCount": 4,
    "soldSlotCount": 8
  },
  "planPreview": {
    "rows": [
      {
        "planTaskId": "pt_…",
        "lineItemId": "…",
        "scopeSource": "LIBRARY_PACKET",
        "scopePacketRevisionId": "…",
        "packetLineKey": "…",
        "quantityIndex": 0,
        "targetNodeKey": "…",
        "title": "…"
      },
      {
        "planTaskId": "pt_…",
        "lineItemId": "…",
        "scopeSource": "QUOTE_LOCAL_PACKET",
        "quoteLocalPacketId": "…",
        "localLineKey": "…",
        "quantityIndex": 0,
        "targetNodeKey": "…",
        "title": "…"
      }
    ]
  },
  "packagePreview": {
    "slots": [
      {
        "packageTaskId": "pk_…",
        "nodeId": "…",
        "source": "SOLD_SCOPE",
        "planTaskIds": ["pt_…"],
        "skeletonTaskId": null
      }
    ]
  }
}
```

**Note:** `planPreview` / `packagePreview` **mirror** v0 snapshot content (`07`) but are **not** written to DB on preview.

**Normative (quote-local):** Each `planPreview.rows[]` element **must** include **`scopeSource`** (`LIBRARY_PACKET` \| `QUOTE_LOCAL_PACKET`). Library path rows carry `scopePacketRevisionId` + `packetLineKey`; quote-local rows carry `quoteLocalPacketId` + `localLineKey` (value from **`QuoteLocalPacketItem.lineKey`**). **Do not** infer path from optional-field presence alone (`planning/01` §6.2). Same `planTaskId` algorithm as send (`planning/01` §6.5).

---

## Preview staleness rules

1. On **any** successful mutation of draft graph (lines, groups, pin, commercial fields), server bumps `QuoteVersion.composePreviewStalenessToken`.
2. If request `clientStalenessToken` ≠ server token → response `staleness: "stale"` **and** still return computed preview **or** short-circuit with **errors** only — **Slice 1 decision:** return **`stale` + full preview** so UI can refresh; **send** must reject if client token stale (**Settled** honesty: no send on outdated draft without refresh).

**Deferred:** server-side TTL cache for heavy previews.

---

## What preview does NOT persist

- `generatedPlanSnapshot`
- `executionPackageSnapshot`
- `status` change
- Audit send events

---

## How preview relates to send

| Step | Preview | Send |
|------|---------|------|
| Runs expansion engine | yes | yes (same logic) |
| Writes JSON blobs | no | yes (transaction) |
| Enforces errors | returns | aborts txn |
| Enforces warnings | returns | optional ack check |
| Staleness | advisory | **blocking** at send |

---

## Permission expectations

Same as draft quote edit: tenant-scoped office role.

---

## What not to do

- Do **not** persist preview results as “draft snapshots” that could be mistaken for sent truth.
- Do **not** return **only** HTTP 200 with errors in body for **unauthorized** — use proper status codes.
- Do **not** embed **runtime** ids in preview response.

---

## Open issue (only if blocking)

See `11-slice-1-open-questions.md`: strict warning ack on send vs UI-only.
