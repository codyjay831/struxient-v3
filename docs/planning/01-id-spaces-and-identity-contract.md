# Struxient v3 — ID spaces and identity contract

**Status:** Normative **planning** contract for schema and **public API** design.  
**Authority:** `docs/canon/*` (especially `04-task-identity-and-behavior.md`, `02-core-primitives.md`, `03-quote-to-execution-canon.md`, `05-packet-canon.md`, `09-banned-v2-drift-patterns.md`), `docs/decisions/02-payment-hold-task-id-mapping-decision.md`, `docs/epics/*` (31–36, 47–48, 30), `docs/epics/99-epic-set-summary.md`, `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`.

**Non-goals:** This document does **not** fix open product defaults (e.g. payment gate ALL vs ANY); it defines **identity** so those choices **cannot** smuggle ambiguous `taskId` strings.

---

## 1. Why this document exists

v2 failed partly because **one undifferentiated “task”** and **string-matched bridges** connected incompatible layers (`canon/04`, `canon/09`, `decisions/02`). v3 **requires** **separate ID spaces** (or **explicit tagged unions** in API payloads) so that:

- **Freeze artifacts** (plan rows, package slots) are not mistaken for **live execution rows**.
- **Template skeleton** work is not mistaken for **manifest runtime** work.
- **Payment and holds** key off the **same executable IDs** the engine uses for **TaskExecution** (`decisions/02`).
- **Public APIs** never force clients to guess whether `taskId` means **skeleton** or **runtime**.

---

## 2. Global rules (all IDs)

