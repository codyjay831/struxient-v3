# 01 — Lead to Quote Journey

**User Role:** Office Admin / Estimator
**Starting Point:** Marketing Lead Intake or Manual Entry
**Preconditions:** Tenant is active; user is logged in as Staff.

**Repo truth (2026-04):** Prisma has a **minimal** `Lead` table, `LeadStatus` (e.g. `OPEN`, not `NEW`), and optional **`Quote.leadId`**. **No** office `/leads` flow or convert mutations exist yet — intake in product is still primarily **new quote shell** (Customer + FlowGroup + Quote). Align future UI with **`LeadStatus`** enum names.

---

## Main Success Path (Step-by-Step)

1.  **Lead Intake:**
    -   **Action:** System receives a lead (API/Zapier) or user clicks **"New Lead"**.
    -   **Fields:** Name, phone, email, address, lead source, notes.
    -   **Object Created:** `Lead` (status: `NEW`).
2.  **Initial Triage:**
    -   **Action:** Office admin opens the Lead record.
    -   **Screen:** Lead Dashboard.
    -   **Decision:** Is the address in our service area? Does the project fit our scope?
    -   **AI Point:** AI summarizes notes or extracts details from incoming form data.
3.  **Qualification / Conversion:**
    -   **Action:** User clicks **"Qualify & Convert"**.
    -   **System Decision:** Does this person already exist as a `Customer`? (Search by email/phone).
    -   **Objects Created:** 
        -   `Customer` record (linked to the lead).
        -   `Contact` record (from lead identity).
        -   `FlowGroup` record (anchored to the site address from the lead).
    -   **Object Updated:** `Lead` (status: `QUALIFIED`).
4.  **Quote Shell Creation:**
    -   **Action:** User clicks **"Start Quote"** from the new `FlowGroup`.
    -   **Fields:** Select `Quote Template` (optional), assign `Estimator`.
    -   **Object Created:** `Quote` (status: `DRAFT`, version: `v1`).
    -   **Landing Screen:** Quote Editor (Draft View).

---

## Alternate / Branch Paths

-   **Disqualification:** If the lead is a poor fit, user clicks **"Disqualify"**. `Lead` status becomes `CLOSED`.
-   **Duplicate Found:** If the customer exists, user selects the existing `Customer` record instead of creating a new one.

---

## Objects Touched or Created
-   `Lead` (Update status)
-   `Customer` (Create)
-   `Contact` (Create)
-   `FlowGroup` (Create)
-   `Quote` (Create)
-   `QuoteVersion` (Create v1)

---

## AI Assistance Points
-   Extracting lead data from emails/webforms.
-   Checking for potential duplicates (Fuzzy matching on email/phone).
-   Categorizing lead intent (e.g., "Full Roof Replacement" vs. "Minor Leak").

---

## What the Customer Sees
-   Nothing yet. The lead is internal-only.
-   Optional: "Lead Received" auto-responder email.

---

## What Unlocks Next
-   The **Quote Editor** is now available.
-   The decision to schedule a **Site Survey** (if needed) can be made.

---

## Current Epic Coverage
-   `01-leads-epic.md`: Covers lead intake and status well.
-   `02-customers-epic.md`: Covers customer creation.
-   `07-quotes-epic.md`: Covers initial quote shell creation.

---

## Missing or Ambiguous Areas
-   **Site Survey Trigger:** Is the survey scheduled from the Lead, the FlowGroup, or the Quote? (Epic 01 implies qualification, but Epic 07 doesn't explicitly link to the survey).
-   **Lead-to-Contact Mapping:** If a lead has multiple people (husband/wife), do both become contacts during conversion?

---

## Recommendation
-   Update `01-leads-epic.md` to clarify that conversion **requires** a `FlowGroup` (Site Address) to be valid for quoting.
-   Explicitly state that conversion creates the `Contact` for the primary lead identity.
