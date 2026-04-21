# QuoteLocalPacket — Schema decision pack

**Status:** Planning / schema boundary lock (not application code).  
**Authority:** `docs/canon/02-core-primitives.md` (Quote-local packet), `docs/canon/05-packet-canon.md`, `docs/canon/08-ai-assistance-canon.md`, epics **09**, **11**, **15**, **21**, **22**, **31**, **12** (send freeze).  
**Companion:** `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md` (**normative** for `QuoteLocalPacket` / `QuoteLocalPacketItem` and `QuoteLineItem.quoteLocalPacketId`; v0 Prisma paste may omit parent `model` blocks until merged — see codepack **Layered truth** on `03-prisma-schema-draft-v0.md`).

---

## Decision

**QuoteLocalPacket** is a **dedicated quote-owned local scope model** with at least one **child row model** (**QuoteLocalPacketItem**) for structured lines. It is **not** a nullable mode on library `ScopePacket` / `ScopePacketRevision`, not a mutable library row, and not an opaque JSON blob without lineage and children.

---

## Current evidence

- Canon: local packet owns **project-specific task composition**; library promotion is **explicit and admin-reviewed** (`02-core-primitives.md`, `05-packet-canon.md`).  
- AI quote-time output is **QuoteLocalPacket-first** (`08-ai-assistance-canon.md`, epics 21–22).  
- Slice 1 already has **`QuoteVersion`** as a **real persisted boundary** with immutability after send (`03-slice-1-field-definitions.md`, `04-slice-1-relations-and-invariants.md`).

---

## Parent anchor: `quoteVersionId` (locked recommendation)

| Question | **Decision** |
|----------|--------------|
| Own `quoteId` or `quoteVersionId`? | **`quoteVersionId` required** on `QuoteLocalPacket`. Local scope is version-scoped so **send freeze** pins the exact structure that was composed. |
| If only `quoteId` existed | Would **not** match canon-safe immutability; **avoid**. If a codebase temporarily lacks version FK, document as **technical debt** and migrate to `quoteVersionId`. |

**Invariant:** `QuoteLocalPacket.quoteVersionId` → `QuoteVersion` must match `tenantId` chain (via `Quote`).

---

## What can create it

| Source | **Decision** |
|--------|--------------|
| Human fork from library | User edits task structure on a line → server creates `QuoteLocalPacket` + items (deep copy from `ScopePacketRevision` + `PacketTaskLine` effective merge). |
| AI draft | AI proposes scope → **draft** `QuoteLocalPacket` + items; estimator **accepts** to attach to version / line. |
| Manual local | Estimator builds local-only scope without a library parent → `QuoteLocalPacket` with `originType = MANUAL_LOCAL`, `forkedFromScopePacketRevisionId` null. |

---

## Relationship to `QuoteLineItem`

| Rule | **Decision** |
|------|--------------|
| Scope reference XOR | For a given **scope-bearing** line: **exactly one** of `(scopePacketRevisionId, quoteLocalPacketId)` is non-null. **Mutually exclusive.** |
| Commercial fields | Remain on `QuoteLineItem` (title, qty, price, tier code if still meaningful for local packet). |
| After send | Both FK pins **immutable** for that version row (same as current `scopePacketRevisionId` rule). |

**Non-scope lines** (fees, non-manifest): may have **both** null per existing `executionMode` policy.

---

## Child structure: `QuoteLocalPacketItem` (required)

Do **not** stop at a parent row only.

**QuoteLocalPacketItem** holds the **local analog** of `PacketTaskLine`:

- Stable **`lineKey`** within the local packet (for deterministic plan ids if derived from local lines).  
- **`sortOrder`**.  
- **`lineKind`**: `EMBEDDED` | `LIBRARY` (reuse **task definition** by id) — same conceptual union as catalog lines.  
- **`embeddedPayloadJson`** / **`taskDefinitionId`** (conditional).  
- **`targetNodeId` or `targetNodeKey`** — must resolve against **pinned** `WorkflowVersion.snapshotJson` for the **same** `QuoteVersion` (compose validation).  
- Optional **local overrides** (instructions, estimate minutes) — **local truth** until promotion copies to library.

