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

### 9a. Target vision (merged actionable feed)

**Long-term:** A single **merged** list of actionable rows with explicit **kind** (`PRE_JOB` / `SKELETON` / `RUNTIME`), **node** (where applicable), **elapsed** when in progress, **Start** wired to the **same eligibility** story as task detail, and **PRE_JOB** badge for `PreJobTask` rows. **Pre-job** rows are **FlowGroup**-anchored and do **not** require an activated `Job`.

**Empty actionable:** “No tasks ready — check **Blocked** tab for holds or payments.”

**Pagination:** infinite scroll with **cursor** by `(jobId, taskId)`.

### 9b. Slice 1 repo truth (do not overclaim)

**Implemented today:** Tenant-wide office **`/work`** and **`GET /api/work-feed`** include a **separate** **read-only** pre-job table: open `PreJobTask` rows (lifecycle `status` only — **no** payment/hold/actionability merge), deep links to **quote workspace** or **project shell**, **no** per-row **Start** / **Complete** for pre-job, **no** `PRE_JOB` badge in a unified row model, **no** `TaskExecution` linkage. **Skeleton** and **runtime** sections reuse flow actionability; **pre-job** does **not**.

**Canon alignment:** This satisfies **discovery** and **identity** for pre-job work without implying **execution parity** with runtime/skeleton. **Future (optional):** merged rows, badges, start/complete, and normalized evidence — **only when** product chooses to deepen the lifecycle; **not** a prerequisite for keeping `PreJobTask` narrow and lightly used.

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

- **Start** button calls same **eligibility** API as detail (30) — **no** duplicate client logic (**runtime/skeleton** today; **pre-job** when/if start exists — see §9b).

## 17. Status / lifecycle rules

N/A.

## 18. Search / filter / sort behavior

- Search **task name**, **job #** substring.
- Filters: **job**, **node**, **kind** (`pre_job`/`skeleton`/`runtime`), **blocked reason** (**target** unified feed; **Slice 1** may list pre-job in a **separate** section without node/kind merge — see §9b).
- Sort: **priority** (tenant rule), **node order**, **manual** — default **node order** then **task order**.

## 19. Relationships to other objects

- Pulls **Flow**, **Job**, **Effective projection**, **Holds**, **Gates**.
- Pulls **`PreJobTask`** rows for pre-quote operational work. **Slice 1 implementation:** tenant-wide open rows (not yet filtered to “assigned FlowGroups only”); **target** may narrow by assignment/permission (epic 59).

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
