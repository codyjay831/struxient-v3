# Struxient v3 — Scope packet canon

**Canon**

---

## Naming decision (normative)

**Canon term:** **Scope packet** — the reusable catalog template for a **unit of trade scope** at a **tier**.

**v2 mapping:** **`BundleTemplate`** and its `bundleKey` + `tier` identity are the **implementation precedent**.

**Deprecated for v3 rhetoric:** Rotating casually among **bundle**, **packet**, and **package** when referring to the **same catalog object**. In canon:

- **Scope packet** = **catalog reusable scope template** (this doc).  
- **Execution package** = **frozen per-quote-version launch artifact** (zipper output) — **`03-quote-to-execution-canon.md`**.

**What not to do:** Call the **execution package** a “packet” in user-facing or API docs.

---

## What a scope packet is

**Canon:** The **primary reusable trade scope object** in v3. It is **not** the main **process** object and **not** the **sales row**.

**Rationale from v2 evidence:** Quote expansion is **line item × resolved bundle template**; reuse matrix and task-vs-packet audit conclude packet-level reuse is the trade SKU spine.

---

## Why the scope packet is the main reusable trade scope unit

**Canon:** Trades **reuse** “what we install / service / upgrade” across jobs; they **parameterize** depth with **tiers**; they **sell** that as **proposal lines**. **Scope packets** match that **SKU + tier** mental model. **Task definitions** alone lack **placement and composition**; **workflows** lack **commercial SKU** semantics.

---

## What a scope packet contains

**Canon**

- **Identity** in catalog: stable **key** + **tier** (+ company/tenant scope).  
- **Packet task lines:** each with **default node placement** and either **embedded meaning** or **reference to task definition** + optional overrides.  
- **Inspection checkpoint definitions** as authored for that packet (if product retains checkpoint model).  
- **Display metadata** (name, description) for catalog UX.

**Rationale from v2 evidence:** `BundleTemplate.tasks` JSON, `inspectionCheckpoints`, tier enum.

---

## What a scope packet does not contain

**Canon**

- **Per-customer price** (lives on **line item**).  
- **Per-job execution outcomes** (lives in **execution truth**).  
- **Process graph** (lives in **FlowSpec template**).  
- **Frozen plan** for a specific quote version (lives in **quote freeze**).

---

## How scope packets relate to line items

**Canon:** A **line item** **selects** **one scope packet identity + tier** (for scope-generating modes) and **quantity**. The **freeze** expands **packet × quantity** into **plan rows** then **package slots**.

**Rationale from v2 evidence:** `computeGeneratedPlan` nested loops.

---

## How tiers work

**Canon:** **Tier** selects **which** scope packet variant applies for the same **product key** (e.g. GOOD / BETTER / BEST). **Exactly one** resolved template per line item tier selection at quote time (v2 invariant style).

**What not to do:** Multiple ambiguous resolutions for the same key+tier without explicit product rules.

---

## How scope packets use task definitions

**Canon:** **Packet task lines** may **reference** a **task definition** for **meaning** and **structured field templates**; **placement and overrides** remain **on the packet task line**. **Embedded lines** carry meaning inline without a definition reference.

**Rationale from v2 evidence:** LIBRARY vs EMBEDDED packet lines; resolver merge rules.

---

## AI-drafted scope packets

**Canon:** **Allowed** as **catalog authoring assist**: AI may propose **new scope packets** or **packet task lines** as **drafts**. **Not canon** until **human publish/commit** rules are satisfied. AI output is **never** activation truth by itself.

When AI drafts scope **during quoting** (from text, voice, or document intake), the output is always created as a **QuoteLocalPacket** — local to that quote, not in the global library. The estimator reviews and applies. If the pattern is useful, the estimator may **promote** the local packet to the global library through the standard admin review process.

**Rationale from v2 evidence:** `ai-package-draft` and related routes; locked assumption 10.

**What not to do:** Auto-publish AI packets to **production catalog** without explicit review policy. Allow AI to create global library objects without human review and a formal promotion step.

---

## Packet-level override policy (quote-time)

**Canon**

- **Minor overrides (no fork):** Changing **quantities**, **unit prices**, or **descriptions** on a library packet. These are stored as overrides on the `QuoteLineItem`. The library `ScopePacketRevision` is not changed.
- **Task mutation (mandatory fork):** Adding, deleting, or re-ordering **tasks** within a packet. This **must** create a **QuoteLocalPacket** as a deep copy. The `QuoteLineItem` switches its reference to the local copy. The library packet is not touched.
- **Dangerous without governance:** **Silent re-targeting** of many lines to **wrong nodes** without **template compatibility** checks — product should **surface** compose **errors/warnings** (v2 composer already distinguishes violations vs reroutes).

### Packet fork vs library rules

