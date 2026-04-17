# Slice 1 — Relations and invariants

**Companion:** `03-slice-1-field-definitions.md`, `06-send-freeze-transaction-design.md`.

**Schema layering:** Core relations below + **extension paragraph** match **`docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`**. The codepack **v0 Prisma paste** may omit extension `model` blocks; **invariants here still apply** once those tables exist.

---

## Relationship map (textual)

```
Tenant
  ├── User
  ├── Customer
  ├── ScopePacket → ScopePacketRevision → PacketTaskLine
  ├── WorkflowTemplate → WorkflowVersion (snapshotJson)
  └── Quote → QuoteVersion → ProposalGroup
                          → QuoteLineItem
```

`FlowGroup` belongs to `Customer` (same `tenantId`).

`Quote` belongs to `Customer` + `FlowGroup`.

**Extension (canon-aligned):** `FlowGroup` 1—* `PreJobTask` (pre-activation only). `QuoteVersion` 1—* `QuoteLocalPacket` → `QuoteLocalPacketItem`. See `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`.

**No edges** from Quote domain to `Flow`, `Job`, `RuntimeTask`, `TaskExecution`.

---

## Cardinality expectations

| From | To | Cardinality | Notes |
|------|-----|-------------|-------|
| Tenant | * | 1 : N | All children carry `tenantId` |
| Customer | FlowGroup | 1 : N | |
| Customer | Quote | 1 : N | |
| FlowGroup | Quote | 1 : N | |
| Quote | QuoteVersion | 1 : N | Slice 1 UX may create one draft at a time; schema allows many |
| QuoteVersion | ProposalGroup | 1 : N | Slice 1 ≥ 1 (default “Items”) |
| ProposalGroup | QuoteLineItem | 1 : N | |
| QuoteVersion | QuoteLineItem | 1 : N | Lines reference version directly + group |
| ScopePacket | ScopePacketRevision | 1 : N | |
| ScopePacketRevision | PacketTaskLine | 1 : N | |
| WorkflowTemplate | WorkflowVersion | 1 : N | |
| QuoteVersion | WorkflowVersion | N : 1 | **pin** `pinnedWorkflowVersionId` |
| FlowGroup | PreJobTask | 1 : N | Pre-activation operational work only |
| QuoteVersion | QuoteLocalPacket | 1 : N | Local scope; immutable after send |
| QuoteLocalPacket | QuoteLocalPacketItem | 1 : N | |
| QuoteLineItem | QuoteLocalPacket | N : 1 | Optional; **XOR** with `scopePacketRevisionId` for manifest lines |

---

## Tenant scoping rules

1. **Every** relational row in Slice 1 (except optional platform tables) carries **`tenantId`** **or** inherits it through a chain whose root is tenant-scoped (`Customer`, `ScopePacket`, `WorkflowTemplate`, `Quote`).
2. **APIs** must resolve tenant from auth context; **forbidden:** cross-tenant FK by id guessing.
3. `QuoteLineItem.scopePacketRevisionId` must reference a revision whose packet’s `tenantId` equals the quote’s `tenantId`.
4. `QuoteLocalPacket.tenantId` must equal the parent `Quote`’s `tenantId` (and match `QuoteLineItem`’s version’s quote).

---

## Quote / version / line invariants

### QV-1 Version numbering

`QuoteVersion.versionNumber` is **strictly increasing** per `quoteId`, **unique** per quote.

### QV-2 Single mutable draft (product invariant, optional enforce)

**Slice 1 decision:** At most **one** `status = draft` version per quote **recommended** for UX; schema may allow multiple — if multiple drafts exist, **Send** targets **exactly one** `quoteVersionId` (client supplies id).

### QV-3 Draft mutability

While `status = draft`:

- `pinnedWorkflowVersionId` may be set/changed **until** send.
- Line items may be added/reordered/edited/deleted.
- Proposal groups may be added/reordered/renamed **only if** no sent version constraints (Slice 1: **simplest rule** — allow group CRUD in draft only).

### QV-4 Sent immutability (hard)

When `status = sent`:

- **No** inserts/updates/deletes to `QuoteLineItem` for that version.
- **No** updates to `ProposalGroup` for that version.
- **No** updates to commercial fields on `QuoteVersion` (title frozen at send).
- **No** change to `pinnedWorkflowVersionId`, `scopePacketRevisionId` / `quoteLocalPacketId` on lines, `quantity`, `tierCode`, `executionMode`, line commercial fields.
- **No** inserts/updates/deletes to `QuoteLocalPacket` / `QuoteLocalPacketItem` for that version.
- **`generatedPlanSnapshot`** and **`executionPackageSnapshot`** are **non-null** and **immutable**.
- **No** transition from `sent` → `draft` (no “un-send” in Slice 1).

