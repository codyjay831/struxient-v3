# 06 — Pre-Job and Packet Bridge Impact

**Status:** Analyzing the impact of the two bridge decisions on the Struxient v3 product.

---

## 1. Impact Matrix

| Area | Impact of Pre-Job Work Model | Impact of Packet Fork / Promotion Model |
| :--- | :--- | :--- |
| **Leads** | Lead intake creates `FlowGroup` and `PreJobTask` (Survey). | AI-drafted quotes from lead notes create `QuoteLocalPacket`. |
| **FlowGroup** | `FlowGroup` becomes the anchor for `PreJobTask`. | `FlowGroup` can store "As-Surveyed" metadata for `QuoteLocalPacket`. |
| **Site Survey** | A site survey is now a formal `PreJobTask` in the field workstation. | Survey data (photos/inputs) feeds `QuoteLocalPacket` creation. |
| **Quote Authoring** | Survey evidence (photos/measurements) appears in the editor sidebar. | Estimators can "Fork" library packets or create `QuoteLocalPacket` directly. |
| **AI Quote Drafting** | AI uses `PreJobTask` evidence to suggest line items. | AI-suggested scope is created as `QuoteLocalPacket`. |
| **Scope Packets** | N/A | New `QuoteLocalPacket` entity needed; "Promote to Library" flow needed. |
| **Task Definitions** | Pre-job work uses `TaskDefinition` primitives. | `QuoteLocalPacket` uses `TaskDefinition` or creates draft tasks. |
| **Generated Plan** | `GeneratedPlan` uses `PreJobTask` as "Historical Baseline." | `GeneratedPlan` uses `QuoteLocalPacket` as "Execution Contract." |
| **Activation** | Activation consumes `PreJobTask` status and data. | Activation converts `QuoteLocalPacket` into `RuntimeTaskInstance`. |
| **Work Station** | Techs see `PRE_JOB` tasks alongside active job tasks. | Techs see project-specific tasks from `QuoteLocalPacket`. |
| **Payment Holds** | `PreJobTask` (Deposit) can block the final `Quote (v1)` send. | N/A |
| **Change Orders** | N/A | Change orders use `QuoteLocalPacket` for "Ad Hoc" scope. |

---

## 2. Key Epic Updates Required

### A. Pre-Job Work
- **Epic 01 (Leads):** Needs update to define the `FlowGroup` + `PreJobTask` creation flow during lead qualification.
- **Epic 07 (Quotes):** Needs update to clarify that "Survey Evidence" from `PreJobTask` is the primary input for the editor.
- **Epic 39 (Workstation):** Needs update to support a `PRE_JOB` task filter/badge.
- **Epic 45 (Scheduling):** Needs update to allow scheduling `PreJobTask` before a `Job` exists.

### B. Packet Fork / Promotion
- **Epic 15 (Scope Packets):** Needs update to define the `QuoteLocalPacket` entity and the "Fork" behavior.
- **Epic 11 (Quote Editing):** Needs update to include the "Fork Packet" and "Promote to Library" UI actions.
- **Epic 21 (AI Authoring):** Needs update to clarify that all AI output is a `QuoteLocalPacket` first.
- **Epic 31 (Generated Plan):** Needs update to clarify that the plan can be built from library *or* local packets.

---

## 3. Why this matters
- **Consistency:** Ensures that every module in the project "Knows" how to handle pre-job work and project-specific scope.
- **No Data Silos:** Prevents survey data from being "Trapped" in the lead and packet modifications from being "Trapped" in the quote.
- **Clear Roadmap:** Provides a direct to-do list for updating existing epics and planning the schema.

---

## 4. What not to do
- **Do not** allow these decisions to drift into abstract implementation details (keep it at the architectural level).
- **Do not** wait for the first "Real Job" to be built before defining how the survey fed it.

---

## 5. Summary
The "Bridges" are now defined. Pre-Job work is anchored to the site (`FlowGroup`), and Packet mutations are anchored to the quote (`QuoteLocalPacket`).
