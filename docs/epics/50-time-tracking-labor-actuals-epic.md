# Epic 50 — Time tracking and labor actuals

## 1. Epic title

Time tracking and labor actuals

## 2. Purpose

Define **labor time capture** tied to **execution context** (job, optional **task** attribution) where **authoritative duration** remains **execution timestamps** on **TaskExecution** when work is tracked that way (`07`); this epic covers **additional** **timesheet-style** entries **without** contradicting **append-only** execution truth.

## 3. Why this exists

Not all contractors track **per-task** timers; some need **crew hours** for payroll while still respecting **canon** layering.

## 4. Canon alignment

- **Actual duration** from **TaskExecution** when tasks used (`07`).
- **Schedule overlays** are **intent** (`07`, `01`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Crew lead** | Enter **crew hours** per day per job. |
| **Payroll admin** | Approve **timesheets**. |

## 6. Primary object(s) affected

- **LaborTimeEntry** (`userId`, `jobId`, `date`, `minutes`, `role`, optional `runtimeTaskId`/`skeletonTaskId`, `status` `draft|submitted|approved`, `source`).

## 7. Where it lives in the product

- **Job** → **Time**; **Payroll** export page.

## 8. Create flow

1. **Add entry** → pick **worker** (self or crew if permitted), **date**, **minutes**, **job**.
2. Optional **task** link for attribution; **validate** task belongs to job’s flow.
3. Submit → `submitted` pending approval (if enabled).

## 9. Read / list / detail behavior

- **Week grid** view per user; **totals** per job.
- **Empty:** “No time logged.”

## 10. Edit behavior

- **Draft** editable; **submitted** editable by **admin** with audit; **approved** **no edit** — **reversal** entry.

## 11. Archive behavior

- **Void** via reversal.

## 12. Delete behavior

- Delete **draft** only.

## 13. Restore behavior

- N/A.

## 14. Required fields

`userId`, `jobId`, `date`, `minutes>0`.

## 15. Optional fields

`notes`, `taskRef`.

## 16. Field definitions and validations

- Max **minutes per day** per user guard (e.g. ≤ 24h) with **override** role.

## 17. Status / lifecycle rules

`draft` → `submitted` → `approved` | `rejected`.

## 18. Search / filter / sort behavior

- Filter job, user, week; export CSV.

## 19. Relationships to other objects

- **Job**, **User**, optional **Task**; **does not** auto-write **TaskExecution** unless **explicit** product mode links them — **default:** **separate** systems; **dashboard** can **compare** variance (51).

## 20. Permissions / visibility

- Workers see **own**; leads see **team**; payroll sees **all**.

## 21. Mobile behavior

- **Timer** widget optional; **quick add** 8h with **confirm**.

## 22. Notifications / side effects

- Notify worker when **rejected** with reason.

## 23. Audit / history requirements

- Approvals and edits audited.

## 24. Edge cases

- **Overlapping** entries: **warn** but allow with note.

## 25. What must not happen

- Treating **timesheet** as **task completion** (`04`).

## 26. Out of scope

- **Certified payroll** government formats.

## 27. Open questions

- Whether to **integrate** timer **start/stop** with **TaskExecution** automatically — **large** product fork; **default separate**.
