# Slice 1 — Entity list

**Companion:** `01-slice-1-scope.md`, `03-slice-1-field-definitions.md`.

**Prisma / migration layering:** Base models appear in `docs/schema-slice-1-codepack/03-prisma-schema-draft-v0.md`. **`PreJobTask`**, **`QuoteLocalPacket`**, and **`QuoteLocalPacketItem`** are **normative** Slice 1 extensions in `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md` (merge into `schema.prisma` — not a separate “maybe later” product track).

---

## Legend

| Column | Meaning |
|--------|---------|
| **Storage** | `relational` = row(s) in DB; `snapshot_json` = column blob on `QuoteVersion`; `embedded_in_json` = lives only inside snapshot blob |
| **Mutability** | After **send**, relational quote rows governed by **sent rules** (`04-slice-1-relations-and-invariants.md`) |

---

## Entities

### Tenant

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Isolation boundary for all rows (`epic 60` subset). |
| **Storage** | relational |
| **Mutability** | Admin-managed; not part of quote freeze. |
| **Upstream** | none |
| **Downstream** | All tenant-scoped entities |

### User

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Actor for `createdBy` / `sentBy`; auth subject. |
| **Storage** | relational |
| **Mutability** | Platform-managed. |
| **Upstream** | Tenant |
| **Downstream** | Audit fields on quote entities |

### Customer

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Quote shell anchor (`epic 02`, `epic 07`). |
| **Storage** | relational |
| **Mutability** | Mutable; **sent quote does not rewrite** customer snapshot fields in Slice 1 (optional `customerSnapshotJson` **deferred** — not required for Slice 1 read-only view if UI reads live customer **with label** “may have changed since send”). **Slice 1 decision:** **no** `customerSnapshotJson` column; read-only sent view shows **frozen line commercial text** + live customer name/address **with disclaimer banner** in UI contract. |
| **Upstream** | Tenant |
| **Downstream** | `Quote`, `FlowGroup` |

### FlowGroup

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Project/site anchor (`epic 03`, `epic 07`). |
| **Storage** | relational |
| **Mutability** | Mutable pre-send; post-send edits **do not** mutate quote version. |
| **Upstream** | Tenant, Customer |
| **Downstream** | `Quote`, `PreJobTask` (pre-activation operational work — see `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`) |

### ScopePacket

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Stable `packetKey` container for revisions (`epic 15`). |
| **Storage** | relational |
| **Mutability** | Seeded; authoring CRUD deferred. |
| **Upstream** | Tenant |
| **Downstream** | `ScopePacketRevision` |

### ScopePacketRevision

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Immutable **library** scope revision for lines on the catalog path (`planning/01` `scopePacketRevisionId`, `epic 15`). Manifest lines may instead pin **`QuoteLocalPacket`** (XOR — `slice-1-extension-prejobtask-quotelocalpacket.md`). |
| **Storage** | relational |
| **Mutability** | **Immutable** after publish flag; Slice 1 seeds = published. |
| **Upstream** | ScopePacket |
| **Downstream** | `PacketTaskLine`, `QuoteLineItem` (draft reference) |

### PacketTaskLine

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Placement + meaning for expansion (`epic 16`, `canon/02`). |
| **Storage** | relational |
| **Mutability** | Immutable under published revision. |
| **Upstream** | ScopePacketRevision |
| **Downstream** | Compose engine reads for expansion |

### QuoteLocalPacket

| Aspect | Detail |
|--------|--------|
| **Why** | Quote-owned local scope: forks, AI-drafted, manual local (`canon/02`, `epic 15`). |
| **Storage** | relational |
| **Mutability** | Editable only while parent `QuoteVersion` is **draft**; **immutable** after send (same class as line items). |
| **Upstream** | QuoteVersion |
| **Downstream** | `QuoteLocalPacketItem`, optional FK from `QuoteLineItem` |

### QuoteLocalPacketItem

| Aspect | Detail |
|--------|--------|
| **Why** | Child lines for local packet structure (parallel to `PacketTaskLine`). |
| **Storage** | relational |
| **Mutability** | Same as parent `QuoteLocalPacket`. |
| **Upstream** | QuoteLocalPacket |
| **Downstream** | Compose engine reads when line pins `quoteLocalPacketId` |

### PreJobTask

| Aspect | Detail |
|--------|--------|
| **Why** | Site surveys and pre-sign operational work without a `Job` (`canon/02`, `epic 03`, `epic 39`). |
| **Storage** | relational |
| **Mutability** | Lifecycle statuses; **not** part of quote freeze JSON. |
| **Upstream** | FlowGroup; optional `QuoteVersion` |
| **Downstream** | Files/evidence (polymorphic or future child table); Work Station queries |

