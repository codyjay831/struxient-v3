# 02 — Site Survey Decision and Scheduling Journey

**User Role:** Office Admin / Field Tech (Surveyor)
**Starting Point:** Qualified Lead or Draft Quote
**Preconditions:** Customer/FlowGroup created; Lead status is `QUALIFIED`.

---

## Main Success Path (Step-by-Step)

1.  **Decision to Survey:**
    -   **Action:** Estimator/Office user reviews the lead notes/photos.
    -   **Decision:** "Is a formal site survey needed to quote accurately?"
    -   **System Decision:** User clicks **"Schedule Site Survey"**.
    -   **Status Change:** `FlowGroup` (status: `SURVEY_PENDING`).
2.  **Scheduling the Survey:**
    -   **Action:** Office user opens the **Schedule** view.
    -   **Action:** Drags a "Site Survey" block onto a Field Tech's calendar.
    -   **Fields:** Date, Window (e.g., 9 AM - 12 PM), Technician, Site Access Notes.
    -   **Object Created:** `ScheduleBlock` (linked to `FlowGroup`).
    -   **Notification:** Push notification sent to the Field Tech.
3.  **Field Arrival & Capture:**
    -   **Action:** Field Tech opens the **Struxient Mobile App**.
    -   **Action:** Taps the "Site Survey" task.
    -   **Action:** Clicks **"Arrived"** (Audit event logged).
    -   **Screen:** Survey Checklist (from `ScopePacket` templates?).
    -   **Capture:** Photos of the site, measurements, attic access, existing damage.
    -   **Objects Created:** `File` (Photos), `Note` (Observations).
4.  **Submission:**
    -   **Action:** Tech clicks **"Complete Survey"**.
    -   **Object Created:** `AuditEvent` (Survey Completed).
    -   **Notification:** Estimator notified that survey data is ready.
5.  **Review for Quoting:**
    -   **Action:** Estimator opens the `FlowGroup` or `Quote`.
    -   **Screen:** Photo Gallery / Survey Notes sidebar.
    -   **Outcome:** Estimator uses survey data to build the Quote.

---

## Alternate / Branch Paths

-   **Defer Survey:** Estimator decides no survey is needed (e.g., simple repair). Quote proceeds without it.
-   **No Show:** Tech marks the survey as "Missed" or "Rescheduled".

---

## Objects Touched or Created
-   `FlowGroup` (Update status)
-   `ScheduleBlock` (Create)
-   `File` (Create/Upload)
-   `Note` (Create)
-   `AuditEvent` (Create)

---

## AI Assistance Points
-   AI-generated summaries of survey photos (e.g., "AI detects 3 layers of shingles").
-   AI-extracted measurements from photos (if integrated).
-   Auto-suggesting a `ScopePacket` based on survey keywords (e.g., "Found mold" -> suggest "Mold Remediation" packet).

---

## Human Confirmation Points
-   Office admin confirming the appointment with the customer.
-   Field tech confirming site arrival and task completion.
-   Estimator reviewing survey photos before finalizing the quote.

---

## What the Customer Sees
-   Confirmation of the scheduled survey time (Email/SMS).
-   Notification when the tech is "On their way".
-   No internal survey photos/notes are shown in the portal (Internal only).

---

## What Unlocks Next
-   The **Quote Editor** now has the required site data to be "Ready for Send".

---

## Failure / Error States
-   **No Access:** Tech arrives but cannot enter the site. (Status: `BLOCKED`).
-   **Incomplete Data:** Tech misses required photos. (Status: `RE-VISIT NEEDED`).

---

## Current Epic Coverage
-   `45-scheduling-epic.md`: Covers the scheduling blocks.
-   `43-mobile-field-execution-epic.md`: Covers field app basics.
-   `06-files-photos-documents-epic.md`: Covers photo uploads.

---

## Missing or Ambiguous Areas
-   **Survey Template Object:** Is a "Site Survey" a `Job`? Or is it a special `Task` that exists before a `Job` is created? (Canon 03 says Job anchors execution, but surveys happen *before* the Quote is signed).
-   **Survey Data Persistence:** Where do structured measurements (e.g., "Pitch: 6/12", "Eave length: 40ft") live? (Epic 18 says `StructuredInputAnswer`, but these are linked to `Tasks`).

---

## Recommendation
-   Clarify in `07-quotes-epic.md` or a new Decision that **Pre-Quote Tasks** (like Surveys) can exist on a `FlowGroup` without a `Job` anchor.
-   Define a specialized `SurveyResult` object or reuse `StructuredInputAnswer` for pre-quote data.
