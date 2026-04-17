# 13 — Recommended Next Fixes

**Status:** Prioritized action plan for the Struxient v3 journey pack.

---

## 1. High-Priority Epic Updates

These updates address critical "Pre-Job" and "Activation" handoff gaps.

-   **[ ] Update `01-leads-epic.md` and `45-scheduling-epic.md`:** Define a **"Pre-Job Task"** object (e.g., `SurveyTask`) that can exist on a `FlowGroup` before a `Job` is activated.
-   **[ ] Update `15-scope-packets-epic.md`:** Define a **"Fork Packet to Quote-Local"** mechanism to allow estimators to modify tasks for a specific project without polluting the global library.
-   **[ ] Update `47-payment-gates-epic.md`:** Explicitly define the **Webhook-to-Gate mapping** (e.g., Stripe `payment_intent.succeeded` -> Release Hold).

---

## 2. New Decisions Needed

These decisions bridge the gap between static objects and dynamic behavior.

-   **[ ] Decision: Multi-Actor Task Execution.** Define how multiple staff members track time and "Complete" a single `RuntimeTaskInstance`.
-   **[ ] Decision: Closeout Package Data Model.** Define the `CloseoutPackage` entity that aggregates and "Freezes" photos, signatures, and plan data into a customer-facing artifact.
-   **[ ] Decision: Plan Versioning.** Define how to store the "Original Plan" (v1) versus the "Current Active Plan" (v2, v3) after a Change Order.

---

## 3. UX Supplements

These supplements help developers build the actual workstation and portal screens.

-   **[ ] Workstation Sorting Logic:** Define a "Priority Score" for the actionable work feed (e.g., `Job Due Date` + `Task Readiness` + `Hold Status`).
-   **[ ] Change Order Delta View:** Define how the portal shows the *difference* between the original quote and the new change order (v1 vs v2).
-   **[ ] Homeowner Payment "Justification" Summary:** Define how AI uses field evidence (photos/checklists) to summarize "Work Completed" in a payment request.

---

## 4. Things Safe to Defer

-   **[ ] MFA Setup UX:** Basic auth is enough for Slice 1.
-   **[ ] Advanced Scheduling Optimization:** Manual drag-and-drop on the calendar is sufficient for the first MVP.
-   **[ ] Full Marketing Automation:** Lead intake from Zapier/Webhooks is enough; internal marketing tools can wait.
-   **[ ] Vendor/Partner Accounts:** Focus on Staff and Homeowner (Primary) portals first.

---

## Summary of Next Step
The recommended next step is **Epic Updates for "Pre-Job" Tasks and "Packet-Forking"**. These address the two largest logic gaps identified in the journeys.
