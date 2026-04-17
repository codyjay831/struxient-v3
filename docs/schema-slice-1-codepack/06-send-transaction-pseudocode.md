# Slice 1 — Send / freeze transaction (pseudocode)

**Defaults:** Synchronous compose; strict **warning acknowledgment** vs warnings from **compose run inside transaction**; `composePreviewStalenessToken` → `null` on success; insert `AuditEvent`.

---

## Inputs

- `quoteVersionId`
- `tenantId` (from auth)
- `actorUserId`
- `clientStalenessToken`
- `acknowledgedWarningCodes[]`
- `sendClientRequestId?` (idempotency)

## Outputs

- Success: persisted `QuoteVersion` with `SENT`, blobs, hashes, audit row
- Failure: rollback; draft unchanged

---

## Pseudocode

```
function sendQuoteVersion(quoteVersionId, tenantId, actorUserId, clientStalenessToken, acknowledgedWarningCodes, sendClientRequestId):
  BEGIN TRANSACTION

  // --- Lock order: parent quote version first (single row) ---
  qv = SELECT * FROM QuoteVersion
       WHERE id = quoteVersionId
       FOR UPDATE

  IF qv IS NULL:
    ROLLBACK; return 404

  IF qv.tenantId != tenantId via join Quote:  // resolve tenant through Quote
    ROLLBACK; return 403

  // --- Idempotency path (no re-compose) ---
  IF qv.status == SENT AND sendClientRequestId IS NOT NULL AND qv.sendClientRequestId == sendClientRequestId:
    COMMIT  // nothing to do
    return 200(buildResponse(qv, includeSnapshots=false))

  IF qv.status == SENT:
    ROLLBACK; return 409("ALREADY_SENT")

  IF qv.status != DRAFT:
    ROLLBACK; return 409("INVALID_STATUS")

  IF sendClientRequestId IS NOT NULL AND EXISTS other row with same sendClientRequestId different id:  // if global unique
    ROLLBACK; return 409("IDEMPOTENCY_KEY_REUSE")

  // --- Staleness ---
  IF qv.composePreviewStalenessToken IS NULL OR qv.composePreviewStalenessToken != clientStalenessToken:
    ROLLBACK; return 422("STALE_COMPOSE_TOKEN")

  // --- Preconditions P3–P5 ---
  IF qv.pinnedWorkflowVersionId IS NULL:
    ROLLBACK; return 422("WORKFLOW_NOT_PINNED")

  wv = SELECT * FROM WorkflowVersion WHERE id = qv.pinnedWorkflowVersionId FOR SHARE
  IF wv.status != PUBLISHED:
    ROLLBACK; return 422("WORKFLOW_NOT_PUBLISHED")

  lines = SELECT * FROM QuoteLineItem WHERE quoteVersionId = qv.id ORDER BY ...
  IF lines.count == 0:
    ROLLBACK; return 422("NO_LINE_ITEMS")

  FOR EACH line IN lines:
    IF line.quantity <= 0:
      ROLLBACK; return 422(...)
    VERIFY proposalGroup.quoteVersionId == qv.id
    // Manifest scope XOR (see `04-slice-1-relations-and-invariants.md`, `planning/01` §5–6)
    IF line requires manifest packet scope (per executionMode / product rules):
      IF NOT exactly_one_non_null(line.scopePacketRevisionId, line.quoteLocalPacketId):
        ROLLBACK; return 422("LINE_PACKET_MISSING")
      IF line.scopePacketRevisionId IS NOT NULL:
        VERIFY scopePacketRevision.status == PUBLISHED AND tenant matches quote.tenantId
      ELSE:
        VERIFY quoteLocalPacket.quoteVersionId == qv.id AND tenant matches AND local items loadable for expansion

  // --- Compose (same library as preview) ---
  result = ComposeEngine.run(
    quoteVersion = qv,
    workflowVersion = wv,
    lineItems = lines,
    proposalGroups = loaded ordered groups
  )

  IF result.errors IS NOT EMPTY:
    ROLLBACK; return 422 with result.errors

  // --- Strict warning acknowledgment (codepack default) ---
  requiredWarningCodes = DISTINCT result.warnings.map(w => w.code)
  IF NOT isSubset(requiredWarningCodes, acknowledgedWarningCodes):
    ROLLBACK; return 422("WARNINGS_NOT_ACKNOWLEDGED", missing = requiredWarningCodes - acknowledgedWarningCodes)

  IF EXISTS code IN acknowledgedWarningCodes WHERE code NOT IN requiredWarningCodes:
    // Optional policy: ignore extras OR reject — recommend reject strictness for honesty
    ROLLBACK; return 422("UNKNOWN_WARNING_ACK")

  planJson = buildGeneratedPlanSnapshotV0(result.planRows, qv, wv)
  packageJson = buildExecutionPackageSnapshotV0(result.packageSlots, result.diagnostics, qv, wv)

  planHash = SHA256_UTF8(canonicalJson(planJson))
  packageHash = SHA256_UTF8(canonicalJson(packageJson))

  // --- Persist version ---
  UPDATE QuoteVersion SET
    status = SENT,
    sentAt = now(),
    sentById = actorUserId,
    sendClientRequestId = COALESCE(sendClientRequestId, qv.sendClientRequestId),
    planSnapshotSha256 = planHash,
    packageSnapshotSha256 = packageHash,
    generatedPlanSnapshot = planJson,
    executionPackageSnapshot = packageJson,
    composePreviewStalenessToken = NULL
  WHERE id = qv.id AND status = DRAFT

  IF UPDATE rowcount != 1:
    ROLLBACK; return 409("CONCURRENT_MUTATION")

  INSERT AuditEvent (
    tenantId, eventType = QUOTE_VERSION_SENT, actorId = actorUserId,
    targetQuoteVersionId = qv.id,
    payloadJson = { planSnapshotSha256: planHash, packageSnapshotSha256: packageHash }
  )

  COMMIT
  return 200(buildResponse(reload(qv), includeSnapshots=false))
```

---

## Rollback conditions (summary)

| Trigger | Effect |
|---------|--------|
| Any validation failure | `ROLLBACK`, draft unchanged |
| Compose errors | `ROLLBACK` |
| Warning ack mismatch | `ROLLBACK` |
| Concurrent send (`UPDATE` lost) | `ROLLBACK` / `409` |
| Serialization / JSON error | `ROLLBACK` |

---

## Lock order rationale

1. `QuoteVersion` **FOR UPDATE** — serializes concurrent sends on same version.
2. `WorkflowVersion` **FOR SHARE** (optional) — prevents concurrent deletion during send (catalog should not delete published pin).

**Do not** lock entire `Quote` table.

---

## Hash generation

- UTF-8 bytes of JSON with **stable key ordering** (e.g. recursively sort keys).
- Algorithm: SHA-256, hex lowercase **64** chars.

---

## Idempotency path detail

- If `sendClientRequestId` provided on **first** success, persist on row.
- **Retry:** same id + already `SENT` → return **200** without recomputing hashes (read row).
- **First request in flight + duplicate:** second blocks on `FOR UPDATE` until first commits; then sees `SENT` and same key → **200**.

---

## Classification

| Item | Type |
|------|------|
| Warning ack vs in-txn compose | **Codepack default** — ack must match warnings from **this** compose |
| Audit insert in same txn | **Recommended** |
