# 04 — Packet Local vs. Library Rules

**Status:** Operationalizing the packet reuse and mutation decision.

---

## 1. Decision Matrix: Where does the scope live?

| Scenario | Storage Location | Reusable? | Promotion Needed? |
| :--- | :--- | :--- | :--- |
| **Standard Library Packet** | `ScopePacketRevision` | Yes (Global) | No |
| **Library Packet with Minor Overrides** | `QuoteLineItem` (Overrides) | No (Local) | No |
| **Forked Library Packet (New Tasks)** | `QuoteLocalPacket` | No (Local) | Yes (to Global) |
| **AI-Generated Packet Draft** | `QuoteLocalPacket` | No (Local) | Yes (to Global) |
| **Ad Hoc Manual Line Item** | `QuoteLineItem` (Literal) | No (Local) | No |

---

## 2. Rule 1: Use Library by Default
- **Action:** Estimators select a standard packet from the `ScopePacketRevision` library.
- **Result:** No `QuoteLocalPacket` is created. The `QuoteLineItem` points directly to the library ID.

## Rule 2: Minor Overrides (No Fork)
- **Definition:** Changing quantities, unit prices, or descriptions on a library packet.
- **Action:** These are stored on the `QuoteLineItem` as overrides.
- **Result:** No `QuoteLocalPacket` is created.

## Rule 3: Task Mutation (Mandatory Fork)
- **Definition:** Adding, deleting, or re-ordering tasks within a packet.
- **Action:** System creates a `QuoteLocalPacket` deep copy.
- **Result:** The `QuoteLineItem` now points to the `QuoteLocalPacket`.

## Rule 4: Promotion to Global Library
- **Definition:** A `QuoteLocalPacket` is deemed useful for other projects.
- **Action:** User clicks **"Promote to Global Library."**
- **Process:** 
   1. A new `ScopePacket` is created in the global library.
   2. Status is set to `DRAFT`.
   3. Admin reviews and publishes as a new `ScopePacketRevision`.
   4. The original `QuoteLocalPacket` remains linked to its quote (Historical record).

---

## 3. Why this matters
- **Prevents Catalog Clutter:** Global library remains clean and high-quality.
- **Enables AI Speed:** AI can draft complex task patterns without needing "Admin Rights" or "Revision Management."
- **Immutable Quoting:** Ensures that a signed quote points to the *exact* task structure it was signed with, even if the library changes later.

---

## 4. What not to do
- **Do not** allow a `QuoteLocalPacket` to be edited after the quote is **SENT** (Epic 12).
- **Do not** allow AI-drafted tasks to be promoted to the library without human review.
- **Do not** force every manual line item to become a `ScopePacket` (keep simple things simple).

---

## 5. Metadata Ownership
- **Library Metadata:** Owned by the `ScopePacketRevision` (managed by Admin).
- **Local Metadata:** Owned by the `QuoteLocalPacket` (managed by Estimator).
- **Promoted Metadata:** Initial values taken from the `QuoteLocalPacket`, but then owned by the new Library object.
