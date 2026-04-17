# 10 — Final Inspection and Closeout Journey

**User Role:** Office Admin / Inspector / Customer (Homeowner)
**Starting Point:** All core work tasks (e.g., "Install Shingles", "Clean Site") are `COMPLETED`.
**Preconditions:** `Job` status is `ACTIVE`. All nodes in the success path are done.

---

## Main Success Path (Step-by-Step)

1.  **Work Completion:**
    -   **Action:** Field Tech clicks **"Complete All Tasks"**.
    -   **System Action:** Completion rules (Epic 27) trigger the next node: **"Final Inspection"**.
    -   **Status Change:** `Job` status becomes `PENDING_INSPECTION`.
2.  **Scheduling the Inspection:**
    -   **Action:** Office admin opens the **Schedule**.
    -   **Action:** Drags "Final Inspection" to an Inspector's calendar.
    -   **System Action:** `ScheduleBlock` created. Inspector notified.
3.  **Final Inspection Execution:**
    -   **Action:** Inspector arrives at the site. (Audit logged: `INSPECTION_STARTED`).
    -   **Screen:** Inspection Checklist (Epic 38).
    -   **Action:** Inspector checks the ridge cap, flashing, and yard cleanup.
    -   **Photos:** Snap "After" photos of the finished roof.
    -   **Object Created:** `InspectionResult` (Status: `PASS`).
    -   **Action:** Inspector clicks **"Submit Results"**.
4.  **Final Payment Gate:**
    -   **System Decision:** A final `PaymentGate` is linked to the "Closeout" node: **"Final Balance - 10% Due"**.
    -   **Action:** Office admin clicks **"Send Final Invoice"**.
    -   **Notification:** Customer notified: "Job complete! Pay your final balance here: [Link]."
5.  **Customer Completion:**
    -   **Action:** Homeowner clicks the link.
    -   **Action:** Reviews the **"Closeout Gallery"** (Before/After photos).
    -   **Action:** Clicks **"Accept & Pay Final Balance"**.
    -   **System Action:** `PaymentTransaction` (Status: `SUCCEEDED`).
    -   **System Action:** `PaymentGate` (Status: `CLEARED`).
6.  **Job Closeout:**
    -   **System Action:** `Job` status becomes `COMPLETED`.
    -   **Object Created:** `CloseoutPackage` (PDF/ZIP of all photos, signatures, and warranties).
    -   **Notification:** "Your project is now officially closed. Download your warranty package here: [Link]."
    -   **Archive:** `Job` is archived and hidden from the active Workstation.

---

## Alternate / Branch Paths

-   **Inspection Failed:** Inspector finds debris in the gutters.
    -   **Action:** Clicks **"Fail Inspection"**.
    -   **Outcome:** System triggers a **"Punch List"** task.
    -   **Workstation:** "Final Cleanup" appears in the crew's feed (Epic 28).
    -   **Loop:** After cleanup, the "Final Inspection" is re-triggered.
-   **Customer Dispute:** Customer refuses to pay the final balance due to a minor scratch on the siding.
    -   **Action:** Office admin adds a **"Dispute Note"** to the `Job`.
    -   **Outcome:** `Job` remains `ACTIVE` with a `PaymentHold`.

---

## Objects Touched or Created
-   `InspectionResult` (Create)
-   `PaymentRequest` (Final)
-   `Job` (Status: `COMPLETED`)
-   `File` (Closeout Package)
-   `AuditEvent` (Create)

---

## AI Assistance Points
-   **Closeout Package Generation:** AI automatically assembles the best "Before" and "After" photos into a professional PDF (Epic 53).
-   **Review Request:** AI sends a personalized "Review us on Google!" link after the final payment is cleared.
-   **Feedback Analysis:** AI summarizes customer comments from the portal into "Lesson Learned" notes for the estimator (Epic 52).

---

## Human Confirmation Points
-   Inspector confirming the "Pass" status.
-   Homeowner final click on "Pay & Close".
-   Office admin confirming the `Job` is ready to be archived.

---

## What the Customer Sees
-   **Notification:** "Project Complete! View your final gallery and pay your balance."
-   **Portal:** A **"Job Finished"** dashboard with a summary of work and a **"Warranty Download"** button.
-   **Action:** A final "Sign-off" or "Review" request.

---

## What Unlocks Next
-   The **"Post-Project Review"** for the Office team.
-   **Payroll/Commisions** calculations based on the final job margin.

---

## Failure / Error States
-   **Unresolved Punch List:** System prevents "Closeout" if any `PunchTask` is still `PENDING`.
-   **Unpaid Balance:** System prevents "Closeout" if the `PaymentGate` is not cleared.

---

## Current Epic Coverage
-   `38-inspection-model-epic.md`: Covers inspection logic and results.
-   `47-payment-gates-epic.md`: Covers final payment gates.
-   `57-audit-history-epic.md`: Covers the closeout audit trail.

---

## Missing or Ambiguous Areas
-   **Closeout Package Object:** What is the structure of the "Warranty Package"? (Epic 53 mentions it, but not the *Data Model*).
-   **Warranty Activation:** Does the system integrate with third-party manufacturers for warranty registration? (Not defined in any Epic).

---

## Recommendation
-   Update `53-customer-portal-epic.md` to define the **"Closeout Package"** artifact.
-   Clarify in `60-admin-settings-tenant-configuration-epic.md` the **Archive Policy** (e.g., "Auto-archive after 30 days").
