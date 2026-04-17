# 03 — Packet Fork / Promotion Decision

**Status:** Decision finalized to resolve the "Packet-Forking Gap."

---

## Decision
Struxient v3 will introduce a **QuoteLocalPacket** mechanism to manage scope and task modifications that are unique to a specific project, preventing global library pollution while allowing the speed of local customization.

---

## Current evidence
- **Journey 03 (Quote Authoring):** Estimators often need to tweak a standard packet's tasks (e.g., "Add 10ft of extra flashing") for one specific job.
- **Epic 15 (Scope Packets):** Currently assumes all packets are library-based revisions. Creating a new revision for every project-specific tweak would clutter the global catalog.
- **Epic 21, 22 (AI Drafting):** AI-generated scope from text/voice/documents may include task patterns that don't exist in the library yet.

---

## Recommendation
1. **The Object:** Introduce `QuoteLocalPacket`.
2. **The Fork:** When an estimator modifies a library-based packet on a quote:
   - **System Action:** A `QuoteLocalPacket` is created as a deep copy of the `ScopePacketRevision`.
   - **User Action:** The estimator edits the tasks/metadata within the `QuoteLocalPacket`.
   - **Reference:** The `QuoteLineItem` now points to the `QuoteLocalPacket` instead of the global `ScopePacketRevision`.
3. **The AI Draft:**
   - **AI Point:** All AI-suggested scope is created as `QuoteLocalPacket` objects first.
   - **Human Confirmation:** The estimator reviews and "Applies" the AI suggestions to the quote.
4. **The Promotion (Reuse):**
   - **Action:** If an estimator creates a particularly useful `QuoteLocalPacket`, they can click **"Promote to Global Library."**
   - **Admin Review:** A new `ScopePacket` (or revision) is created in a "Draft" status in the global library, pending Admin approval.

---

## Why
- **Library Hygiene:** Prevents hundreds of "Project-Specific" packet revisions from cluttering the global catalog.
- **Authoring Speed:** Estimators can quickly tweak tasks without needing "Admin Permissions" to edit the global library.
- **AI Safety:** Prevents AI from "Silently polluting" the global library with draft or experimental task patterns.
- **Quote Grounding:** The `QuoteLocalPacket` captures the "Exact Intent" of the quote, ensuring that the `GeneratedPlan` (Epic 31) reflects the actual work quoted.

---

## What not to do
- **Do not** allow estimators to edit the *global* `ScopePacketRevision` directly from a quote editor (must fork).
- **Do not** store local task modifications as unstructured "Notes" if they need to appear in the workstation.
- **Do not** allow AI to create global library objects without human review and a formal "Promotion" step.

---

## Deferred
- **Automatic Multi-Quote Promotion:** AI suggesting that a common `QuoteLocalPacket` pattern be promoted based on frequency.
- **Cross-Quote Sharing:** Sharing a local packet with another quote without promoting it to the global library.

---

## Open question
- Should `QuoteLocalPacket` and `ScopePacket` share a base table, or should `QuoteLocalPacket` be a serialized snapshot within the `QuoteLineItem`? (Recommendation: Share a table to keep the `Task` and `Flow` logic consistent, but with a `isLibrary` flag).