| Rule | Requirement |
|------|-------------|
| **Tenant scope** | Every persisted identifier below is **logically scoped** by `tenantId` (and often `companyId` if multi-company tenants exist in v3). APIs **must not** allow cross-tenant ID probing. |
| **Opaque IDs** | Prefer **opaque** string IDs (UUID/ULID/CUID) in **external** contracts. **Deterministic** IDs (e.g. `planTaskId`) are allowed **inside** immutable snapshots when canon requires **stable reproduction** (`canon/04` plan row). |
| **No string bridges** | **Forbidden:** resolving payment or holds by **`(nodeName, taskDisplayName)`** (`canon/09` #6, `decisions/02`). |
| **Explicit in public JSON** | Any payload that could refer to **either** skeleton **or** runtime **must** carry a **discriminator** (`executableKind` / `taskRef.kind`) **or** use **separate field names** (`skeletonTaskId` vs `runtimeTaskId`). **Do not** publish a bare `taskId` without kind for v3-native resources. |
| **Internal vs external** | Internal DB tables may use a single `executableTaskId` column **only if** accompanied by **`executableTaskKind`** enum **at rest** for v3-native rows, **or** split columns. **Public** APIs should still prefer **explicit** two-field or tagged union shapes for readability and client safety. |

---

## 3. Core execution and freeze identifiers

### 3.1 `skeletonTaskId`

| Aspect | Definition |
|--------|---------------|
| **What it identifies** | A **skeleton task** authored on a **published process template** inside a **node** — part of the **immutable WorkflowVersion snapshot** (`canon/02`, `canon/04`). |
| **Lifetime** | **Immutable** within a given **`workflowVersionId`** snapshot. New template version = **new** snapshot = **new** skeleton task IDs (IDs **do not** “travel” across versions unless explicitly remapped by migration tooling). |
| **Where valid** | **Inside** the **pinned** `WorkflowVersion` snapshot referenced by a **sent/signed** quote version and bound to a **flow**. **Effective projection** (epic 36) **surfaces** skeleton tasks using **this** id as the execution key for **TaskExecution** when work is executed as **template structure**. |
| **Where invalid / meaningless** | **Catalog** scope packets (use `taskDefinitionId` / packet line keys). **Quote commercial** context alone (line items). **Pre-template** workflows. |
| **Must never be confused with** | **`runtimeTaskId`** (manifest instance). **`planTaskId`** (expanded scope row). **`packageTaskId`** (composed slot). **`taskDefinitionId`** (library). |
| **TaskExecution** | **Allowed** as **`taskId`** in execution truth **when** the execution row refers to **skeleton** work on the bound snapshot (same id space the engine already uses — `canon/04`). |
| **Payment / holds** | **Allowed target** per `decisions/02` for **pre-activation** or **structural** gating when runtime IDs do not exist yet (business choice **which** gates exist when — see `06-schema-planning-open-issues.md`). |

**Public API shape (recommended):**

```text
{ "kind": "SKELETON", "skeletonTaskId": "…", "workflowVersionId": "…" }
```

`workflowVersionId` (or `flowId` + server-resolved pin) helps clients disambiguate **rare** debugging cases; **minimum** is **`kind` + id**.

---

### 3.2 `runtimeTaskId`

| Aspect | Definition |
|--------|---------------|
| **What it identifies** | A **runtime task instance** materialized on a **flow** for **manifest** work (sold scope, manual plan, assembly, inspection-as-manifest per `decisions/03`) (`canon/02`, `canon/04`). |
| **Lifetime** | Created at **activation** (or **post-activation injection** / **CO apply** per epics 35, 37). Stable **until** superseded/archived by **CO** or operational policies. **Not** recreated on every read. |
| **Where valid** | **Scoped to `flowId`** (and **job** context indirectly). **Workstation**, **mobile execution**, **evidence** links, **cost attribution** optional links (epics 41–42, 49). |
| **Where invalid / meaningless** | **Before activation** for that instance (no row). **Inside** immutable **generated plan** at freeze (plan rows use **`planTaskId`**, not runtime). |
| **Must never be confused with** | **`planTaskId`** / **`packageTaskId`** (freeze artifacts). **`skeletonTaskId`** (template). **`lineItemId`** (commercial row — provenance only). |
| **TaskExecution** | **Allowed** as **`taskId`** for manifest execution truth (`canon/04`). |
| **Payment / holds** | **Preferred target** for **post-activation** “pay before specific install work” (`decisions/02`). |

**Public API shape (recommended):**

```text
{ "kind": "RUNTIME", "runtimeTaskId": "…", "flowId": "…" }
```

---

### 3.3 `planTaskId`

| Aspect | Definition |
|--------|---------------|
| **What it identifies** | A **plan task row** in the **generated plan** — **flattened** expansion of **line items × scope source (library revision *or* quote-local packet) × qty** + overlays (`canon/04` “Plan task row”, epic 31). |
| **Lifetime** | **Immutable** once the parent **`quoteVersion`** is **sent** (frozen). Draft versions may recompute rows; **deterministic** ID required so exclusions/answers map stably pre-send. |
| **Where valid** | **Only** inside **`quoteVersionId`** snapshot (semantic boundary). **Compose** reads plan rows to build package (`canon/03`, epic 32). |
| **Where invalid / meaningless** | **Flow** / **field execution** APIs — **do not** accept `planTaskId` as something startable. After activation, provenance may **copy forward** to runtime rows but **does not** make `planTaskId` executable. |
| **Must never be confused with** | **`packageTaskId`** (node-aligned composed slot). **`runtimeTaskId`**. **`lineItemId`**. |
| **TaskExecution** | **Must not** be used as **TaskExecution.taskId** for v3-native jobs. |
| **Payment / holds** | **Must not** be used as a **gate target** (not executable). |

**Deterministic inputs:** `planTaskId` **must** be derived from the **normative ingredient set** in **§6** (library vs quote-local). **Do not** derive `planTaskId` from display `title` alone or from content hashes without stable structural ids.

**Public API shape:** generally **internal** to quote/freeze services; if exposed to clients (support tools), always pair with **`quoteVersionId`**.

```text
{ "planTaskId": "…", "quoteVersionId": "…" }
```

---

### 3.4 `packageTaskId`

| Aspect | Definition |
|--------|---------------|
| **What it identifies** | A **package task slot** in the **execution package** — **node-aligned** composed artifact with **source classification** (sold/manifest vs skeleton vs manual plan) (`canon/04` “Package task slot”, `canon/02` execution package, epic 32). |
| **Lifetime** | **Immutable** post-**send** alongside frozen plan + package. |
| **Where valid** | **Only** inside **`quoteVersionId`** freeze (semantic). **Activation** reads package to decide **which** slots become **`runtimeTaskId`** rows vs remain **skeleton-only** (`canon/03`). |
| **Where invalid / meaningless** | **Start/complete** endpoints. **Payment targets** — **do not** reference `packageTaskId`; reference **`skeletonTaskId` or `runtimeTaskId`** after resolving activation outcome (`decisions/02`). |
| **Must never be confused with** | **`planTaskId`** (pre-compose expansion). **`runtimeTaskId`**. **Catalog “scope packet”** (`canon/09` naming drift ban). |
| **TaskExecution** | **Must not** be execution key. |
| **Payment / holds** | **Must not** be gate target. |

**Public API shape:** support/quote diagnostics only, paired with **`quoteVersionId`**.

---

### 3.5 `flowId`

| Aspect | Definition |
|--------|---------------|
| **What it identifies** | The **runtime Flow** instance **pinned** to an **immutable published workflow snapshot** (`workflowVersionId`) for a **job**’s execution (`canon/02` FlowSpec, epic 33). |
| **Lifetime** | Created at **activation** (idempotent). **Single-flow MVP** assumes **one primary flow per job**; **multi-flow** (canon `10` O2) would multiply flows per job — **schema must not foreclose** `jobId` + multiple `flowId`s, but **product** may ship MVP single-flow. |
| **Where valid** | **Execution** domain: **TaskExecution**, **holds**, **detours**, **runtime tasks**, **effective projection**, **payment gate evaluation** (with `jobId` context per `decisions/02` open note). |
| **Where invalid** | **Quote draft** editing (pre-activation). **Catalog** authoring. |
| **Must never be confused with** | **`workflowVersionId`** (template snapshot identity) vs **`flowId`** (runtime instance). **`jobId`** (business anchor). |
| **Public API** | Always include **`flowId`** on **execution** mutations; **never** imply **`jobId` alone** selects execution graph in v3-native path. |

---

### 3.6 `jobId`

| Aspect | Definition |
|--------|---------------|
| **What it identifies** | The **durable business anchor** for **CRM, money, reporting**, scoped to a **FlowGroup / project** per **`04-job-anchor-timing-decision`**. |
| **Lifetime** | **Ensured by sign** (product default) or policy-deferred; **activation** **reuses** job, **never duplicates** for same logical project anchor (`decisions/04`, epics 13, 33–34). |
| **Where valid** | **PaymentGate** job scope (v2 precedent; v3 keeps **job-scoped money** concepts), **job lists**, **cost events** (epic 49), **schedule blocks** optional `jobId` (epic 46), **portal** “project” context (subset). |
| **Where invalid** | **Not** a substitute for **`flowId`** in **start/complete** APIs for v3-native **FlowSpec** execution (those need **flow + executable task**). |
| **Must never be confused with** | **`quoteId` / `quoteVersionId`** (commercial document). **`flowId`** (execution). **`flowGroupId`** (site/project anchor). |
| **Public API** | **Money** and **rollups** may use **`jobId`**; **task execution** should still accept **`flowId`** (or resolve **active flow for job** with explicit server rule — if resolved, **document** in API as **derived**, not ambiguous). |

---

## 4. Quote and commercial identifiers

### 4.1 `quoteId`

| Aspect | Definition |
|--------|---------------|
| **What it identifies** | The **quote shell/container** (customer + flow group context, numbering, current version pointer) (epic 07). |
| **Lifetime** | Long-lived across **versions**. |
| **Boundaries** | **Does not** own immutable commercial truth; **versions** do (epic 08). |

---

### 4.2 `quoteVersionId`

| Aspect | Definition |
|--------|---------------|
| **What it identifies** | A **specific** proposal revision: **draft** mutable, **sent/signed** immutable snapshots (epics 08, 12–14). |
| **Owns references** | **Line items**, **proposal groups**, **pinned `workflowVersionId`**, **`QuoteLocalPacket`** rows (same version), **generated plan** (`planTaskId` rows), **execution package** (`packageTaskId` slots), **structured answers**, **signature** rows. |
| **Must never be confused with** | **`jobId` / `flowId`** — those are **downstream** of activation for a **signed** version. |

---

### 4.3 `lineItemId`

| Aspect | Definition |
|--------|---------------|
| **What it identifies** | A **quote line item** row under a **`quoteVersionId`** (epic 09). |
| **Lifetime** | Immutable post-send with its **version**; new line items on **new versions** or **CO** documents per policy. |
| **Role** | **Commercial** + **scope selection** (**XOR:** `scopePacketRevisionId` *or* `quoteLocalPacketId` for manifest lines) + **execution mode**. |
| **Must never be confused with** | Any **task** id space. **Provenance only** to plan/runtime via derived links. |
| **TaskExecution** | **Must not** key execution truth by `lineItemId` (`canon/04`). |

---

## 5. Catalog / scope packet revision identifier

### 5.1 `scopePacketRevisionId` (recommended name)

| Aspect | Definition |
|--------|---------------|
| **What it identifies** | An **immutable published revision** of a **scope packet** catalog template (epic 15): lines, tiers, checkpoint defs **as of that revision**. |
| **Alternates** | Equivalent conceptual objects: **`scopePacketId` + `publishedRevision`** integer, or **`packetVersionId`**. Planning standard: pick **one** canonical “revision row id” for FK cleanliness. |
| **Lifetime** | **New revision** on publish; old revisions **immutable**. |
| **Where valid** | **Catalog authoring**, **quote line** references that **pin** “what was selected” (epic 09 sends with resolution to a concrete revision at send time). |
| **Where invalid** | **Execution** / **flow** — runtime does not key off catalog revision IDs except **telemetry/provenance**. |
| **Must never be confused with** | **`execution package`** (`canon/09` #2). **`planTaskId`**. **`taskDefinitionId`**. |

**Quote freeze pinning rule (semantic):** At **send**, manifest-scoped lines must have **exactly one** scope pin (**`scopePacketRevisionId` *or* `quoteLocalPacketId`**) **actually used for expansion**; frozen snapshots must record **`scopeSource`** and the matching revision/line keys **or** local packet/line keys (`planning/01` §6, `07-snapshot-shape-v0.md`). For **library** paths, **do not** rely on “latest catalog” after send.

---

### 5.2 `taskDefinitionId` (library; related)

Not requested in the prompt list but **required** to avoid confusion:

| Aspect | Definition |
|--------|---------------|
| **What** | **Task definition** library record (`canon/02`). **Not executable**. **No node placement authority**. |
| **Never** | **Payment target**, **TaskExecution taskId**, **plan row id**. |

---

### 5.3 `workflowVersionId` (template snapshot; related)

| Aspect | Definition |
|--------|---------------|
| **What** | **Immutable published** process template snapshot containing **nodes**, **gates**, **skeleton tasks** (`canon/06`). |
| **Binds** | **Quote version** at send for compose; **Flow** at activation. |

---

### 5.4 `nodeId`

| Aspect | Definition |
|--------|---------------|
| **What** | **Stable node identifier inside a `workflowVersionId` snapshot** (`canon/02`). **Not** a quote object. |
| **Usage** | **Placement** on packet lines; **package** grouping; **UX** boards. |

---

### 5.5 `quoteLocalPacketId` (quote-owned local scope)

| Aspect | Definition |
|--------|---------------|
| **What it identifies** | A **quote-version-scoped** local scope container: forked catalog, AI-drafted, or manual local (`canon/02` Quote-local packet). |
| **Lifetime** | Mutable only while parent **`quoteVersion.status = draft`**; **immutable** after send with the same class of rules as line items (`04-slice-1-relations-and-invariants.md`). |
| **Where valid** | **Quote domain** only. Referenced from **`QuoteLineItem.quoteLocalPacketId`** (XOR with `scopePacketRevisionId` for manifest lines). |
| **Must never be confused with** | **`scopePacketRevisionId`** (library). **`planTaskId`**. **`execution package`**. |
| **Planning ref** | `docs/implementation/decision-packs/quotelocalpacket-schema-decision-pack.md`. |

---

### 5.6 `quoteLocalPacketItem.lineKey`

| Aspect | Definition |
|--------|---------------|
| **What** | **Stable string key within one `QuoteLocalPacket`**, analogous to **`PacketTaskLine.lineKey`** in a catalog revision. |
| **Role** | **Required** ingredient for deterministic `planTaskId` when scope is local-packet-backed; **not** replaceable by display title. |

---

## 6. Deterministic plan task identity (compose, preview, freeze, activation handoff)

**Normative:** This section locks **how** `planTaskId` (and downstream `packageTaskId` binding to `planTaskIds`) is defined so **library** and **quote-local** scope paths remain **distinct**, **collision-free**, and **preview-stable ≡ send-stable** when inputs are unchanged.

**Scope:** **Quote-selected scope** on a **`quoteVersionId`** with **pinned `workflowVersionId`**. **PreJobTask** does **not** produce `planTaskId` rows — it is not part of the generated plan (`canon/02`). **PreJobTask** is also **not** where **readiness/completeness debt** for customers or quotes should be stored — that identity work stays on the **owning record** and readiness models, not in the plan graph.

---

### 6.1 Canonical source path (conceptual)

Deterministic identity is derived from **frozen quote scope**, in this order:

1. **`quoteVersionId`** — bounds all ids; different versions **never** share the same `planTaskId` namespace for different structural inputs.
2. **`lineItemId`** — commercial + scope-selection row (owns XOR pin).
3. **Scope pin (exactly one for manifest lines):**
   - **Library path:** `scopePacketRevisionId` + effective **`packetLineKey`** (from `PacketTaskLine.lineKey` after tier filter), **or**
   - **Local path:** `quoteLocalPacketId` + **`quoteLocalPacketItem.lineKey`** (from child row after tier filter).
4. **`quantityIndex`** — `0 .. quantity-1` when expansion explodes per unit (Slice 1: explode per `07-snapshot-shape-v0.md`).
5. **`targetNodeId` / `targetNodeKey`** — placement reference **into the same pinned** `WorkflowVersion.snapshotJson` used for compose (must resolve unambiguously for the row).

**Identity does not** originate from **runtime** tables. **`runtimeTaskId`** may be **assigned at activation** with **provenance** linking back to `planTaskId` / `packageTaskId` — runtime must **not** become the retroactive definition of plan identity.

---

### 6.2 Row discriminator: `scopeSource` (required in plan rows and preview)

Every expanded plan row (preview JSON, persisted `generatedPlanSnapshot` row, diagnostics) **must** carry an explicit discriminator:

| `scopeSource` | Meaning |
|----------------|---------|
| `LIBRARY_PACKET` | Expansion from `ScopePacketRevision` + `PacketTaskLine`. |
| `QUOTE_LOCAL_PACKET` | Expansion from `QuoteLocalPacket` + `QuoteLocalPacketItem`. |

**Drift trap rejected:** A single formula that omits `scopeSource` and infers path only from “presence of optional fields” is **fragile**; implement **explicit** `scopeSource` (or equivalent tagged union) in snapshot and preview contracts.

---

### 6.3 Library-backed scope — deterministic ingredients

For `scopeSource = LIBRARY_PACKET`, **`planTaskId`** MUST be a **deterministic function** of at least:

| Ingredient | Required | Notes |
|------------|----------|--------|
| `quoteVersionId` | yes | Version boundary |
| `lineItemId` | yes | Line ownership |
| `scopePacketRevisionId` | yes | Pinned catalog revision |
| `packetLineKey` | yes | From `PacketTaskLine.lineKey` |
| `quantityIndex` | yes | Per-unit explosion index |
| `targetNodeKey` | yes | Same encoding as used for package bind (must match workflow snapshot) |

**Optional** stable ingredients (if product adds): assembly rule id, manual-plan overlay sequence, exclusion flags — document when introduced.

**Forbidden as sole inputs:** line `title`, packet `displayName`, human-readable description strings.

---

### 6.4 Quote-local packet-backed scope — deterministic ingredients

For `scopeSource = QUOTE_LOCAL_PACKET`, **`planTaskId`** MUST be a **deterministic function** of at least:

| Ingredient | Required | Notes |
|------------|----------|--------|
| `quoteVersionId` | yes | **Must** match `QuoteLocalPacket.quoteVersionId` and `QuoteLineItem.quoteVersionId` |
| `lineItemId` | yes | Line that owns `quoteLocalPacketId` |
| `quoteLocalPacketId` | yes | Local container id (**opaque**; not derivable from titles) |
| `localLineKey` | yes | **`QuoteLocalPacketItem.lineKey`** (same role as `packetLineKey`) |
| `quantityIndex` | yes | Same explosion rules as library path |
| `targetNodeKey` | yes | From local item’s placement field, validated against pinned workflow |

**Explicit non-equivalence:** Two different `quoteLocalPacketId` values **must** produce **different** `planTaskId` prefixes even if **embedded text** matches another packet’s lines (no collision from “similar content”).

**Explicit non-equivalence:** `packetLineKey` from a **library** revision and `localLineKey` with the **same string value** on a **different** scope path **must not** collapse to the same `planTaskId` — the hash/input tuple **must** include `scopeSource` and the relevant packet/revision **or** local packet id.

---

### 6.5 Preview → send → activation stability

| Phase | Rule |
|-------|------|
| **Compose preview** | Uses **same** expansion + **same** `planTaskId` function as send for identical relational inputs and pinned workflow. |
| **Send** | Persists `generatedPlanSnapshot` / `executionPackageSnapshot` with **identical** `planTaskId` values the preview would have produced for that draft state. |
| **Staleness** | If draft mutates after preview, **new** `planTaskId`s are expected; client must not assume old preview ids remain valid (`composePreviewStalenessToken`). |
| **Activation** (future) | Reads **frozen** snapshots only; **must not** re-expand from “live” catalog or live local packet rows for that sent version. |

**Settled:** Preview and send **must not** use divergent identity algorithms.

---

### 6.6 No-collision rules (normative)

1. **Different `quoteLocalPacketId`** → different plan id space (even if forked from same `scopePacketRevisionId` at creation time).
2. **Different `scopePacketRevisionId`** → different plan id space from each other and from any local packet path.
3. **`localLineKey` vs `packetLineKey`:** collisions in **string value** are irrelevant unless **full tuple** (§6.3 vs §6.4) matches — and tuple **includes** scope discriminator and revision/local id.
4. **Mutable display labels** do not change `planTaskId` unless the **structural** row (line key, placement, quantity index, version) changes.
5. **Cross-version:** `planTaskId` is **not** stable across `quoteVersionId` when scope structure changes; **do not** imply sameness across versions for audit without comparing full provenance tuple.

---

### 6.7 Local packet edits (draft vs sent)

| State | Local packet / items |
|-------|----------------------|
| **Draft** | Items may be added/reordered/removed; **recompute** `planTaskId`s on next preview/send. Changing `lineKey` of an existing item **changes** identity for that slot (treat as structural edit). |
| **Sent** | `QuoteLocalPacket` and `QuoteLocalPacketItem` **immutable** for that version; `planTaskId`s in snapshot **fixed** forever for that version. |
| **New quote version** | New `quoteVersionId`, new local packets if forked again; **no** requirement that `planTaskId` strings match v1. |

---

### 6.8 `packageTaskId` and `source` classification (handoff)

**Execution package** slots that bind sold manifest work **must** carry `planTaskIds` that were produced under **§6.3–6.4**. Package layer may use **`source`** values such as:

- `SOLD_SCOPE` — sold scope from **library** packet expansion (existing),
- `SOLD_SCOPE_LOCAL` — sold scope from **quote-local** packet expansion (recommended discriminator in snapshot/API; if product keeps single `SOLD_SCOPE`, **each plan row** must still carry **`scopeSource`** for audit).

**Drift trap rejected:** Activation that only understands **library** `scopePacketRevisionId` provenance — activation must consume **frozen plan rows** including **`scopeSource` + local ids**.

---

### 6.9 Drift traps (explicitly rejected)

1. Identity assumes **only** `scopePacketRevisionId` exists for sold scope.  
2. Quote-local scope treated as **temporary** or omitted from freeze snapshots.  
3. `planTaskId` from **title** / **description** only.  
4. Preview uses a **different** hash than send for the same inputs.  
5. **Runtime** assigned ids **replace** `planTaskId` as the canonical plan reference in freeze artifacts.  
6. Local scope **bypasses** `lineItemId` ownership (local packet must be reachable from the line XOR).  
7. Single opaque id that **hides** library vs local when **recomputing** or **auditing** expansion.

---

## 7. “Confusion matrix” (must-not pairs)

| If you have this ID… | You must NOT treat it as… |
|----------------------|----------------------------|
| `lineItemId` | `runtimeTaskId` / `skeletonTaskId` |
| `planTaskId` | executable task id |
| `packageTaskId` | executable task id |
| `taskDefinitionId` | executable task id |
| `skeletonTaskId` | `runtimeTaskId` (without kind) |
| `runtimeTaskId` | `skeletonTaskId` |
| `quoteVersionId` | `flowId` |
| `jobId` | `flowId` (without explicit mapping rule) |
| Catalog **packet** slug/key | **`execution package`** artifact |
| `quoteLocalPacketId` | `scopePacketRevisionId` (same manifest line — XOR) |
| `planTaskId` | **Executable** task id (unchanged) |

---

## 8. External / public API: safe task references

### 8.1 Recommended **Tagged union** (canonical JSON shape)

Use **`ExecutableTaskRef`** everywhere a client could encounter either skeleton or runtime:

| Field | Type | Notes |
|-------|------|--------|
| `kind` | `SKELETON` \| `RUNTIME` | Required. |
| `skeletonTaskId` | string? | Present iff `kind=SKELETON`. |
| `runtimeTaskId` | string? | Present iff `kind=RUNTIME`. |
| `flowId` | string | Required on **execution** endpoints (or derivable **once** per request with explicit documented rule). |
| `workflowVersionId` | string? | Optional on skeleton refs for **support**; omit in minimal mobile payloads if server guarantees pin via `flowId`. |

**Validation rule:** exactly **one** of `skeletonTaskId` / `runtimeTaskId` is non-null.

### 8.2 **Start / complete** mutations

**Minimum request fields:**

- `flowId`
- `ExecutableTaskRef` (tagged)
- `idempotencyKey` (client-generated) to survive retries

**Server must:**

- Recompute **start eligibility** (epic 30) using **the same** ID space as **`TaskExecution`** (`decisions/02`, `canon/04`).
- Reject ambiguous payloads **without** discriminator.

### 8.3 **Payment gate targets** (`decisions/02`)

Each target row should persist:

- `flowId` (or resolvable via `jobId` **only** if **exactly one** active flow — **MVP** may enforce that; **O2** may not)
- `targetKind`: `SKELETON` \| `RUNTIME`
- `taskId`: the **actual** skeleton or runtime id

**Public admin/finance API** should mirror the same **explicit** fields — **never** a single undifferentiated `taskId`.

### 8.4 **Holds** (`Hold.taskId` pattern)

v3-native: `taskId` column **must** mean **executable id** matching **TaskExecution** space, **plus** `taskKind` at rest **or** split columns. **Never** store `planTaskId` here.

### 8.5 **Webhooks / integrations**

Include:

- `tenantId` / `companyId` as appropriate
- `jobId`
- `flowId`
- **`executableTask` object** (tagged), not bare `taskId`

---

## 9. Internal persistence options (planning only)

| Pattern | When to use |
|---------|-------------|
| **Split columns** `skeletonTaskId` nullable, `runtimeTaskId` nullable, **CHECK** exactly one set | Payment targets, some join tables |
| **Pair columns** `executableTaskKind` + `executableTaskId` | TaskExecution if engine already uses unified string space **internally** — **still** map to tagged union at API boundary |
| **Never** | `planTaskId` / `packageTaskId` on **TaskExecution** for v3-native |

---

## 10. Traceability to canon / decisions / epics

| Topic | Source |
|--------|--------|
| Four task layers + plan/package artifacts | `canon/04` |
| Execution truth keys | `canon/04`, `canon/07` |
| Payment mapping ban | `canon/09` #6, `decisions/02` |
| Naming packet vs package | `canon/05`, `canon/09` #2 |
| Freeze → activation | `canon/03`, epics 31–33 |
| Plan `planTaskId` determinism (library + quote-local) | **§6** this doc; `docs/schema-slice-1/07-snapshot-shape-v0.md` |
| Effective merge | epic 36 |
| Start eligibility | epic 30, `decisions/01` (scheduling out of MVP enforcement) |

---

## 11. Settled vs still open (identity layer only)

| Settled | Open (product/engineering, not canon contradictions) |
|---------|-----------------------------------------------------|
| **Distinct** semantic spaces for plan vs package vs runtime vs skeleton | **Multi-flow**: whether **`flowId` is always explicit** or **derived from `jobId`** in APIs (`10` O2) |
| **Tagged** public task references | **ALL vs ANY** payment target satisfaction does **not** change IDs — only **gate logic** (`decisions/02`) |
| **No** string payment bridge | **Pre-activation** gate strategy when **runtime ids** absent — **which** IDs are eligible targets (`decisions/02` open subquestion) |
| **`planTaskId` inputs explicitly cover library and quote-local paths** (`§6`) | Exact **hash algorithm** / string format for `planTaskId` (implementation — inputs are normative here) |
| **Preview ≡ send** identity algorithm when inputs unchanged | Whether package slot **`source`** uses `SOLD_SCOPE` only + row-level `scopeSource`, or adds `SOLD_SCOPE_LOCAL` at slot level |

See `06-schema-planning-open-issues.md` for the **short** consolidated list.