### TaskDefinition (optional)

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Only if seeded packet uses **LIBRARY** lines (`epic 17`). |
| **Storage** | relational (optional table) |
| **Mutability** | Published revision immutable. |
| **Upstream** | Tenant |
| **Downstream** | `PacketTaskLine.definitionId` |
| **Slice 1 default** | **Defer** — use **EMBEDDED** packet lines in seeds unless product insists (`11-slice-1-open-questions.md`). |

### WorkflowTemplate

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Named template family (`epic 23`). |
| **Storage** | relational |
| **Mutability** | Seeded. |
| **Upstream** | Tenant |
| **Downstream** | `WorkflowVersion` |

### WorkflowVersion

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | **Pinned snapshot** for compose (`epic 23`, `canon/06`). |
| **Storage** | relational + **`snapshotJson`** (graph: nodes, gates, skeleton tasks, completion rules) |
| **Mutability** | **Immutable** once `status = published` (Slice 1 seeds). |
| **Upstream** | WorkflowTemplate |
| **Downstream** | `QuoteVersion.pinnedWorkflowVersionId`, compose |

### Quote

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Container + human number (`epic 07`). |
| **Storage** | relational |
| **Mutability** | Shell fields mutable; versions own lifecycle. |
| **Upstream** | Tenant, Customer, FlowGroup |
| **Downstream** | `QuoteVersion` |

### QuoteVersion

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Draft vs sent; freeze payloads (`epics 08`, `12`, `31–32`). |
| **Storage** | relational + **two JSON snapshot columns** |
| **Mutability** | **Draft:** mutable commercial graph + pins; **Sent:** **hard immutable** for version row fields defined in `04`. |
| **Upstream** | Quote, WorkflowVersion (pin) |
| **Downstream** | ProposalGroup, QuoteLineItem, snapshots |

### ProposalGroup

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Line item grouping (`epic 10`); default “Items” group per version. |
| **Storage** | relational |
| **Mutability** | Draft only reorder/rename; **frozen** post-send (no add/delete of groups that would orphan lines — **Slice 1 rule:** no new groups after send). |
| **Upstream** | QuoteVersion |
| **Downstream** | QuoteLineItem |

### QuoteLineItem

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Commercial + packet selection (`epic 09`). |
| **Storage** | relational |
| **Mutability** | Draft editable; **sent = row immutable** (Slice 1 stores **frozen copy** in place — no shadow “snapshot line table”). |
| **Upstream** | QuoteVersion, ProposalGroup, **either** `ScopePacketRevision` **or** `QuoteLocalPacket` (XOR for manifest lines — `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`) |
| **Downstream** | Compose reads qty + packet **or** local packet items + tier + execution mode |

### generatedPlanSnapshot (artifact)

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Canonical freeze for expansion (`canon/04` plan row, `epic 31`). |
| **Storage** | `QuoteVersion.generatedPlanSnapshot` **JSON** (`07-snapshot-shape-v0.md`) |
| **Mutability** | **Absent** in draft; **written once** at send; never updated. |
| **Upstream** | Composed from line items + packet lines + workflow snapshot |
| **Downstream** | Read-only UI; Slice 2 package consumption already done at send — runtime uses **execution package**, not plan recompute |

### executionPackageSnapshot (artifact)

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Launch contract for **future** activation (`canon/02`, `epic 32`). |
| **Storage** | `QuoteVersion.executionPackageSnapshot` **JSON** |
| **Mutability** | Same as plan snapshot |
| **Upstream** | Plan snapshot + workflow snapshot |
| **Downstream** | Slice 2 activation; sent read-only diagnostics UI |

### AuditEvent (minimal)

| Aspect | Detail |
|--------|--------|
| **Why Slice 1** | Prove **who sent** and **integrity** hooks (`epic 12`, `57`). |
| **Storage** | relational (minimal) |
| **Mutability** | append-only |
| **Upstream** | any |
| **Downstream** | compliance |

**Slice 1 decision:** include **one** `AuditEvent` row type `QUOTE_VERSION_SENT` or rely on `QuoteVersion.sentBy/sentAt` only — **include** relational audit table **if** multi-service future needs outbox; else **`sentBy/sentAt` + snapshot hashes** on version suffice. **Pack decision:** store **`sentById`, `sentAt`, `planSnapshotSha256`, `packageSnapshotSha256`** on `QuoteVersion` **and** append `AuditEvent` **if** audit module exists — **minimum** is version columns only (`03` will list both as optional).

---

## Runtime execution entities (explicit boundary)

**Not in Slice 1.** No `Flow`, `RuntimeTask`, `TaskExecution`.

**Allowed inside JSON:** `skeletonTaskId` strings **only** as **references into `WorkflowVersion.snapshotJson`**, embedded in **package snapshot** with explicit `source: "WORKFLOW"` — **not** runtime ids (`planning/01`).

---

## StructuredInputAnswer

**Excluded** from Slice 1 (`01-slice-1-scope.md`).
