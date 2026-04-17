# 05 — Task Metadata Ownership in Forks

**Status:** Decision finalized to resolve metadata ownership across packet lifecycles.

---

## 1. Ownership Matrix

| Metadata Type | Source: Library Packet | Source: Quote-Local Fork | Source: AI-Drafted Packet |
| :--- | :--- | :--- | :--- |
| **Estimated Time (Labor)** | `ScopePacketRevision` | `QuoteLocalPacket` | AI Suggestion (Draft) |
| **Material Assumptions** | `ScopePacketRevision` | `QuoteLocalPacket` | AI Suggestion (Draft) |
| **Field Instructions** | `ScopePacketRevision` | `QuoteLocalPacket` | AI Suggestion (Draft) |
| **Evidence Requirements** | `ScopePacketRevision` | `QuoteLocalPacket` | AI Suggestion (Draft) |
| **Structured Inputs** | `ScopePacketRevision` | `QuoteLocalPacket` | AI Suggestion (Draft) |
| **Task Definition Keys** | `TaskDefinition` | `TaskDefinition` | AI Suggestion (Draft) |

---

## 2. Decision Rules: Who owns what?

### Rule 1: Library Defaults (Standard)
- **Action:** Estimators use a standard library packet.
- **Ownership:** All task-level metadata is inherited from the `ScopePacketRevision`.
- **Note:** Individual `QuoteLineItems` can still have a custom `Quantity` that scales the labor/material estimates.

### Rule 2: Quote-Local Fork (Manual Override)
- **Action:** Estimator forks a packet and edits the "Instructions" for a specific job.
- **Ownership:** The edited metadata is stored within the `QuoteLocalPacket`.
- **Result:** The original library packet remains unchanged.

### Rule 3: AI-Drafted (Experimental)
- **Action:** AI suggests a new task pattern from a voice note.
- **Ownership:** The metadata is created as **DRAFT** in a `QuoteLocalPacket`.
- **Validation:** The estimator *must* review and confirm the labor/time estimates before the quote is sent.

### Rule 4: Promotion to Library (Handoff)
- **Action:** User promotes a `QuoteLocalPacket` to the library.
- **Process:** 
   1. System copies all metadata from the `QuoteLocalPacket` to a new `ScopePacketRevision` (DRAFT).
   2. Admin reviews the labor/time assumptions for "General Use."
   3. Admin publishes. The library now "Owns" the metadata for future quotes.

---

## 3. Why this matters
- **Prevents Metadata Drift:** Metadata is explicitly linked to the packet it was created in.
- **Enables "Learning Loops":** When a `QuoteLocalPacket` is promoted, the system can use the "As-Quoted" metadata as a baseline for the new Library version.
- **Enables "Actuals Analysis":** We can compare `LaborActuals` against the metadata in the `QuoteLocalPacket` to see how accurate the estimator's custom assumptions were.

---

## 4. What not to do
- **Do not** allow a library packet's metadata to be updated *silently* from a quote (must use the promotion flow).
- **Do not** allow AI-drafted metadata to be used in "Estimated Labor" reports without a human-in-the-loop confirmation.
- **Do not** store task-level instructions as simple text on a `QuoteLineItem` (keep them in the `Task` structure of the `QuoteLocalPacket`).

---

## 5. Summary
- **Standard Library:** Admin-owned technical truth.
- **Quote-Local:** Estimator-owned project truth.
- **AI-Draft:** Experimental truth (pending human approval).
- **Promoted Library:** New technical truth (pending admin approval).
