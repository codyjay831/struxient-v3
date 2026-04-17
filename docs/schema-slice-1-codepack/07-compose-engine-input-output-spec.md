# Slice 1 — Compose engine input/output spec

**Purpose:** Exact contract for the **compose library** (shared by synchronous preview and send). **No** framework code.

---

## Inputs (read from DB / caller)

### `ComposeInput` (conceptual struct)

| Field | Source |
|-------|--------|
| `quoteVersionId` | `QuoteVersion.id` |
| `pinnedWorkflowVersionId` | `QuoteVersion.pinnedWorkflowVersionId` |
| `workflowSnapshot` | `WorkflowVersion.snapshotJson` parsed |
| `tenantId` | `Quote.tenantId` via join |
| `lineItems` | All `QuoteLineItem` for version |
| `proposalGroups` | All `ProposalGroup` for version |

### Source rows (relational)

**Line items** — fields used:

- `id`, `proposalGroupId`, `sortOrder`
- **`scopePacketRevisionId`?**, **`quoteLocalPacketId`?** — manifest scope **XOR** (exactly one non-null when the line type requires packet-backed scope; see `04-slice-1-relations-and-invariants.md`, `planning/01` §5–6)
- `tierCode?`, `quantity`
- `executionMode` (`SOLD_SCOPE` | `MANIFEST`)
- `title`, `description?` (for diagnostics only, not plan row title source of truth)

**Catalog packet task lines** — loaded when `scopePacketRevisionId` is set:

- `lineKey`, `tierCode?`, `sortOrder`, `embeddedPayloadJson` (**EMBEDDED-only** Slice 1)
- Parse `embeddedPayloadJson` for display title / `taskKind` used in plan rows

**Quote-local packet items** — loaded when `quoteLocalPacketId` is set:

- Same effective fields as catalog lines for compose: `lineKey`, `tierCode?`, `sortOrder`, placement / payload (per `QuoteLocalPacketItem` schema extension doc)
- **Same** tier-filter and ordering rules as `PacketTaskLine` for deterministic `planTaskId` (`planning/01` §6.4)

**Workflow snapshot** — parsed graph:

- `nodes[]` each with `id` (as `nodeId`)
- `skeletonTasks[]` or equivalent with `skeletonTaskId`, parent `nodeId`
- `gates`, `completionRules` as needed for **binding** (Slice 1: minimal valid graph)

---

## Normalized in-memory shapes

### `NormalizedGroup`

| Field | Type |
|-------|------|
| `proposalGroupId` | string |
| `sortOrder` | int |
| `name` | string |

### `NormalizedLine`

| Field | Type |
|-------|------|
| `lineItemId` | string |
| `proposalGroupSortOrder` | int |
| `lineSortOrder` | int |
| `scopeSource` | `LIBRARY_PACKET` \| `QUOTE_LOCAL_PACKET` |
| `scopePacketRevisionId` | string \| null |
| `quoteLocalPacketId` | string \| null |
| `tierCode` | string \| null |
| `quantity` | int |
| `executionMode` | enum |
| `effectiveScopeLines` | `ScopeLine[]` (union shape: catalog or local items normalized to the same struct) |

### `ScopeLine` (from `PacketTaskLine` **or** `QuoteLocalPacketItem` + parse)

| Field | Type |
|-------|------|
| `lineKey` | string (becomes `packetLineKey` vs `localLineKey` in snapshot per `scopeSource` — see `07-snapshot-shape-v0.md`) |
| `sortOrder` | int |
| `tierCode` | string \| null |
| `targetNodeKey` | string (placement into pinned workflow — required `planTaskId` input per `planning/01` §6) |
| `title` | string (from embedded JSON or local item payload) |
| `taskKind` | string (from embedded JSON or local item payload) |
| `embeddedPayload` | object (opaque beyond title/kind) |

---

## Deterministic ordering rules

1. Sort **groups** by `ProposalGroup.sortOrder` ascending, then `ProposalGroup.id`.
2. Within each group, sort **lines** by `QuoteLineItem.sortOrder` ascending, then `QuoteLineItem.id`.
3. Within each line, sort **`effectiveScopeLines`** by `sortOrder` ascending, then `lineKey` (whether sourced from catalog or quote-local packet).
4. **Quantity explosion:** for each unit `q` in `0 .. quantity-1`, emit expansion candidates in same scope line order.

**Tie-breakers** ensure stable `sortKey` and deterministic `planTaskId` inputs.

---

## Tier filtering rules (`epic 19` subset)

For each `QuoteLineItem` with manifest packet scope:

- Let `L.tierCode` be nullable.
- Let `S` range over **`effectiveScopeLines`** (from `PacketTaskLine` **or** `QuoteLocalPacketItem`).
- Include row `S` if:
  - `S.tierCode IS NULL` (**applies to all tiers** / base), **or**
  - `S.tierCode == L.tierCode` (exact string match after trim/normalization policy — **Slice 1:** exact case-sensitive match unless seeds standardize lowercase).

**If** after filter **zero** scope lines for a line that requires expansion → **blocking error** `EXPANSION_EMPTY`.

---

## Expansion → plan rows (output segment)

### `PlanRow` (in-memory, maps to `generatedPlanSnapshot.v0.rows[]`)

Must match **`docs/schema-slice-1/07-snapshot-shape-v0.md`** and **`planning/01-id-spaces-and-identity-contract.md` §6**.

| Field | Required | Notes |
|-------|----------|-------|
| `planTaskId` | yes | Deterministic function of **§6** ingredient tuple (not title-only) |
| `lineItemId` | yes | |
| `scopeSource` | yes | `LIBRARY_PACKET` \| `QUOTE_LOCAL_PACKET` |
| `scopePacketRevisionId` | iff library | absent when `QUOTE_LOCAL_PACKET` |
| `packetLineKey` | iff library | from `PacketTaskLine.lineKey` |
| `quoteLocalPacketId` | iff local | absent when `LIBRARY_PACKET` |
| `localLineKey` | iff local | from `QuoteLocalPacketItem.lineKey` |
| `targetNodeKey` | yes | placement into pinned workflow |
| `tierCode` | optional | echo |
| `quantityIndex` | yes | `0..quantity-1` |
| `title` | yes | from scope line payload |
| `taskKind` | yes | from scope line payload |
| `sortKey` | yes | string built from group/line/scope line/qty index |

**Forbidden:** `runtimeTaskId`, bare `taskId`.

---

## Package composition → slots (output segment)

### Binding expectations (Slice 1)

- Every **SOLD** plan row must map to **exactly one** `nodeId` per workflow binding rules encoded in engine config.
- **Skeleton** slots may exist with `source = SKELETON`, `planTaskIds` possibly empty, `skeletonTaskId` required.
- **MANUAL_PLAN_STUB** only if product seeds require — otherwise reject unknown modes.

Failure to bind any sold row → **`PACKAGE_BIND_FAILED`** with `planTaskId` / `lineItemId` in `details`.

### `PackageSlot` (in-memory)

| Field | Required | Notes |
|-------|----------|-------|
| `packageTaskId` | yes | `f("pkg", quoteVersionId, nodeId, sortIndex, …)` |
| `nodeId` | yes | |
| `source` | yes | `SOLD_SCOPE` \| `SOLD_SCOPE_LOCAL` (optional slot-level tag) \| `SKELETON` \| `MANUAL_PLAN_STUB` — row-level **`scopeSource`** on plan tasks remains authoritative (`planning/01` §6.8) |
| `planTaskIds` | yes | non-empty for `SOLD_SCOPE` |
| `skeletonTaskId` | optional | required when source needs skeleton |
| `lineItemIds` | optional | dedup |
| `displayTitle` | yes | |

**Forbidden:** `runtimeTaskId`, `flowId`, bare `taskId`.

---

## `ComposeOutput`

| Field | Type |
|-------|------|
| `errors` | `ValidationIssue[]` (blocking) |
| `warnings` | `ValidationIssue[]` (non-blocking) |
| `planRows` | `PlanRow[]` |
| `packageSlots` | `PackageSlot[]` |
| `stats` | `{ lineItemCount, planTaskCount, packageTaskCount, skeletonSlotCount, soldSlotCount }` |

### `ValidationIssue`

| Field | Type |
|-------|------|
| `code` | string (canonical — `02-enums-and-shared-types.md`) |
| `message` | string |
| `lineItemId?` | string |
| `planTaskId?` | string |
| `details` | object |

---

## Preview vs send

- **Same** `ComposeEngine.run(ComposeInput)` — **no** alternate code path.
- Preview returns `ComposeOutput` to HTTP; send uses `ComposeOutput` to build JSON blobs + txn.

---

## Deferred

- LIBRARY packet lines + `TaskDefinition`
- Assembly overlays
- Structured inputs
- Multi-workflow / multi-flow

---

## Classification

| Rule | Type |
|------|------|
| Ordering + tier rules | **Normative for Slice 1** |
| `planTaskId` / `packageTaskId` functions | **Implement** in code with documented algorithm + golden tests |
