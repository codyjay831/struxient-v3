# 09 — Change Order and Detour Journey

**User Role:** Office Admin / Estimator / Crew Lead
**Starting Point:** Mid-job scope change (e.g., "Found rotted wood", "Customer wants extra gutters").
**Preconditions:** `Job` is `ACTIVE`. A `Quote` exists.

---

## Main Success Path (Step-by-Step)

1.  **Detecting the Scope Change:**
    -   **Action:** Crew Lead (on-site) discovers rotted plywood during "Tear Off".
    -   **Action:** Tech taps **"Report Scope Change"** on the mobile app.
    -   **Fields:** Title, Description, Photo Evidence.
    -   **Action:** Clicks **"Notify Office"**.
    -   **Object Created:** `Note` (linked to `Job`).
    -   **Status:** Task "Tear Off" stays `STARTED`. A `Hold` (status: `SCOPE_CHANGE_PENDING`) is added to the "Install Shingles" node (Epic 29).
2.  **Creating the Change Order:**
    -   **Action:** Estimator opens the `Quote`.
    -   **Action:** Clicks **"Create Change Order"**.
    -   **System Action:** `QuoteVersion (v2)` is created as a **Draft** (Epic 08).
    -   **Process:** 
        -   V1 data is copied into V2.
        -   User adds a new **"Wood Replacement"** line item.
        -   User adds a **"Change Order"** proposal group.
3.  **Customer Approval:**
    -   **Action:** Estimator clicks **"Review & Send Change Order"**.
    -   **System Action:** `QuoteVersion (v2)` status becomes `SENT`.
    -   **Notification:** Customer notified: "Change Order requested! View it in your portal: [Link]."
    -   **Action:** Customer clicks **"Accept & Sign"** in their portal.
    -   **Outcome:** `QuoteVersion (v2)` status becomes `ACCEPTED`.
4.  **The "Scope Mutation" (The Merge):**
    -   **System Action:** Acceptance of V2 triggers a **Scope Mutation** (Epic 37).
    -   **Process:** 
        -   New `QuoteLineItems` (Wood Replacement) are identified.
        -   New `RuntimeTaskInstances` (Replace Plywood) are generated from the `ExecutionPackageSnapshot` (v2).
        -   These tasks are **injected** into the active `Job` graph.
        -   The `Hold` on "Install Shingles" is released.
5.  **Executing the Change:**
    -   **Action:** Crew Lead opens the **Workstation**.
    -   **Item:** A new task "Replace Plywood" appears at the top.
    -   **Action:** Tech completes the plywood replacement and *then* continues with the shingles.

---

## Alternate / Branch Paths

-   **Detour (Internal Correction):** The office decides an extra step is needed *internally* (no cost to customer).
    -   **Action:** Admin clicks **"Add Detour"** to the `Job`.
    -   **Selection:** Selects a **"Corrective Wood Repair"** packet.
    -   **Outcome:** New tasks are added without a `QuoteVersion` update (Epic 28).
-   **Customer Decline:** Customer declines the change order.
    -   **Action:** Office must decide: "Do the work for free?" or "Cancel the job?"
    -   **Outcome:** `QuoteVersion (v2)` status becomes `DECLINED`. V1 remains the `ACCEPTED` baseline.

---

## Objects Touched or Created
-   `QuoteVersion` (v2) (Create/Update status)
-   `RuntimeTaskInstance` (Injected)
-   `NodeJobExecution` (Graph update)
-   `Hold` (Release)
-   `AuditEvent` (Create)

---

## AI Assistance Points
-   **Impact Analysis:** AI calculates the delay a change order will cause (e.g., "This wood replacement adds 4 hours to the schedule").
-   **Packet Suggestion:** AI identifies "Rotted Wood" in a photo and suggests the "Standard Plywood Replacement" packet.
-   **Change Summary:** AI drafts the change order description: "Found 4 sheets of rotted plywood under the main ridge."

---

## Human Confirmation Points
-   Estimator confirming the change order pricing.
-   Customer final click on "Accept & Sign".
-   Crew lead confirming the new tasks are actionable.

---

## What the Customer Sees
-   **Notification:** "A change order has been requested for your project."
-   **Portal:** A specific **Change Order Review** screen (shows the *delta* from the original quote).
-   **Sign:** A signature modal for the new version.

---

## What Unlocks Next
-   The **newly injected tasks** become actionable in the workstation.
-   The **blocked success tasks** are released.

---

## Failure / Error States
-   **Version Conflict:** Two users try to create `v2` and `v3` simultaneously. (Handled via DB locks).
-   **Deadlock:** A detour is added that loops back into a completed node. (System prevents circular dependencies).

---

## Current Epic Coverage
-   `14-quote-change-revision-workflow-epic.md`: Covers the quote-side of change orders.
-   `37-change-orders-scope-mutation-epic.md`: Covers the runtime injection of new scope.
-   `28-detour-loopback-epic.md`: Covers internal-only workflow adjustments.

---

## Missing or Ambiguous Areas
-   **Work-In-Progress (WIP) Snapshot:** When the graph is mutated mid-job, how is the "Original Plan" preserved for audit? (Epic 37 mentions injection, but not a "Plan v1 vs Plan v2" history).
-   **Detour vs Change Order terminology:** Are these distinct concepts or two names for the same thing? (Epic 28/37 imply different paths, but the UX might conflate them).

---

## Recommendation
-   Update `37-change-orders-scope-mutation-epic.md` to define **Plan Versioning** (Snapshot v1, v2, v3).
-   Clarify the **UX Distinction** between "Customer-Facing Change" (Quote Version) and "Internal-Only Adjustment" (Detour).
