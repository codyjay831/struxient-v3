# Slice 1 — Enums and shared types

**Authority:** `docs/schema-slice-1-codepack` defaults + `docs/schema-slice-1/07-snapshot-shape-v0.md`.

---

## Prisma enums (persisted)

### `QuoteVersionStatus`

| Value | Meaning |
|-------|---------|
| `DRAFT` | Editable; snapshots null |
| `SENT` | Frozen; snapshots required |

**No** `SIGNED` / `ACTIVATED` in Slice 1 schema.

---

### `ScopePacketRevisionStatus`

| Value | Meaning |
|-------|---------|
| `DRAFT` | Not pin-able for send (Slice 1 seeds typically skip) |
| `PUBLISHED` | Pin-able; lines immutable in app |

---

### `WorkflowVersionStatus`

| Value | Meaning |
|-------|---------|
| `DRAFT` | Not pin-able |
| `PUBLISHED` | Pin-able; snapshot immutable |

---

### `PacketTaskLineKind`

| Value | Meaning |
|-------|---------|
| `EMBEDDED` | **Only value used in Slice 1** (`embeddedPayloadJson` required) |

**Deferred:** `LIBRARY` + `TaskDefinition` FK — add when catalog authoring needs it.

---

### `QuoteLineItemExecutionMode`

| Value | Meaning |
|-------|---------|
| `SOLD_SCOPE` | Default sold expansion / binding |
| `MANIFEST` | Manifest-oriented line (Slice 1 subset; compose rules per `07-compose-engine-input-output-spec.md`) |

**Deferred:** additional modes from epics — do not add without product sign-off.

---

### `AuditEventType`

| Value | Meaning |
|-------|---------|
| `QUOTE_VERSION_SENT` | Successful freeze |

**Deferred:** other audit types.

---

## API / compose: error and warning codes (canonical strings)

Persisted inside JSON (`executionPackageSnapshot.diagnostics`, preview response). **Stabilize these literals** in a shared const module at implementation time.

### Blocking (examples — align with `schema-slice-1/05`)

| Code | Use |
|------|-----|
| `WORKFLOW_NOT_PINNED` | `pinnedWorkflowVersionId` null |
| `WORKFLOW_NOT_PUBLISHED` | Pin invalid |
| `NO_LINE_ITEMS` | Zero lines |
| `LINE_PACKET_MISSING` | Missing revision on line |
| `LINE_QTY_INVALID` | `quantity` ≤ 0 |
| `TIER_NOT_IN_PACKET` | Tier not allowed for revision |
| `EXPANSION_EMPTY` | No packet lines after tier filter |
| `PACKAGE_BIND_FAILED` | Cannot bind to workflow graph |
| `SNAPSHOT_SCHEMA_INVALID` | `WorkflowVersion.snapshotJson` invalid |
| `STALE_COMPOSE_TOKEN` | Send: token mismatch |
| `WARNINGS_NOT_ACKNOWLEDGED` | Send: strict ack failed (**codepack default**) |

### Non-blocking warning examples

| Code | Use |
|------|-----|
| `MISSING_OPTIONAL_DESCRIPTION` | Empty description |
| `COMMERCIAL_TOTAL_MISMATCH` | Totals disagree (if validated) |

**Implementation:** use **string** codes in JSON; optional TypeScript `enum` or `as const` — **not** a Prisma enum unless you add a `ViolationCode` table (deferred).

---

## Snapshot JSON: discriminant strings (frozen blobs)

| Location | Field | Allowed values (examples) |
|----------|-------|---------------------------|
| Plan row | `taskKind` | `LABOR`, `MATERIAL`, `OTHER` (extend in v1) |
| Package slot | `source` | `SOLD_SCOPE`, `SKELETON`, `MANUAL_PLAN_STUB` |
| Root | `schemaVersion` | `generatedPlanSnapshot.v0`, `executionPackageSnapshot.v0` |

---

## Money conventions

| Rule | Detail |
|------|--------|
| Storage | `Int` **cents** (USD-style) unless product picks minor units per currency later |
| Nullable | `unitPriceCents`, `lineTotalCents` optional on line |
| Range | `>= 0` at validation |
| **Deferred** | `currencyCode`, `BigInt`, fractional cents |

---

## Timestamp conventions

| Rule | Detail |
|------|--------|
| DB | `DateTime` — PostgreSQL `TIMESTAMPTZ` in migration |
| API | ISO-8601 **UTC** with `Z` suffix in JSON examples |
| `publishedAt`, `sentAt`, `generatedAt` / `composedAt` in snapshots | Same |

---

## ID conventions

| Context | Format |
|---------|--------|
| Relational PKs / FKs | Opaque string (cuid recommended) |
| `planTaskId`, `packageTaskId` in snapshots | Deterministic string per `07` + compose spec (prefix + hash or hierarchical key) |
| **Forbidden in Slice 1 blobs** | `runtimeTaskId`, `flowId`, bare `taskId` |

---

## Boolean / flags

No Slice 1 persisted boolean enums beyond status enums above.

---

## Classification

| Item | Type |
|------|------|
| Single `PacketTaskLineKind` value | **Codepack default** (EMBEDDED-only seeds) |
| Warning codes as strings | **Slice 1** (stable literals) |
| `WARNINGS_NOT_ACKNOWLEDGED` | **Codepack default** for strict send |
