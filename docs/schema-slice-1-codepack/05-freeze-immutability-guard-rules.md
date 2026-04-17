# Slice 1 — Freeze immutability guard rules (implementation-facing)

**Purpose:** Map design-pack rules to **what code and DB must enforce** after `QuoteVersion.status = SENT`.

---

## Rows that become immutable (logical)

| Model | Scope |
|-------|--------|
| `QuoteVersion` | Entire row for **business-mutable** fields: **freeze** all commercial + pin + snapshot fields listed below |
| `ProposalGroup` | All rows with `quoteVersionId = sentVersion` |
| `QuoteLineItem` | All rows with `quoteVersionId = sentVersion` |

**Append-only:** `AuditEvent` (no updates/deletes).

---

## Fields immutable after send (`QuoteVersion`)

| Field | After `SENT` |
|-------|----------------|
| `versionNumber` | Immutable |
| `status` | Immutable (`SENT` only) |
| `pinnedWorkflowVersionId` | Immutable |
| `title` | Immutable |
| `sentAt`, `sentById` | Immutable |
| `sendClientRequestId` | Immutable once set |
| `planSnapshotSha256`, `packageSnapshotSha256` | Immutable |
| `generatedPlanSnapshot`, `executionPackageSnapshot` | Immutable |
| `composePreviewStalenessToken` | Stays `null` |

**Allowed:** None of the above may change via API.

---

## Fields immutable after send (`ProposalGroup` / `QuoteLineItem`)

**All columns** — no `UPDATE`, no `DELETE`, no `INSERT` for new lines/groups on that version.

---

## APIs that must reject after send

| Operation | Condition |
|-----------|-----------|
| `PATCH /quote-versions/{id}` | `status === SENT` → **409** |
| `POST/DELETE/PATCH` line items | parent version `SENT` → **409** |
| `POST/PATCH/DELETE` proposal groups | parent version `SENT` → **409** |
| `POST …/compose-preview` | `SENT` → **409** |
| `POST …/send` | `SENT` → **409** or idempotent **200** if same idempotency key (design choice: **200** replay vs **409** — prefer **200** with same body if idempotency key matches) |

**Read:** `GET` always allowed (tenant-scoped).

---

## Application-layer guards (required)

1. **Early guard:** Every mutating handler loads `QuoteVersion.status` (or checks via FK parent) and returns **409** if `SENT`.
2. **Compose/send:** Only run on `DRAFT`.
3. **Transactional send:** All immutability is **effective** after commit; pre-commit draft remains editable — **no** partial `SENT`.
4. **Child mutations:** Line item routes **must** verify `line.quoteVersionId` resolves to `DRAFT`.

---

## DB constraints that help

| Constraint | Purpose |
|------------|---------|
| `CHECK (quantity > 0)` on `QuoteLineItem` | Data integrity |
| `NOT NULL` on `QuoteVersion.pinnedWorkflowVersionId` | **Do not** use at DB level for draft (nullable until send) — **app** enforces at send |
| Foreign keys `ON DELETE RESTRICT` | Prevents accidental cascade wipe of catalog/workflow referenced by sent lines |
| Unique `(quoteId, versionNumber)` | Version identity |

**Prisma note:** Sent immutability is **not** expressed as a single CHECK — optional **trigger** (PostgreSQL) to block `UPDATE` on `quote_versions` when `status = 'SENT'` is **nice-to-have**; **app remains source of truth** for Slice 1.

---

## Optional DB trigger (advanced)

```sql
-- Illustrative only: block updates to frozen quote_versions
CREATE OR REPLACE FUNCTION forbid_sent_quote_version_mutation() ...
```

**Deferred** unless compliance demands DB-enforced immutability.

---

## Snapshot blob integrity

- After insert at send, **application** must never issue `UPDATE` on JSON columns.
- **Hashes** (`planSnapshotSha256`, `packageSnapshotSha256`) computed from **canonical JSON**; on read, optional verify for diagnostics (not required every GET).

---

## What stays mutable (outside frozen version)

| Entity | Slice 1 |
|--------|---------|
| `Customer`, `FlowGroup` | Mutable (live CRM) |
| `Quote` shell | Mutable per design pack (`quoteNumber`) — **optional** app restriction |
| `ScopePacket*` / `Workflow*` | Seeded; catalog authoring deferred |

---

## Classification

| Layer | Responsibility |
|-------|----------------|
| Primary enforcement | **Application** (all mutating routes) |
| Secondary | **FK + check constraints** |
| Tertiary | **Triggers** (optional) |
