# 05 — Customer Response and Sign Journey

**User Role:** Customer (Homeowner)
**Starting Point:** Received email/SMS with Quote Magic Link
**Preconditions:** QuoteVersion (v1) status is `SENT`. Portal invite is active.

---

## Main Success Path (Step-by-Step)

1.  **Opening the Portal:**
    -   **Action:** Customer clicks the **Magic Link** in their email.
    -   **Auth Process:** Link carries an `AuthToken (MAGIC_LINK)`. System verifies and creates a `PortalSession`.
    -   **Landing Screen:** Quote Review (Portal View).
    -   **Screen:** Customer sees the **Proposal Preview** (Groups, Descriptions, Prices).
2.  **Exploring Options:**
    -   **Action:** Customer clicks **"Include Gutters (+$1,200)"** in the optional items list.
    -   **Outcome:** Quote total updates in real-time.
    -   **System Decision:** Toggling optional items updates the draft selection *only* in the customer's portal view (Epic 10).
3.  **Reviewing the Scope:**
    -   **Action:** Customer clicks **"What's Included"**.
    -   **Screen:** Description of materials, labor, and the **Execution Roadmap** (Stages: Prep, Work, Cleanup).
    -   **Verification:** Homeowner confirms they like the plan (e.g., "AI detected 10 sq ft of damage included").
4.  **Accepting the Quote:**
    -   **Action:** Customer clicks **"Accept & Sign Proposal"**.
    -   **Screen:** Signature Modal.
    -   **Input:** Type name, Draw signature, Date.
    -   **Fields:** Customer reviews and clicks **"Confirm Acceptance"**.
5.  **Post-Acceptance Transaction:**
    -   **System Transaction:** The **"Acceptance Freeze"** happens (Epic 13).
    -   **Process:** 
        -   `QuoteVersion (v1)` status becomes `ACCEPTED`.
        -   The **Signature Snapshot** (image + metadata) is stored.
        -   An `AuditEvent` is logged (`QUOTE_ACCEPTED`).
        -   The **"Acceptance Confirmation"** email is sent to the customer with a PDF copy of the signed quote.
    -   **Internal Notification:** Estimator and Office Admin are notified.
6.  **Next Steps Screen:**
    -   **Action:** Customer is redirected to the "What Happens Next" dashboard.
    -   **Screen:** "Welcome! We are preparing your project. Next steps: [Pay Deposit], [Select Shingle Color]." (Epic 55).

---

## Alternate / Branch Paths

-   **Decline Quote:** Customer clicks **"Decline"**.
    -   **Action:** Prompted for reason (e.g., "Too expensive", "Found another contractor").
    -   **Outcome:** `QuoteVersion (v1)` status becomes `DECLINED`.
-   **Request Changes:** Customer clicks **"Request Changes"**.
    -   **Action:** Types a message: "Please remove the gutters and adjust the start date."
    -   **Outcome:** Estimator is notified to create `v2`.
-   **Expired Link:** Customer clicks an old link. `AuthToken` is expired. They are prompted to **"Send New Link"**.

---

## Objects Touched or Created
-   `QuoteVersion` (Status: `ACCEPTED`)
-   `PortalSession` (Create)
-   `Signature` (Create Snapshot)
-   `AuditEvent` (Create)
-   `AuthToken` (Consumed)

---

## AI Assistance Points
-   **Chat Support:** AI chatbot in the portal answers customer questions like "What does Gutter Flashing mean?" or "When can you start?"
-   **Change Request Summary:** AI summarizes customer's change requests for the estimator (e.g., "Customer wants gutters removed; suggests $500 discount").

---

## Human Confirmation Points
-   Customer typing their legal name and drawing a signature.
-   Customer confirming the final total after toggling optional items.

---

## What the Customer Sees
-   A modern, mobile-friendly **Proposal Review** screen.
-   Clear, simple **"Accept"** and **"Decline"** buttons.
-   A "What's Included" breakdown that builds trust.

---

## What Unlocks Next
-   The **"Activation"** flow for the Office Admin.
-   **Job Creation** (if not auto-activated).
-   The **Portal Dashboard** (where the customer can track progress).

---

## Failure / Error States
-   **Duplicate Signatures:** System prevents signing twice for the same version.
-   **Invalid Token:** Customer cannot access the portal without a valid `AuthToken`.

---

## Current Epic Coverage
-   `13-quote-signatures-acceptance-epic.md`: Covers acceptance and signature capture.
-   `53-customer-portal-epic.md`: Covers portal basics and magic links.
-   `54-portal-quote-review-sign-epic.md`: Covers the specific review and sign UX.

---

## Missing or Ambiguous Areas
-   **Deposit Requirement:** If a deposit is required *at the time of signing*, where is that payment logic? (Epic 13 doesn't mention payment; Epic 47/48 mention gates, but not integrated into the signature flow).
-   **Multi-Signer:** What if a husband and wife both need to sign? (Epic 13 is silent on multiple signatures per version).

---

## Recommendation
-   Update `13-quote-signatures-acceptance-epic.md` to clarify if **Payment Gates** (Deposit) can block the final `ACCEPTED` status.
-   Define a **"Co-Signer"** flag in `04-contacts-and-contact-methods-epic.md` to support multi-signer requirements.
