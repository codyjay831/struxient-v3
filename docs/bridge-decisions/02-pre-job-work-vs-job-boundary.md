# 02 — Pre-Job Work vs. Job Boundary

**Status:** Defining the operational lifecycle and handoff points.

---

## 1. Boundary Matrix

| Stage | Object | Primary Actor | Data Focus |
| :--- | :--- | :--- | :--- |
| **Lead Intake** | `Lead` | Office / Sales | Person info, initial interest, qualification. |
| **Pre-Job Work**| `PreJobTask` | Field Tech / Sales | Surveys, measurements, feasibility, photo evidence. |
| **Quoting** | `Quote` | Estimator | Commercial scope, line items, pricing, signature. |
| **Execution** | `Job` | Crew Lead / PM | Contracted labor, task fulfillment, materials, payment. |

---

## 2. Decision Logic: Where does it belong?

### A. Site Survey / Photo Request
- **Decision:** Belongs in **PreJobTask**.
- **Why:** It is operational work needed to *create* the Quote. It happens before a contract exists.

### B. Utility / AHJ Verification
- **Decision:** Belongs in **PreJobTask**.
- **Why:** Necessary to confirm the project can be done (Feasibility).

### C. Change Order Review
- **Decision:** Belongs in **Job** (as a `Detour` or `ChangeOrder` node).
- **Why:** The contract is already signed; this is an adjustment to active work.

### D. Lead Call / Follow-up
- **Decision:** Belongs in **Lead** (as an `ActivityLog` or `Note`).
- **Why:** It is sales communication, not project-site-specific work.

---

## 3. The Activation Handoff

When the user clicks **"Activate Job"** (Epic 33):
1. **The Lead** is already `QUALIFIED`.
2. **The Quote** is `ACCEPTED`.
3. **The PreJobTasks** (Surveys) are `COMPLETED`.
4. **The FlowGroup** transitions from "Prospect" to "Active Job Site."
5. **The Job** is created as the *anchor of execution* (Epic 34).

---

## 4. Why this matters
- **No "Fake Jobs":** Prevents the system from having hundreds of "Jobs" for leads that never sign a contract.
- **Clear Workstation Sorting:** Field techs can filter their feed for `PRE_JOB` (Prospects) vs `ACTIVE` (Contracted Work).
- **Audit Traceability:** Maintains a clear record of "What we found during the survey" separately from "What we did during the job."

---

## 5. What not to do
- **Do not** use `PreJobTask` for things that happen *after* the quote is signed (e.g., "Final Inspection" belongs in `Job`).
- **Do not** use `Lead` notes to store technical site measurements (e.g., "Roof Pitch" belongs in a `PreJobTask` structured input).
- **Do not** wait for a job to exist before allowing field techs to upload photos or take measurements.