### QV-5 Line integrity

- Every `QuoteLineItem.quoteVersionId` must match its `proposalGroupId`’s `quoteVersionId`.
- `sortOrder` is per-version (or per-group + version); compose must use **deterministic ordering** (specify: sort by `proposalGroup.sortOrder`, then `QuoteLineItem.sortOrder`, then `id` tie-break).

---

## Packet revision pinning (library **or** quote-local)

### Library path (unchanged)

1. When `QuoteLineItem.scopePacketRevisionId` is set, it must reference `ScopePacketRevision.status = published` (for draft→send validation policy unchanged).
2. **At send**, server **re-validates** revision still published (or accept **sent even if catalog retired** — **Slice 1 decision:** **allow sent** if revision row still exists; **block send** if revision deleted — catalog seeds should not delete; **open** only if soft-delete introduced).
3. Effective packet lines for expansion = lines where `tierCode` is null **or** matches line item `tierCode` per `epic 19` rules (documented in compose contract).

### Local packet path (extension)

1. For manifest scope lines, **`scopePacketRevisionId` and `quoteLocalPacketId` are mutually exclusive** — exactly one non-null.
2. When `quoteLocalPacketId` is set, `QuoteLocalPacket.quoteVersionId` **must equal** `QuoteLineItem.quoteVersionId`.
3. Expansion reads **`QuoteLocalPacketItem`** rows (same tier filtering semantics as catalog lines where `tierCode` applies).
4. After `QuoteVersion.status = sent`, **`QuoteLocalPacket` and `QuoteLocalPacketItem` are immutable** for that version (same class as QV-4 line immutability).

**Authority:** `docs/implementation/decision-packs/quotelocalpacket-schema-decision-pack.md`, `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`.

---

## Workflow version pinning

1. `QuoteVersion.pinnedWorkflowVersionId` must reference `WorkflowVersion.status = published`.
2. **Compose** and **send** read **only** `WorkflowVersion.snapshotJson` for that id — **no live template mutation** affects a sent version.
3. **Skeleton task ids** in package snapshot **must** appear in that snapshot graph (`planning/01`).

---

## Identity boundaries in artifacts

1. **`generatedPlanSnapshot`** plan rows carry **`planTaskId`**, **`scopeSource`**, and scope pins per **`07-snapshot-shape-v0.md`** / **`planning/01` §6** — **never** `runtimeTaskId`, **never** bare `taskId`.
2. **`executionPackageSnapshot`** contains **`packageTaskId`** and **`skeletonTaskId`** (with `source`) where applicable — **never** `runtimeTaskId` in Slice 1.
3. **`lineItemId`** may appear as **provenance** on plan rows / package slots — **must not** be used as execution key.

---

## Compose preview vs persistence

- Preview **does not** create or mutate freeze columns.
- Preview **may** use same engine as send for validation; **must not** flip `status` or write snapshots.

---

## Idempotency

- **Send** keyed by `sendClientRequestId` on `QuoteVersion` (optional but recommended): duplicate request with same id **returns same sent entity** without double write (`06`).

---

## What can change after send (allowlist)

| Area | Allowed |
|------|---------|
| `Quote.quoteNumber` | **No** for integrity — **Slice 1 decision:** quote shell fields **mutable** but **do not affect** sent version read-only view |
| `Customer.name` | Yes (live read with UI disclaimer) |
| `FlowGroup.name` | Yes |
| New draft `QuoteVersion` on same quote | **Deferred** optional — Slice 1 may ship **single version path** only; if multiple versions exist, only **one sent** per version row |

---

## What not to do

- Do **not** add `flowId` to `QuoteVersion` in Slice 1.
- Do **not** store **partial** snapshots (one column set, other null) with `status = sent`.
- Do **not** rename catalog concepts to “package” in user-facing field names (`canon/09`).

---

## Settled vs Slice 1 vs deferred

| Rule | Classification |
|------|----------------|
| Sent version immutable | **Settled** |
| Hybrid relational + JSON freeze | **Slice 1 decision** |
| Multi-draft quotes | **Slice 1** optional; **simplest** single draft |
| Catalog soft-delete vs send | **Slice 1 decision** above |
| Normalized plan/package tables | **Deferred** |