| Scenario | Storage | Reusable? | Fork needed? |
|----------|---------|-----------|--------------|
| Standard library packet, no changes | `ScopePacketRevision` | Yes | No |
| Library packet with price/qty/description overrides | `QuoteLineItem` overrides | No (local) | No |
| Library packet with task structure changes | `QuoteLocalPacket` (deep copy) | No (local) | **Yes** |
| AI-drafted packet from text/voice/documents | `QuoteLocalPacket` (new) | No (local) | N/A (born local) |
| Ad hoc manual line item | `QuoteLineItem` (literal) | No (local) | No |

### Promotion to global library

**Canon amendment — interim one-step promotion (first implementation slice).** The first implementation epic of promotion collapses the original multi-step admin-review flow into a single estimator-driven step. A full admin-review queue remains **canon for a later epic** (see "Deferred admin-review workflow" below) but is explicitly **not** built in the first slice.

When an estimator creates a useful `QuoteLocalPacket`, they may click **"Promote to Global Library"**:

1. Estimator supplies a **`packetKey`** (slug, unique per tenant). The server **validates uniqueness** and **rejects** the promotion if a `ScopePacket` with that key already exists on the tenant.
2. The server creates a new **`ScopePacket`** under the estimator's tenant with the supplied `packetKey`.
3. The server creates a **first `ScopePacketRevision`** (revisionNumber = 1) in **`DRAFT`** status. The revision's `publishedAt` is **null** (see schema amendment "`ScopePacketRevision.publishedAt` nullable" in `10-open-canon-decisions.md` O10 extension and the slice-1 schema planning docs).
4. The server copies **`QuoteLocalPacketItem`** rows into **`PacketTaskLine`** rows on the new revision using the mapping contract in the next subsection.
5. The source `QuoteLocalPacket.promotionStatus` is set to **`COMPLETED`**. The source `QuoteLocalPacket` itself is **not mutated otherwise** and remains the historical record on its quote version.
6. **No admin-review queue** is materialized in this slice. The new revision stays in `DRAFT` until a future epic introduces the publish/review workflow.

**What the interim flow does not do (deferred):**

- No admin queue, assignment, or review UI.
- No automatic transition to `PUBLISHED`.
- No tier duplication beyond what the local packet already expresses.
- No cross-tenant promotion.

### Canonical `QuoteLocalPacketItem` → `PacketTaskLine` mapping contract

**Canon:** Promotion performs a **deterministic field-level copy** from each `QuoteLocalPacketItem` row on the source packet into a new `PacketTaskLine` row on the newly created `ScopePacketRevision`. The mapping is a **1:1 row copy**; no merging, collapsing, or re-ordering.

| `QuoteLocalPacketItem` (source) | `PacketTaskLine` (target) | Notes |
|---|---|---|
| `lineKey` | `lineKey` | Preserved verbatim; uniqueness guaranteed by source `@@unique([quoteLocalPacketId, lineKey])`. |
| `sortOrder` | `sortOrder` | Preserved verbatim. |
| `tierCode` | `tierCode` | Preserved verbatim (nullable). |
| `lineKind` | `lineKind` | Enum value preserved (`EMBEDDED` → `EMBEDDED`, `LIBRARY` → `LIBRARY`). |
| `embeddedPayloadJson` | `embeddedPayloadJson` | Deep-copied JSON; no transformation. |
| `taskDefinitionId` | `taskDefinitionId` | Preserved if set; nullable. |
| `targetNodeKey` | `targetNodeKey` | Preserved verbatim. **Required** on both sides per the schema amendment authorizing `PacketTaskLine.targetNodeKey` as a top-level column. |

**Invariants:**

- The new revision's `PacketTaskLine` set is a **faithful snapshot** of the source items at promotion time.
- Later edits to the source `QuoteLocalPacket` (if product allows any on a draft quote version) **do not** retroactively update the promoted revision.
- Later edits to the promoted revision (once revision editing UX exists) **do not** retroactively update the source `QuoteLocalPacket`.
- Promotion is **idempotent per `QuoteLocalPacket`**: attempting a second promotion on a packet already in `COMPLETED` is rejected at the server boundary.

### Deferred admin-review workflow

**Canon (preserved, not deleted):** The eventual admin-review workflow — `DRAFT` → `IN_REVIEW` → approve → `PUBLISHED` as a new `ScopePacketRevision`, with explicit admin acceptance and library curation — **remains canon** for a future epic. It is explicitly **deferred**, not withdrawn. The interim one-step flow above is scoped to produce a `DRAFT` revision that a future admin-review epic can safely advance to `PUBLISHED`.

### Canon amendment — interim publish authority (post-readiness)

**Canon (interim slice):** Following the interim promotion amendment and the publish-readiness inspection epic, the `DRAFT` → `PUBLISHED` transition on `ScopePacketRevision` is authorized as a one-step office-user action, paralleling the interim promotion compaction. Full canon — including the deferred admin-review queue, `IN_REVIEW` / `REJECTED` transitions, and a dedicated `catalog.publish` capability (epic 15 §20) — **remains canon** for a future epic and is explicitly **deferred**, not withdrawn.

