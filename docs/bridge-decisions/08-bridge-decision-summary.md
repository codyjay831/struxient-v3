# 08 — Bridge Decision Summary

**Status:** Final summary of the Struxient v3 Bridge Decision Pack.

---

## 1. Summary of Decisions

Struxient v3 will resolve the "Pre-Quote Execution Gap" and the "Packet-Forking Gap" through two new architectural bridges:

### Bridge 1: The Pre-Job Work Model
- **What it is:** A new `PreJobTask` object anchored to the **FlowGroup** (Project Site Anchor).
- **Why it matters:** Allows for site surveys, utility checks, and feasibility work *before* a quote is signed, without creating "Fake Jobs."
- **Workstation:** Field users see `PRE_JOB` tasks in their workstation, using the same mobile interface as contracted work.
- **Evidence:** Survey photos and measurements directly feed the **Quote Editor** sidebar.

### Bridge 2: The Packet Fork / Promotion Model
- **What it is:** A new `QuoteLocalPacket` object that is a "Forked Deep Copy" of a library packet.
- **Why it matters:** Allows estimators and AI to modify task structures for a specific quote without polluting the global library catalog.
- **Promotion:** Useful local packets can be "Promoted to Global Library" by an admin, becoming a reusable library revision.
- **Metadata:** Metadata is owned by the `QuoteLocalPacket` (local truth) until it is promoted.

---

## 2. What is Now Decided
- **Pre-Job Work:** Anchored to `FlowGroup`, uses standard `Task` primitives.
- **Packet Mutation:** Always forks into `QuoteLocalPacket` on edit.
- **AI Drafting:** Always creates `QuoteLocalPacket` (Draft) for human review.
- **Metadata Ownership:** Explicitly linked to the packet (Library vs. Local vs. AI).

---

## 3. What Remains Open
- **Automatic Multi-Quote Promotion:** AI suggesting that a common local pattern be promoted based on frequency.
- **Task Definition Reuse:** How a `QuoteLocalPacket` references an existing `TaskDefinition` vs. a one-off task description.

---

## 4. Why this matters
- **No Drifting:** These decisions prevent the most likely "Workflow-Bridge" traps in the project.
- **Ready for Schema:** Provides a clear path for defining the `PreJobTask` and `QuoteLocalPacket` models in Prisma.
- **Ready for UI:** Provides a clear path for the "Fork Packet" and "Workstation Filter" interfaces.

---

## “Recommended next step”

### **Epic Update Pass.**

**Why:** With the bridge decisions closed, the next step is to update the core epics (**01 Leads**, **07 Quotes**, **15 Scope Packets**) to reflect the new architecture. This will ensure that the "Technical Truth" in the epics matches the "Experience Truth" in the journeys before implementation begins.