**Invariant:** Items belong to **one** `QuoteLocalPacket`; packet belongs to **one** `QuoteVersion`.

---

## Promotion model (data shape)

| Field / concept | **Decision** |
|-----------------|--------------|
| Promotion state | `promotionStatus`: `NONE` \| `REQUESTED` \| `IN_REVIEW` \| `REJECTED` \| `COMPLETED`. **Interim slice uses only `NONE` → `COMPLETED`**; `REQUESTED` / `IN_REVIEW` / `REJECTED` remain enum-legal and reserved for the deferred admin-review epic. |
| Target | On **COMPLETED**, store **`promotedScopePacketId`** (and optionally initial draft revision id) for audit. |
| Original local packet | **Unchanged** on the quote version (historical record). |
| Who acts | **Estimator** requests; in the interim slice the estimator action **is** the one-step promotion. The deferred admin-review epic will reintroduce admin / catalog-author approval as a separate step. |

**No automatic promotion** from AI or from frequency heuristics in v3 canon.

### Interim one-step promotion flow (canon amendment)

**Status:** Authorized for the first promotion implementation epic. Preserves — does not delete — the deferred admin-review canon.

**Flow:**

1. Estimator triggers "Promote to Global Library" on a `QuoteLocalPacket` and supplies a **`packetKey`** (slug).
2. Server validates **`packetKey` uniqueness** on the tenant (`@@unique([tenantId, packetKey])` on `ScopePacket`). Duplicate → reject with a structured error; no partial state written.
3. Server creates `ScopePacket` with the supplied `packetKey` under the estimator's tenant.
4. Server creates a **first** `ScopePacketRevision` (`revisionNumber = 1`) in **`DRAFT`** with `publishedAt = null` (requires the `ScopePacketRevision.publishedAt` nullability amendment below).
5. Server copies `QuoteLocalPacketItem` rows → `PacketTaskLine` rows on the new revision per the `05-packet-canon.md` mapping contract (1:1 copy of `lineKey`, `sortOrder`, `tierCode`, `lineKind`, `embeddedPayloadJson`, `taskDefinitionId`, `targetNodeKey`).
6. Server sets `QuoteLocalPacket.promotionStatus = COMPLETED` and `promotedScopePacketId = <new ScopePacket.id>`.
7. No admin queue row is created. No `IN_REVIEW` transition occurs. No publish happens in this slice.

**Idempotency:** A `QuoteLocalPacket` already in `COMPLETED` cannot be promoted again. Idempotency key scheme is epic-level (implementation detail); the decision pack fixes the **state** rule only.

**Invariants preserved:**

- Source packet is **not deleted, not mutated beyond `promotionStatus` + `promotedScopePacketId`**.
- Items on the source packet are **not moved** — they are **copied**.
- The new revision is `DRAFT`, not `PUBLISHED`. Consumer pickers must filter on `PUBLISHED`.

### `packetKey` policy for promotion

- **Source:** estimator-supplied at promotion time (not auto-generated from `QuoteLocalPacket.displayName`).
- **Validation:** server-validated for **uniqueness per tenant**; regex rule matches existing `ScopePacket.packetKey` validation (slug-like per existing epic 15 / schema field definitions).
- **Collision handling:** promotion is **rejected** on duplicate key; the UI is expected to prompt the estimator to pick a different key. No auto-suffixing.
- **Immutability after promotion:** once the `ScopePacket` exists, its `packetKey` is **immutable** (existing canon — key renames forbidden after publish; the interim slice extends this to "after promotion" since a `DRAFT` revision is still tenant-visible by key).

### Schema amendment — `ScopePacketRevision.publishedAt` nullability

