# 06 — Activation and Workstation Journey

**User Role:** Office Admin / Field Tech (Lead)
**Starting Point:** QuoteVersion (v1) is `ACCEPTED`.
**Preconditions:** Signed Quote exists. `ExecutionPackageSnapshot` is written (JSON).

---

## Main Success Path (Step-by-Step)

1.  **Opening the Activation View:**
    -   **Action:** Office Admin opens the `FlowGroup` or `Quote`.
    -   **Screen:** "Activation Pending" banner.
    -   **Action:** Clicks **"Activate Job"** (Epic 33).
    -   **Fields:** Assign `Project Manager`, `Crew Lead`, and `Target Start Date`.
    -   **Action:** Clicks **"Confirm Activation"**.
2.  **Job Creation (The "Big Bang"):**
    -   **System Transaction:** 
        -   `Job` record created (Status: `ACTIVE`, linked to `FlowGroup`).
        -   `RuntimeTaskInstance` records created (from `ExecutionPackageSnapshot`).
        -   `NodeJobExecution` records created (from `WorkflowVersion`).
        -   `AuditEvent` logged (`JOB_ACTIVATED`).
        -   Initial **Task Statuses** set based on `StartEligibility` (Epic 30).
3.  **Entering the Workstation:**
    -   **Action:** Field Tech (Crew Lead) opens the **Struxient Mobile App**.
    -   **Action:** Taps **"Workstation"** (Epic 39).
    -   **Screen:** A unified feed of **"Actionable Tasks"** for their assigned jobs.
    -   **Feed Logic:** Only tasks that are `READY` and `UNLOCKED` are shown.
    -   **Item:** Tech sees "123 Main St: Site Prep & Safety Check" at the top.
4.  **Verifying Readiness:**
    -   **Action:** Tech taps the task card.
    -   **Screen:** Task Detail.
    -   **Section:** "Readiness Check".
    -   **Check:** "Material Delivery Confirmed", "Permit Posted", "No Payment Holds".
    -   **Outcome:** All checks pass. The **"Start Task"** button is bright green.
5.  **Understanding the Roadmap:**
    -   **Action:** Tech taps **"Job Roadmap"**.
    -   **Screen:** A visual graph of current work vs. future work (Epic 40).
    -   **Insight:** Tech sees that "Tear Off" is currently `LOCKED` until "Site Prep" is done.
    -   **Insight:** Tech sees "Final Inspection" at the bottom (future).

---

## Alternate / Branch Paths

-   **Activation Blocked:** A "Deposit Payment Gate" is active. The **"Activate Job"** button is disabled until the customer pays. (Epic 47).
-   **No Assigned Crew:** The job is activated but doesn't appear in anyone's workstation yet because no `Staff` is assigned to the `Job`.
-   **Auto-Activation:** A tenant setting (Epic 60) triggers activation immediately upon the customer signing the quote.

---

## Objects Touched or Created
-   `Job` (Create)
-   `RuntimeTaskInstance` (Create all)
-   `NodeJobExecution` (Create all)
-   `AuditEvent` (Create)
-   `StaffAssignment` (Create)

---

## AI Assistance Points
-   **Scheduling Recommendations:** AI suggests the best start date based on crew availability and weather.
-   **Resource Allocation:** AI flags "This job requires 3 installers; your current crew only has 2 available."
-   **Readiness Monitoring:** AI proactively alerts "Site Prep cannot start because permit was not uploaded."

---

## Human Confirmation Points
-   Office admin assigning the crew and start date.
-   Crew lead confirming they have the necessary tools/materials.
-   Confirming the "Activation" action (manual step for most GCs).

---

## What the Customer Sees
-   **Notification:** "We've activated your project! Your crew lead is [John Doe]. Track progress here: [Link]."
-   **Portal:** A new "Execution Timeline" appears in their dashboard.

---

## What Unlocks Next
-   The first **Task Execution** (e.g., "Site Prep") can now be started.
-   **Material Ordering** and **Scheduling** tasks become active.

---

## Failure / Error States
-   **Missing Snapshot:** The `ExecutionPackageSnapshot` was somehow corrupted. (Status: `ACTIVATION FAILED`).
-   **Locked Root Node:** The starting node in the workflow has a `Hold` that prevents any work from beginning. (Status: `JOB ON HOLD`).

---

## Current Epic Coverage
-   `33-activation-epic.md`: Covers activation logic.
-   `34-job-anchor-epic.md`: Covers the `Job` object.
-   `39-work-station-actionable-work-feed-epic.md`: Covers the worker-facing feed.
-   `40-node-job-execution-views-epic.md`: Covers the visual roadmap.

---

## Missing or Ambiguous Areas
-   **Task Assignment:** How are individual tasks assigned to specific people (e.g., "Electrician" vs "Roofer")? (Epic 34 mentions `StaffAssignment` at the `Job` level, but `Task`-level assignment is less clear).
-   **Workstation Sorting:** How does the workstation decide the priority of tasks across *different* jobs? (Epic 39 mentions "Actionable Work Feed", but the sorting logic is undefined).

---

## Recommendation
-   Update `39-work-station-actionable-work-feed-epic.md` to define **Priority Scoring** (e.g., Date + Urgency + Hold Status).
-   Clarify in `35-runtime-task-instances-epic.md` if individual tasks can be assigned to **Role Groups** or **Specific Staff**.
