# 01 — Pre-Job Work Model Decision

**Status:** Decision finalized to resolve the "Pre-Quote Execution Gap."

---

## Decision
Struxient v3 will introduce a dedicated **PreJobTask** entity, anchored to the **FlowGroup** (Project Site Anchor), to represent operational work that happens before a signed quote becomes an activated job.

---

## Current evidence
- **Journey 02 (Site Survey):** Site surveys are "real work" that require field tech scheduling, photo evidence, and structured data (measurements), but they occur *before* a quote is even drafted.
- **Journey 01 (Lead Intake):** Feasibility reviews and intake clarifications are often needed to qualify a lead.
- **Epic 34 (Job Anchor):** Currently, a `Job` only exists after activation. Using `Job` for pre-quote work would force "fake jobs" into the system, polluting the project/execution history and breaking the "signed-contract-only" boundary for jobs.

---

## Recommendation
1. **The Object:** Create a `PreJobTask` model.
2. **The Anchor:** Anchor `PreJobTask` to the `FlowGroup`.
3. **The Workstation:** Allow `PreJobTask` to appear in the field **Workstation** (Epic 39) with a specific `PRE_JOB` badge.
4. **The Lifecycle:**
   - **Creation:** Triggered manually from the `Lead` or `FlowGroup` dashboard (e.g., "Schedule Site Survey").
   - **Execution:** Uses the standard `Task` primitives (Epic 41, 42) — photos, evidence, structured inputs.
   - **Completion:** Feeds data directly into the **Quote Editor** sidebar.
   - **Post-Activation:** `PreJobTask` remains attached to the `FlowGroup` as historical evidence. It is *not* moved into the `Job`, but the `Job` can reference it.

---

## Why
- **Execution Consistency:** Field workers use the same mobile interface and "Actionable Work Feed" for surveys as they do for roof repairs.
- **Clean Boundaries:** Keeps the `Job` entity strictly for "Contracted Execution," preventing data pollution.
- **Quote Grounding:** Provides a formal "Evidence Packet" (photos/measurements) that the estimator uses to justify line items and pricing.

---

## What not to do
- **Do not** create a `Job` just to track a site survey.
- **Do not** store site survey measurements as unstructured "Notes" or "Files" if they need to feed the quote.
- **Do not** force pre-job work into the `Lead` object, as leads may have multiple sites (FlowGroups) and are person-centric, not project-site-centric.

---

## Deferred
- **Automated Survey Scheduling:** AI-triggered scheduling based on lead metadata.
- **Multi-Visit Surveys:** For Slice 1, assume one survey task per site unless manually added.

---

## Open question
- Should `PreJobTask` and `RuntimeTaskInstance` share a base `Task` table or remain strictly separate for performance? (Recommendation: Share a base table for UI/Workstation reuse, but with a discriminator).
