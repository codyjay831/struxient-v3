# 12 — High-Risk UX Gaps

**Status:** Identification of critical friction points or missing logic across the Struxient v3 journeys.

---

## 1. The "Pre-Quote Execution" Gap
- **Gap:** When a Site Survey is required, a technician must visit the site and capture data *before* a Quote is sent.
- **Risk:** If a "Job" is the only anchor for execution, and a "Job" only exists *after* a Quote is signed, where do the Survey tasks live?
- **User Impact:** Estimators won't have a formal way to schedule or track surveys, leading to "Side-Talk" (WhatsApp/Email) outside of Struxient.

---

## 2. The "Packet Mutation" Friction
- **Gap:** Estimators often need to modify a standard `ScopePacket` for one specific project (e.g., "Add 10 extra feet of flashing for this weird chimney").
- **Risk:** If the only way to edit tasks is to create a new `ScopePacketRevision` in the library, the global library will be cluttered with "Project-Specific" versions.
- **User Impact:** The library becomes unmanageable, or estimators stop using packets because they are "Too rigid."

---

## 3. The "Team Start/Stop" Problem
- **Gap:** Roofing is a crew-based job.
- **Risk:** If only one tech can "Start" a task, and another tech tries to "Complete" it (or they both want to track time), the system might lock them out or fail to capture the full labor actuals.
- **User Impact:** Inaccurate labor data and "Pass-the-Phone" friction among the crew.

---

## 4. The "Payment-to-Work" Bridge
- **Gap:** We have `PaymentGates` and `PaymentRequests`, but the logic that *automatically* releases a `Hold` when a Stripe webhook arrives is not explicitly defined in the Epics.
- **Risk:** Workers will arrive at a site and find the job still "Locked" because the admin hasn't manually clicked "Release," even if the customer paid 12 hours ago.
- **User Impact:** Field downtime and office admin manual labor.

---

## 5. The "Closeout Artifact" Data Model
- **Gap:** The "Warranty Package" or "Job Summary" is mentioned as a customer deliverable.
- **Risk:** Without a defined `CloseoutPackage` object that "Freezes" photos, signatures, and plan data, the customer might download a "Live" version of the portal that changes if a tech edits a photo later.
- **User Impact:** Lack of legal finality and "Zombie" data changes after the job is closed.

---

## 6. The "Detour vs. Change Order" UX
- **Gap:** Epics define `Detours` (Internal only) and `Change Orders` (Customer-facing).
- **Risk:** The UX might make it difficult for a crew lead to know which one to request when they find an issue.
- **User Impact:** Incorrect quote versions or customers being asked to sign for internal corrections they shouldn't pay for.

---

## 7. The "Plan Versioning" Audit
- **Gap:** A job starts with `Plan v1`. A change order adds `Plan v2`.
- **Risk:** If we only have the "Current" active graph, we can't easily show the customer or the insurer "What the original plan was" versus "What we actually did."
- **User Impact:** Audit failures and inability to justify change order logic after the fact.

---

## 8. The "Workstation Sorting" Logic
- **Gap:** A tech has 5 actionable tasks across 3 jobs.
- **Risk:** If the feed is just "A list of tasks," the tech might pick the easiest one rather than the one that unlocks the most follow-up work or is the highest priority.
- **User Impact:** Poor job sequencing and missed deadlines.
