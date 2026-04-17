# 08 — Payment Holds and Homeowner Request Journey

**User Role:** Office Admin / Customer (Homeowner)
**Starting Point:** Work Progress reaches a **Payment Gate**.
**Preconditions:** `Job` is `ACTIVE`. A `PaymentGate` is defined in the workflow.

---

## Main Success Path (Step-by-Step)

1.  **Reaching the Payment Gate:**
    -   **Action:** Field Tech completes the "Tear Off" task.
    -   **System Action:** Completion rules (Epic 27) trigger the next node: "Tear Off Inspection".
    -   **System Decision:** A `PaymentGate` is linked to this node: **"Progress Payment #1 - 40% Due"**.
    -   **Outcome:** The node "Install Shingles" is now `LOCKED` with a `PaymentHold` (Epic 29).
2.  **Homeowner Request:**
    -   **Action:** Office admin opens the `Job` (or it's auto-triggered).
    -   **Action:** Clicks **"Send Payment Request"**.
    -   **Fields:** Select "Progress Payment #1" (Amount: $5,200).
    -   **System Action:** `PaymentRequest` record created (linked to `Job`).
    -   **Notification:** Email/SMS: "Progress payment requested! View it in your portal: [Link]."
3.  **Customer Portal View:**
    -   **Action:** Homeowner clicks the link.
    -   **Auth:** Magic Link/Portal Session.
    -   **Landing Screen:** **Billing & Payments** Dashboard (Epic 53).
    -   **Item:** A banner: "Payment Requested: $5,200 (Progress Payment #1)".
    -   **Verification:** Customer clicks **"What is this for?"**.
    -   **Insight:** AI summarizes the work done: "Tear Off completed. Photo proof: [Link]."
4.  **Customer Payment:**
    -   **Action:** Customer clicks **"Pay Now"**.
    -   **Screen:** Payment Modal (Credit Card / ACH / Finance).
    -   **Fields:** Enter card details, click **"Confirm Payment"**.
    -   **System Action:** `PaymentTransaction` record created (Status: `SUCCEEDED`).
5.  **Releasing the Hold:**
    -   **System Action:** Payment success triggers a webhook.
    -   **Process:** 
        -   The `PaymentGate` status becomes `CLEARED`.
        -   The `PaymentHold` on the "Install Shingles" node is released (Epic 48).
        -   An `AuditEvent` is logged (`HOLD_RELEASED_BY_PAYMENT`).
    -   **Notification:** Crew Lead notified: "Payment received! You are now unlocked to start Install Shingles."
6.  **Next Tasks Unlocked:**
    -   **Action:** Crew Lead opens the **Workstation**.
    -   **Outcome:** "Install Shingles" is now `READY`. The **"Start Task"** button is active.

---

## Alternate / Branch Paths

-   **Failed Payment:** Card is declined. (Status: `PAYMENT FAILED`). Customer is prompted to try again.
-   **Manual Release:** Office Admin decides to allow work to continue *without* payment.
    -   **Action:** Admin clicks **"Bypass Payment Hold"**.
    -   **Reason:** Required (e.g., "Verified check in hand").
    -   **Outcome:** Hold released; work continues. (Logged in Audit).
-   **Partial Payment:** Customer pays only part of the request. Hold remains active until the full amount is reached (Epic 47).

---

## Objects Touched or Created
-   `PaymentRequest` (Create)
-   `PaymentTransaction` (Create)
-   `Hold` (Release status)
-   `AuditEvent` (Create)
-   `NodeJobExecution` (Update status to `READY`)

---

## AI Assistance Points
-   **Progress Summary:** AI summarizes field evidence (photos/checklists) into a homeowner-friendly "Work Done" report to justify the payment request.
-   **Churn Risk Alert:** "Customer has viewed the payment request 5 times but has not paid; suggests a follow-up call."
-   **Fraud Detection:** Flagging unusual payment behavior or amounts.

---

## Human Confirmation Points
-   Office admin confirming the payment request amount before sending.
-   Homeowner final click on "Confirm Payment".
-   Admin manually bypassing a hold (high-audit event).

---

## What the Customer Sees
-   A clear, professional **Payment Request** in their portal.
-   A summary of **Work Completed** that justifies the payment.
-   A secure **Payment Interface**.
-   A **Receipt** after successful payment.

---

## What Unlocks Next
-   The **next sequence of work nodes** (e.g., "Install Shingles", "Ridge Cap Installation").
-   The **Scheduling** of the next crew (if blocked by payment).

---

## Failure / Error States
-   **Insufficient Funds:** Payment fails. (Status: `PAYMENT FAILED`).
-   **Blocked Workflow:** Crew is ready to work but the homeowner is on vacation and hasn't paid. (Outcome: `JOB IDLE`).

---

## Current Epic Coverage
-   `29-hold-model-epic.md`: Covers the core hold logic.
-   `47-payment-gates-epic.md`: Covers the connection between payment and gates.
-   `48-payment-holds-operational-holds-epic.md`: Covers the operational release of holds.

---

## Missing or Ambiguous Areas
-   **Stripe/Provider Integration:** Where is the actual **Payment Provider** logic (API/Webhooks)? (Epics mention "Status Succeeded", but not the *Provider Integration*).
-   **Finance Options:** How are **Financing** requests (third-party lenders) handled within the flow? (Epic 53 mentions payments, but not "Financing Pending" states).

---

## Recommendation
-   Update `47-payment-gates-epic.md` to define **Payment Provider Webhook Mapping** (e.g., Stripe `payment_intent.succeeded` -> Clear Gate).
-   Define a **"Finance Hold"** in `29-hold-model-epic.md` to support third-party lenders.