**Authorized interim publish flow:**

1. An office user (`office_mutate` capability) on the revision's tenant invokes the publish action against a specific `ScopePacketRevision`.
2. Server asserts, in one transaction, that the revision belongs to the caller's tenant, has `status = DRAFT`, satisfies `evaluateScopePacketRevisionReadiness({ packetTaskLines })` with `isReady: true` (readiness is **mandatory, not advisory**), and that the parent `ScopePacket` currently has zero other revisions in `PUBLISHED`.
3. Server writes exactly two field updates: `status = PUBLISHED` and `publishedAt = NOW()` (server transaction time). No other fields are touched. No new revision is created. No child rows are written.
4. Re-publish of an already-`PUBLISHED` revision is rejected (not a no-op). A second publish on a packet with an existing `PUBLISHED` revision is rejected.

**Locked invariants:**

- **At most one `PUBLISHED` revision per `ScopePacket` at a time** in the interim slice. Aligns the writer with the singular `publishedVersion` pointer model in epic 15 §6 / §47 / §10. Supersede / un-publish / archive semantics for a future second published revision remain deferred.
- **`PUBLISHED` ⇒ `publishedAt != null`.** The interim publish mutation is the single writer that establishes this invariant. The schema comment on `ScopePacketRevision.publishedAt` ("Required for PUBLISHED rows; service-layer enforces the conditional") is now backed by binding canon.
- **Readiness is the canonical preflight.** The publish writer must not invent or skip any gate the readiness predicate covers, nor accept a publish that the predicate rejects.
- **Sunset clause:** When the admin-review epic lands, the publish authority shifts from `office_mutate` to the dedicated `catalog.publish` capability (epic 15 §20). The interim authority is explicitly temporary — the same compaction-of-future-canon pattern as interim promotion.

**What the interim publish authority does not do (deferred):**

- No admin queue, reviewer assignment, notifications, or diff UX.
- No background, scheduled, AI-initiated, or webhook-initiated publishing — publish is always a deliberate foreground office-user action.
- No `un-publish`, `supersede`, `archive`, `deprecate`, or rollback semantics.
- No catalog-side editing of DRAFT revisions (`PacketTaskLine` CRUD, packet metadata edits) — DRAFTs are publish-or-leave-as-snapshot in this slice.
- No `publishedBy`, audit-trail row, or `packet.published` webhook (epic 15 §22 hint remains future canon).
- No schema changes. No new column, no new enum value, no new index, no migration.
- No `ScopePacket.status`, no `PacketTier`, no cross-tenant publish, no field-user publish.

**Authority for this amendment:** `docs/implementation/decision-packs/interim-publish-authority-decision-pack.md`.

### PUBLISHED revision discipline for pickers

**Canon:** Future quote / catalog pickers (library packet selector, tier selector, AI grounding sources) **must filter to `ScopePacketRevision.status = PUBLISHED`**. Revisions produced by the interim promotion flow are `DRAFT` and must **not** appear as selectable library packets until a later epic publishes them. This preserves library hygiene during the interim slice.

**What not to do:** Allow estimators to edit the global `ScopePacketRevision` directly from the quote editor. Allow AI-drafted tasks to enter the library without human review (the interim flow still requires an estimator action — AI alone cannot trigger promotion). Surface `DRAFT` revisions in consumer-facing pickers.

---

## Scope packet vs assembly (rules-generated scope)

**Canon**

- **Default path:** **Scope packet on line item** defines **sold scope**.  
- **Assembly (rules engine):** **Secondary** path: **derives** additional plan tasks from **inputs** and **published rules**, with **provenance** on plan rows. Used when **parameterized generation** beats static packet tiers for a segment (e.g. some solar/service-upgrade patterns).

**What not to do:** Treat **assembly** as **required** for all trades or **replace** **packets** as the **default** reuse primitive.

**Rationale from v2 evidence:** Assembly integration merges into overlay; foundation chose packet-first default.

---

## Summary

| Question | Canon |
|----------|--------|
| Main reusable trade scope? | **Scope packet** |
| v2 name | **BundleTemplate** precedent |
| Contains | **Packet task lines** + checkpoints + catalog metadata |
| Does not contain | **Price**, **runtime truth**, **workflow graph** |
| AI | **Draft only** until committed |
| Quote-local fork? | **QuoteLocalPacket** for task-level mutations |
| Promotion to library? | **Explicit**, estimator-driven one-step for interim slice (creates `ScopePacket` + `DRAFT` revision); full admin-reviewed publish **deferred** to a later epic |
| Publish to library? | **Explicit**, office-user one-step for interim slice (DRAFT → PUBLISHED, readiness-gated, at most one `PUBLISHED` per packet, `publishedAt = NOW()`); full admin-review queue and dedicated `catalog.publish` capability **deferred** to a later epic |
| Library philosophy | **Curated**, not a dumping ground |
