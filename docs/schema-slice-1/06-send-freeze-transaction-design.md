# Slice 1 — Send / freeze transaction design

**Companion:** `04-slice-1-relations-and-invariants.md`, `05-compose-preview-contract.md`, `07-snapshot-shape-v0.md`.

---

## Mission

**Send** transitions **one** `QuoteVersion` from **`draft` → `sent`** in **one atomic transaction** with **no partial freeze**: either **all** relational immutability rules + **both** snapshot blobs + integrity hashes + audit fields apply, or **none**.

---

## Required preconditions (all must pass before commit)

| # | Check |
|---|--------|
| P1 | `QuoteVersion.status == draft` |
| P2 | Actor has permission to send for tenant |
| P3 | `pinnedWorkflowVersionId` set and target `WorkflowVersion` published |
| P4 | ≥ 1 `QuoteLineItem` |
| P5 | Every line: manifest scope **XOR** satisfied (`scopePacketRevisionId` **or** `quoteLocalPacketId` per `04` / `planning/01` §5–6), pins resolvable, `quantity` > 0, `proposalGroupId` belongs to version |
| P6 | **Compose validation:** zero **blocking** errors (same engine as preview) |
| P7 | **Staleness:** `clientStalenessToken` matches `composePreviewStalenessToken` **or** client omits token only if product allows — **Slice 1 decision:** **require** match (force preview refresh before send) |
| P8 | Optional: `acknowledgedWarningCodes` contains all **blocking-for-send** warnings if product enables that mode |
| P9 | Idempotency: if `sendClientRequestId` already recorded on this version with `status = sent`, **return success** without recomputing |

---

## Transactional sequence (single DB transaction)

1. **`SELECT … FOR UPDATE`** `QuoteVersion` by id (and verify tenant).
2. Re-check **P1–P5** from locked row + child counts.
3. Run **compose** (deterministic ordering per `04`) → build `planRows[]` and `packageSlots[]` in memory.
4. Serialize **`generatedPlanSnapshot`** and **`executionPackageSnapshot`** per `07`; compute **SHA-256** of canonical JSON (UTF-8, normalized key order if specified in impl guide).
5. Re-check **P6** (errors) — if any, **ROLLBACK**.
6. **Update** `QuoteVersion`:
   - `status = sent`
   - `sentAt = now()`, `sentById = actor`
   - `sendClientRequestId = request.id` (if provided)
   - `planSnapshotSha256`, `packageSnapshotSha256`
   - `generatedPlanSnapshot`, `executionPackageSnapshot`
   - `composePreviewStalenessToken` = new token **or** leave frozen — **Slice 1 decision:** **replace** with **sent sentinel** or null; UI must not call preview for sent — **implement:** set to **`null`** on sent and reject preview API for sent versions
7. **No row changes** to `QuoteLineItem` / `ProposalGroup` content at send **beyond** what already exists — **Slice 1 decision:** line commercial state is **already final** in draft; send **does not rewrite** lines. **Immutability** enforced by **forbidding updates** after status flip (not by re-copy).
8. Optional: **insert** `AuditEvent` row `QUOTE_VERSION_SENT` with hashes.
9. **COMMIT**.

**If any step fails after lock:** **ROLLBACK** — version stays `draft`, snapshots remain null.

---

## What becomes immutable

| Entity / column | After commit |
|-----------------|--------------|
| `QuoteVersion.status` | `sent` only |
| `QuoteVersion` freeze columns | immutable |
| `QuoteLineItem` (all for version) | no updates/deletes |
| `ProposalGroup` (all for version) | no updates/deletes |
| Snapshots | never updated |

---

## What fields / statuses change

| Field | Before | After |
|-------|--------|-------|
| `status` | `draft` | `sent` |
| `sentAt`, `sentById` | null | set |
| `generatedPlanSnapshot` | null | JSON |
| `executionPackageSnapshot` | null | JSON |
| `planSnapshotSha256`, `packageSnapshotSha256` | null | set |
| `composePreviewStalenessToken` | opaque | null (sent) |

---

## Snapshot blobs written

1. **`generatedPlanSnapshot`** — v0 plan (`07`).
2. **`executionPackageSnapshot`** — v0 package (`07`).

**Both** required for `sent`. **Forbidden:** `sent` with one blob null.

---

## Audit / integrity metadata

| Metadata | Where |
|----------|--------|
| `sentById`, `sentAt` | `QuoteVersion` |
| SHA-256 hashes | `QuoteVersion` |
| Optional `AuditEvent` | append-only table |

**Purpose:** prove **when** and **who** sent; detect **accidental** blob tampering (app-level).

---

## Failures that must roll back

- DB constraint violation
- Serialization failure
- Validation error late in pipeline
- Concurrent send attempt (second locker sees `status != draft` → **abort** with conflict)

**No** “status sent but snapshot write failed” states allowed.

---

## Idempotency expectations

- **Header or body:** `Idempotency-Key` or `sendClientRequestId` tied to **quoteVersionId**.
- **First success:** persist key on `QuoteVersion`.
- **Retry:** same key returns **200** with same `quoteVersion` representation (snapshots present).

---

## Read-only sent view (post-commit)

**GET** sent version must return:

- Version metadata + **both** snapshots (or snapshots omitted for size **only if** separate download endpoint exists — **Slice 1 decision:** **inline** snapshots OK for demo size; **defer** chunking).

- Line items and groups **as frozen** (read from relational tables).

- **No** compose re-run for “truth” — **display** package/plan from JSON for structural view; relational lines for commercial grid.

---

## Concurrency

- Two sends same version: second must fail with **`409`** or **`422`** (not `500`).

---

## What not to do

- Do **not** create `Flow` / `RuntimeTask` in this transaction.
- Do **not** write **`runtimeTaskId`** into snapshots.
- Do **not** mark sent before snapshots validated against schema v0.

---

## Deferred

- Async send + job queue (see `11`).
- Outbox pattern for downstream systems.

---

## Classification

| Item | Type |
|------|------|
| Atomic send | **Settled** |
| Staleness required at send | **Slice 1 decision** |
| `composePreviewStalenessToken` null when sent | **Slice 1 decision** |
