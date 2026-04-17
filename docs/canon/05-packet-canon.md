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

When an estimator creates a useful `QuoteLocalPacket`, they may click **"Promote to Global Library"**:
1. A new `ScopePacket` is created in `draft` status.
2. Admin reviews the task content, labor estimates, and placement for general use.
3. Admin publishes as a new `ScopePacketRevision`.
4. The original `QuoteLocalPacket` remains unchanged on its quote.

**What not to do:** Allow estimators to edit the global `ScopePacketRevision` directly from the quote editor. Allow AI-drafted tasks to enter the library without human review.

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
| Promotion to library? | **Explicit**, admin-reviewed |
| Library philosophy | **Curated**, not a dumping ground |
