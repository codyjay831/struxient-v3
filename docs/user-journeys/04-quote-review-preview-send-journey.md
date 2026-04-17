# 04 — Quote Review, Preview, and Send Journey

**User Role:** Estimator / Sales Manager
**Starting Point:** Finished Draft Quote (v1)
**Preconditions:** All line items, pricing, and required data are entered.

---

## Main Success Path (Step-by-Step)

1.  **Estimator Internal Review:**
    -   **Action:** Estimator clicks **"Review & Send"**.
    -   **Screen:** Final Review Checklist (Left: Validation Results, Middle: Proposal Preview, Right: Send Controls).
    -   **System Decision:** System runs **"Send Eligibility"** checks (Epic 30).
    -   **Checks:** Are all items priced? Is the customer email valid? Is the margin above the required threshold?
    -   **Outcome:** Warnings (e.g., "Margin below 20%") require **"Acknowledge"** or **"Manager Overwrite"**.
2.  **Customer Proposal Preview:**
    -   **Action:** User clicks **"Preview as Customer"**.
    -   **Screen:** Full-screen modal showing the **Proposal PDF/Web View** (Epic 54).
    -   **Verification:** Confirming proposal groups, descriptions, and "What's Included".
    -   **User Action:** User toggles **"Show Tasks"** (optional) to let the customer see the execution roadmap.
3.  **Final Execution Plan Verification:**
    -   **Action:** User clicks **"Verify Execution Roadmap"**.
    -   **Screen:** Timeline/Node view of the `GeneratedPlan` (Epic 31).
    -   **Verification:** Ensuring the correct workflow (e.g., "Inspection" happens after "Demo").
4.  **The "Send" Transaction:**
    -   **Action:** User clicks **"Confirm & Send Proposal"**.
    -   **System Transaction:** The **"Send Freeze"** happens (Slice 1 / Epic 12).
    -   **Process:** 
        -   `QuoteVersion (v1)` status becomes `SENT`.
        -   The relational quote data is **frozen** (Immutable).
        -   The `GeneratedPlanSnapshot` is written (JSON).
        -   The `ExecutionPackageSnapshot` is written (JSON).
        -   An `AuditEvent` is logged (`QUOTE_SENT`).
    -   **Action:** System sends **Portal Invite** (if new) and **Quote Ready** notification to the customer.
5.  **Post-Send Experience:**
    -   **Action:** Estimator sees the "Quote Sent" confirmation screen.
    -   **Screen:** `Quote` (v1) is now read-only.
    -   **Outcome:** "Quote v1 is now locked. Create v2 to make changes."

---

## Alternate / Branch Paths

-   **Failed Eligibility:** If critical data is missing (e.g., no primary contact), the **"Send"** button is disabled with a list of "Fix Me" links.
-   **Manager Approval:** If the margin is too low, the quote is routed for internal approval before it can be sent. (Epic 60).
-   **Draft Revision:** Estimator decides to go back and edit. The version stays `DRAFT`.

---

## Objects Touched or Created
-   `QuoteVersion` (Status: `SENT`)
-   `GeneratedPlanSnapshot` (Create JSON)
-   `ExecutionPackageSnapshot` (Create JSON)
-   `AuditEvent` (Create)
-   `Invite` (Create for Portal)
-   `AuthToken` (Create for Magic Link)

---

## AI Assistance Points
-   **Margin Analysis:** AI flags "This quote is priced significantly lower than similar jobs in this area."
-   **Error Detection:** "You have a Roof Replacement item but no Demo item; did you forget it?"
-   **Proposal Polishing:** AI suggests better descriptions for manual line items.

---

## Human Confirmation Points
-   Acknowledging margin/price warnings.
-   Previewing the exact PDF/Portal view the customer will see.
-   Final click on "Confirm & Send".

---

## What the Customer Sees
-   **Notification:** Email/SMS: "Your proposal for 123 Main St is ready! View it here: [Magic Link]".
-   **Portal:** When they click, they land directly on the **Proposal Review** screen.

---

## What Unlocks Next
-   The **Customer Portal** access for this specific quote is now live.
-   The **"Accept / Sign"** or **"Decline / Request Changes"** actions for the customer.

---

## Failure / Error States
-   **Email Delivery Failure:** `AuditEvent` logs "Bounced" (Epic 56).
-   **Transaction Conflict:** Two users try to send the same quote at the same time. (Handled via DB locks).

---

## Current Epic Coverage
-   `12-quote-send-freeze-epic.md`: Covers the freeze transaction and eligibility.
-   `31-generated-plan-epic.md`: Covers the plan snapshot.
-   `32-execution-package-epic.md`: Covers the package snapshot.
-   `54-portal-quote-review-sign-epic.md`: Covers the customer preview view.

---

## Missing or Ambiguous Areas
-   **Verification UI:** Where do we define the "Final Review Checklist"? Is it an Epic or a UI-only concern? (Epic 30 handles logic, but the *Experience* is scattered).
-   **Edit after Send:** If the estimator catches a typo *after* sending, they **must** create v2. Is this UX friction addressed? (Epic 08 says v2, but the "Fix Typo" flow is not explicitly defined).

---

## Recommendation
-   Update `11-quote-editing-draft-behavior-epic.md` to include a **"Clone to v2 to Edit"** quick action for sent quotes.
-   Define a **"Proposal Branding"** setting in `60-admin-settings-tenant-configuration-epic.md` to control how the preview looks.
