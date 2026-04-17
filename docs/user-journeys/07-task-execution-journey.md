# 07 — Task Execution Journey

**User Role:** Field Tech / Crew Lead
**Starting Point:** Actionable Task in the **Workstation**.
**Preconditions:** Task status is `READY` or `STARTED`. `Job` is `ACTIVE`.

---

## Main Success Path (Step-by-Step)

1.  **Starting a Task:**
    -   **Action:** Tech taps **"Start Task"** on "Site Prep & Safety Check".
    -   **System Action:** `RuntimeTaskInstance` status becomes `STARTED`.
    -   **System Action:** `AuditEvent` logged (`TASK_STARTED`).
    -   **Time Tracking:** Timer starts (Epic 50).
    -   **Screen:** Task Execution Dashboard.
2.  **Capturing Evidence (During Work):**
    -   **Action:** Tech taps **"Add Photo"**.
    -   **Action:** Snaps a photo of the posted permit.
    -   **Object Created:** `File` (linked to `RuntimeTaskInstance`).
    -   **Action:** Snaps a photo of the crew wearing harnesses.
    -   **Outcome:** All required "Before" photos are attached (Epic 42).
3.  **Entering Structured Data:**
    -   **Action:** Tech clicks **"Fill Checklist"**.
    -   **Screen:** Structured Input Modal (Epic 18).
    -   **Inputs:** "Harnesses checked?" [Yes/No], "Fall protection installed?" [Yes/No].
    -   **Fields:** Tech enters "Roof Pitch: 8/12" and "Total Squares: 32".
    -   **Object Created:** `StructuredInputAnswer` (linked to `TaskInstance`).
4.  **Completing the Task:**
    -   **Action:** Tech taps **"Complete Task"**.
    -   **Screen:** Final Summary (Shows total time, photos, and answers).
    -   **System Action:** `RuntimeTaskInstance` status becomes `COMPLETED`.
    -   **System Action:** `AuditEvent` logged (`TASK_COMPLETED`).
    -   **Time Tracking:** Timer stops and `LaborActual` is calculated (Epic 50).
5.  **Unlocking the Next Step:**
    -   **System Decision:** System evaluates **"Completion Rules"** (Epic 27).
    -   **Outcome:** "Site Prep" is done. The next node "Tear Off" becomes `READY`.
    -   **Notification:** Crew receives a notification: "Tear Off is now unlocked!"
    -   **Workstation:** "Tear Off" appears at the top of the feed.

---

## Alternate / Branch Paths

-   **Task Failure / Issue:** Tech clicks **"Mark as Issue"**.
    -   **Action:** Prompted for reason: "Missing material - Flashing".
    -   **Outcome:** Task status becomes `BLOCKED`. Office is notified.
-   **Partial Completion / Stop:** Tech clicks **"Pause"** or **"End Shift"**.
    -   **Action:** Timer stops; task status remains `STARTED`. (Epic 50).
-   **Gate Evaluation (Routing):** Task results in a failure (e.g., "Inspection Failed").
    -   **Action:** System routes the job into a **"Re-work"** node instead of the next success node (Epic 25).

---

## Objects Touched or Created
-   `RuntimeTaskInstance` (Status: `COMPLETED`)
-   `LaborActual` (Create)
-   `File` (Create/Upload)
-   `StructuredInputAnswer` (Create)
-   `AuditEvent` (Create)
-   `NodeJobExecution` (Update status)

---

## AI Assistance Points
-   **Photo Verification:** AI checks photos for harnesses/safety gear (Epic 42).
-   **Actuals Forecasting:** AI predicts completion time based on previous similar tasks.
-   **Inconsistency Alert:** "You entered 32 Squares but your photos show a much larger roof; please verify."

---

## Human Confirmation Points
-   Tech confirming all checklist items are "Yes".
-   Tech final click on "Complete Task".
-   Office admin reviewing "Evidence Photos" for compliance.

---

## What the Customer Sees
-   **Notification:** "Site Prep is complete! Your crew is starting the Tear Off phase."
-   **Portal:** "Site Prep" node turns green. "Tear Off" node turns blue (Active).
-   **Photos:** Selected "Customer-Facing" photos appear in the portal gallery (Epic 53).

---

## What Unlocks Next
-   The **next valid tasks** in the `NodeJobExecution` sequence.
-   Optional: A **Progress Payment Request** (if a payment gate is linked to this task).

---

## Failure / Error States
-   **Missing Required Photo:** User clicks "Complete" but is stopped by a validation error: "At least 2 'Safety' photos are required."
-   **Sync Conflict:** Mobile device is offline. (Handled via local storage and eventual sync).

---

## Current Epic Coverage
-   `35-runtime-task-instances-epic.md`: Covers task instances.
-   `41-runtime-task-execution-ux-epic.md`: Covers the field worker UX.
-   `42-evidence-photos-completion-proof-epic.md`: Covers photos/proof.
-   `50-time-tracking-labor-actuals-epic.md`: Covers time tracking.

---

## Missing or Ambiguous Areas
-   **Shared Tasks:** If two techs are working on the same task (e.g., "Install Shingles"), who clicks "Start"? Who clicks "Complete"? (Epic 41 assumes a single actor, but construction is a team effort).
-   **Evidence Overwrite:** Can a tech delete an uploaded photo after the task is completed? (Audit Epic 57 says append-only, but UX needs a "Clear/Redo" flow before completion).

---

## Recommendation
-   Update `41-runtime-task-execution-ux-epic.md` to define **Multi-Actor Task Collaboration** (e.g., "Joint Start/Stop").
-   Clarify in `42-evidence-photos-completion-proof-epic.md` the **Verification Flow** (Draft vs Locked photos).