The interim one-step promotion flow produces a `DRAFT` revision that has **no publish timestamp**. Canon is amended to make **`ScopePacketRevision.publishedAt` nullable**. The field remains non-null for every revision that ever reaches `PUBLISHED` (set at publish time by the deferred admin-review epic). Existing `PUBLISHED` rows are unaffected; the nullability is required only to admit the new `DRAFT` rows created by the interim flow.

### Deferred (explicitly preserved)

- Admin-review queue, assignment, and UI.
- `IN_REVIEW` / `REJECTED` state transitions.
- `DRAFT` → `PUBLISHED` publish workflow for revisions produced by the interim flow.
- `ScopePacket.status` as a top-level column (see epic 15 §17).
- `PacketTier` normalized dimension on promoted revisions.

---

## Audit trail (minimum)

- `createdById`, `createdAt`, `updatedAt`.  
- For forks: **`forkedFromScopePacketRevisionId`** nullable.  
- For AI: **`aiDraftJobId`** or **`aiProvenanceJson`** (model id, prompt hash — policy-dependent).  
- Promotion: append **`AuditEvent`** or quote-version audit payload (pattern already used at send).

---

## Consumption: generated plan and activation

- **Compose / send** expands line items: if `quoteLocalPacketId` set, read **`QuoteLocalPacketItem`** rows instead of `PacketTaskLine` on a library revision.  
- **Frozen snapshots** remain authoritative after send; local packet rows for that version are **immutable**.  
- **Activation** (future slice) consumes **execution package snapshot**, not live editing of local packet — same boundary as library packets today.

---

## Invariants (hard)

1. **Quote-owned, not library-owned** — no other quote may FK the same `QuoteLocalPacket` (1:1 packet per line **or** shared packet across multiple lines on same version — **open**: see below).  
2. **Activation-valid without promotion** — local packet is first-class quote scope.  
3. **Library edits do not retroactively mutate** existing `QuoteLocalPacket` / items for **sent** versions.  
4. **Runtime actuals** do not silently update **ScopePacketRevision** or **TaskDefinition** (canon `07`).  
5. **AI-created** scope **defaults** here first; **never** direct insert into published catalog.

---

## Open decision: one local packet per line vs shared local packet

| Option | Pros | Cons |
|--------|------|------|
| **A. 1:1** `QuoteLineItem` → `QuoteLocalPacket` | Simple XOR; clear ownership. | Duplication if user wants one fork reused by multiple lines. |
| **B. Shared** packet across lines on same version | DRY for multi-line same custom scope. | Harder UX; need `quoteLocalPacketId` on multiple lines pointing to same packet. |

**Recommendation:** **Option A (1:1)** for Slice 1 + first implementation — lowest ambiguity. **Option B** is a later optimization with explicit product approval.

---

## What not to do (drift traps)

1. **`isLocal` on `ScopePacketRevision`** — **forbidden**.  
2. **Opaque JSON-only local packet** with no **`QuoteLocalPacketItem` rows** — **forbidden** for anything that must compose deterministically.  
3. **Activation only accepting `scopePacketRevisionId`** — **forbidden**; compose must accept local packet path.  
4. **Shadow authoring** disconnected from line items — local packet must be **reachable** from the line(s) it serves (via XOR FK).  
5. **Silent library mutation** from quote editor — **forbidden**; fork only.

---

## Deferred

- Normalized **tier** dimension on local packet (if local packet needs multi-tier like catalog).  
- **Version diff** UI between forked library revision and local items (product).  
- **Refresh from library** flow for draft local packet (explicit user action, future).

---

## Recommendation

Persist **`QuoteLocalPacket` + `QuoteLocalPacketItem`**, parent **`quoteVersionId`**, XOR on **`QuoteLineItem`**, promotion metadata on parent, lineage fields for fork/AI. Prefer **1:1** line-to-local-packet for first schema.
