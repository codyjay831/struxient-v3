# Epic 39 — Work station and actionable work feed

## 1. Epic title

Work station and actionable work feed

## 2. Purpose

Define the **primary field/office execution landing** experience: **merged effective tasks** (36) filtered to **actionable** (30), grouped by **job** and **node**, with **explicit blockers** surfaced.

## 3. Why this exists

Crews need a **credible** answer to **“What can I do right now?”** without hunting multiple screens.

## 4. Canon alignment

- Uses **explicit task vocabulary** in tooltips (`04`).
- **Scheduling** does **not** affect actionability MVP (`01` decision).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Field tech** | View **My work** feed; start tasks from here (41). |
| **Crew lead** | See **team** feed if permission (59). |

## 6. Primary object(s) affected

- **Feed query** (no new persistent object); optional **saved views** future.

## 7. Where it lives in the product

- **Nav:** **Work** `/work`; **mobile** tab (43).

## 8. Create flow

Not applicable.

## 9. Read / list / detail behavior

**Sections:** Today, Upcoming (informational schedule only), **Blocked** (with reasons).

**Pre-Job section:** `PreJobTask` items (site surveys, utility checks) appear with a `PRE_JOB` badge. These are anchored to a `FlowGroup` and do not require an activated `Job`.

**Row:** Task title, job (or FlowGroup for pre-job), node, **kind** badge (`PRE_JOB` / `SKELETON` / `RUNTIME`), **elapsed** if in progress, **Start** button state.

**Empty actionable:** “No tasks ready — check **Blocked** tab for holds or payments.”

**Pagination:** infinite scroll with **cursor** by `(jobId, taskId)`.

## 10. Edit behavior

- **Pin** job to top **user preference** (local storage ok).

## 11. Archive behavior

- Not applicable.

## 12. Delete behavior

- Not applicable.

## 13. Restore behavior

- Not applicable.

## 14. Required fields

N/A.

## 15. Optional fields

User prefs: `defaultSort`, `showCompletedToday`.

## 16. Field definitions and validations

- **Start** button calls same **eligibility** API as detail (30) — **no** duplicate client logic.

## 17. Status / lifecycle rules

N/A.

## 18. Search / filter / sort behavior

- Search **task name**, **job #** substring.
- Filters: **job**, **node**, **kind** (`pre_job`/`skeleton`/`runtime`), **blocked reason**.
- Sort: **priority** (tenant rule), **node order**, **manual** — default **node order** then **task order**.

## 19. Relationships to other objects

- Pulls **Flow**, **Job**, **Effective projection**, **Holds**, **Gates**.
- Pulls **PreJobTask** records from assigned `FlowGroups` for pre-quote operational work.

## 20. Permissions / visibility

- Field users **assigned** jobs only if row-level on (59); else **all jobs** in tenant (product choice — **document** per tenant).

## 21. Mobile behavior

- Primary **mobile** home; **pull to refresh**; **offline** last-known with banner (43).

## 22. Notifications / side effects

- Deep links from push open **task detail** with **eligibility** recheck (56).

## 23. Audit / history requirements

- **No** audit for feed views; audit **starts** on task.

## 24. Edge cases

- **Large jobs 500+ tasks:** virtualized list; **server-side** actionable filter **required**.

## 25. What must not happen

- Showing **Start enabled** when API would reject (`9` split-brain).

## 26. Out of scope

- **Gantt** chart resource leveling.

## 27. Open questions

- **Team feed** default off or on — tenant policy (59).
