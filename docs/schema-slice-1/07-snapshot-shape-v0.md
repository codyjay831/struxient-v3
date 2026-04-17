# Slice 1 — Snapshot shape v0 (planning-level JSON)

**Companion:** `planning/01-id-spaces-and-identity-contract.md`, `06-send-freeze-transaction-design.md`.

**Normative:** Field names and id spaces below are **contract** for Slice 1 freeze; normalization to tables is **deferred** (O12).

---

## `generatedPlanSnapshot` v0

### Root object

```json
{
  "schemaVersion": "generatedPlanSnapshot.v0",
  "quoteVersionId": "…",
  "pinnedWorkflowVersionId": "…",
  "generatedAt": "ISO-8601",
  "rows": [ … ]
}
```

### Required top-level fields

| Field | Purpose |
|-------|---------|
| `schemaVersion` | Migration discriminator |
| `quoteVersionId` | Boundary |
| `pinnedWorkflowVersionId` | Pin echo |
| `generatedAt` | Freeze time (may equal `sentAt`) |
| `rows` | Non-empty array |

### `rows[]` element (minimum)

Every row is a **tagged** scope expansion: **`scopeSource`** selects which pin fields are present. **Normative** ingredients for `planTaskId` match `planning/01-id-spaces-and-identity-contract.md` §6.

| Field | Required | Notes |
|-------|----------|-------|
| `planTaskId` | yes | Deterministic string; stable across re-send **only** if inputs identical — **after send**, immutable |
| `lineItemId` | yes | Commercial provenance |
| `scopeSource` | yes | `LIBRARY_PACKET` \| `QUOTE_LOCAL_PACKET` — **required**; do not infer from optional fields alone (`planning/01` §6.2) |
| `scopePacketRevisionId` | iff `LIBRARY_PACKET` | Catalog pin; **absent** when `scopeSource = QUOTE_LOCAL_PACKET` |
| `packetLineKey` | iff `LIBRARY_PACKET` | From `PacketTaskLine.lineKey`; **absent** when `scopeSource = QUOTE_LOCAL_PACKET` |
| `quoteLocalPacketId` | iff `QUOTE_LOCAL_PACKET` | Quote-owned packet container; **absent** when `scopeSource = LIBRARY_PACKET` |
| `localLineKey` | iff `QUOTE_LOCAL_PACKET` | From **`QuoteLocalPacketItem.lineKey`** (same structural role as `packetLineKey`); **absent** when `scopeSource = LIBRARY_PACKET` |
| `targetNodeKey` | yes | Placement reference into **pinned** `WorkflowVersion.snapshotJson` — **required** for deterministic identity (`planning/01` §6.3–6.4) |
| `tierCode` | optional | Echo from line / packet line |
| `quantityIndex` | yes | 0..`quantity-1` if explode-per-qty; **Slice 1 decision:** **explode** per unit index for clarity |
| `title` | yes | Display string from embedded payload or definition |
| `taskKind` | yes | e.g. `LABOR`, `MATERIAL` stub for UI |
| `sortKey` | yes | Deterministic ordering string (group + line + packet order + index) |

**Forbidden:** `runtimeTaskId`, bare `taskId`.

**XOR (manifest line → plan rows):** A given `lineItemId`’s expansion uses **either** library revision lines **or** quote-local packet lines for that freeze — reflected per row via `scopeSource` and the matching id/key pair (`planning/01` §6.1).

### Omitted in v0 (allowed)

| Omitted | Future |
|---------|--------|
| `structuredInputRefs` | When answers exist |
| `assemblyProvenance` | Epic 20 |
| Rich pricing breakdown | Commercial engine |

---

## `executionPackageSnapshot` v0

### Root object

```json
{
  "schemaVersion": "executionPackageSnapshot.v0",
  "quoteVersionId": "…",
  "pinnedWorkflowVersionId": "…",
  "composedAt": "ISO-8601",
  "slots": [ … ],
  "diagnostics": { … }
}
```

### Required top-level fields

| Field | Purpose |
|-------|---------|
| `schemaVersion` | Migration discriminator |
| `quoteVersionId` | Boundary |
| `pinnedWorkflowVersionId` | Template boundary |
| `composedAt` | Freeze time |
| `slots` | Non-empty **after** successful bind (if zero slots, send should error) |
| `diagnostics` | Errors/warnings echo |

### `slots[]` element (minimum)

| Field | Required | Notes |
|-------|----------|-------|
| `packageTaskId` | yes | Deterministic per slot |
| `nodeId` | yes | From `WorkflowVersion.snapshotJson` |
| `source` | yes | Enum: `SOLD_SCOPE`, `SOLD_SCOPE_LOCAL` (optional discriminator if slot-level source desired), `SKELETON`, `MANUAL_PLAN_STUB` — **each bound `planTaskId` still carries row-level `scopeSource`** (`planning/01` §6.8) |
| `planTaskIds` | yes | Non-empty for `SOLD_SCOPE`; may be empty for pure skeleton slot |
| `skeletonTaskId` | optional | Required when `source` is `SKELETON` or hybrid binding |
| `lineItemIds` | optional | Dedup list for provenance |
| `displayTitle` | yes | UI |

**Forbidden:** `runtimeTaskId`, `flowId`, bare `taskId`.

### `diagnostics` object

```json
{
  "errors": [],
  "warnings": []
}
```

Each item matches `05` shape (`code`, `message`, optional ids).

**Slice 1 rule:** At successful send, `errors` **must** be `[]` (diagnostics echo **last validation**; may be empty).

---

## Error / warning representation inside package snapshot

- Use **same** `code` strings as API (`05`) where possible.
- **Do not** duplicate full stack traces in v0.

---

## IDs that must appear

| Snapshot | IDs |
|----------|-----|
| Plan | `quoteVersionId`, per-row `planTaskId`, `lineItemId`, **`scopeSource`**, **`targetNodeKey`**, and **either** (`scopePacketRevisionId` + `packetLineKey`) **or** (`quoteLocalPacketId` + `localLineKey`) |
| Package | `quoteVersionId`, per-slot `packageTaskId`, `nodeId`, optional `skeletonTaskId` |

---

## Future normalization (deferred)

- Tables: `PlanTaskRow`, `PackageTaskSlot` with FK `quoteVersionId`.
- Extract `diagnostics` to `QuoteVersionSendDiagnostics` — **not** Slice 1.

---

## Naming

- Use **scope packet** terminology in plan rows — never **execution package** for catalog (`canon/09`).
- **`localLineKey`** in JSON = **`QuoteLocalPacketItem.lineKey`** in schema docs (same pattern as `packetLineKey` ↔ `PacketTaskLine.lineKey`).

---

## Classification

| Item | Type |
|------|------|
| Separate plan vs package snapshots | **Settled** |
| `quantityIndex` explosion | **Slice 1 decision** |
| Empty slots allowed | **No** — send errors |
