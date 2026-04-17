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
| Promotion state | `promotionStatus`: `NONE` \| `REQUESTED` \| `IN_REVIEW` \| `REJECTED` \| `COMPLETED` (or equivalent). |
| Target | On **COMPLETED**, store **`promotedScopePacketId`** (and optionally initial draft revision id) for audit. |
| Original local packet | **Unchanged** on the quote version (historical record). |
| Who acts | **Estimator** requests; **Admin / catalog author** approves and publishes library row (epic 15). |

**No automatic promotion** from AI or from frequency heuristics in v3 canon.

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
