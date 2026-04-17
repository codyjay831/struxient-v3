# Epic 45 — Scheduling (MVP intent)

## 1. Epic title

Scheduling (MVP planning intent)

## 2. Purpose

Define **scheduling** surfaces for **visibility** and **coordination** while **explicitly** documenting that **MVP does not** use calendar as **start authority** per **`01-scheduling-authority-decision`** and **`09-banned-v2-drift` #7**.

## 3. Why this exists

Teams need calendars; **honesty** prevents false enforcement claims (`01`).

## 4. Canon alignment

- **MVP:** scheduling **non-authoritative** (`01`).
- **Future Phase C:** optional **`COMMITTED`** blocks only may wire into **same** eligibility pipeline (`01`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Dispatcher / PM** | Create **planned** blocks (46). |
| **Field** | View **my schedule** lens. |

## 6. Primary object(s) affected

- **Calendar views** (read models aggregating **ScheduleBlock** — epic 46).

## 7. Where it lives in the product

- **Schedule** nav `/schedule`; **job** and **user** lenses.

## 8. Create flow

- Creating blocks is **epic 46**; this epic defines **UX chrome**:
  - **Banner on all calendar pages:** “Planning only — does not block task start (MVP).” (`01` #8 forbids implying otherwise).

## 9. Read / list / detail behavior

- **Month/week/day** views; **color** by job or by user.
- **Tooltip** on block shows **time class** (46).

## 10. Edit behavior

- Drag **move** block updates **intent** only; **no** effect on **eligibility** (30).

## 11. Archive behavior

- Superseded blocks (46) hide from default.

## 12. Delete behavior

- Delete block per 46 permissions.

## 13. Restore behavior

- Undo move within session optional.

## 14. Required fields

N/A at this epic level.

## 15. Optional fields

N/A.

## 16. Field definitions and validations

- If **Phase C** flag `enforceCommittedScheduleBlocks` true (future), **hide** MVP banner and **enable** eligibility branch (`01`) — **feature flag** documented in 60.

## 17. Status / lifecycle rules

N/A.

## 18. Search / filter / sort behavior

- Filter calendar by **crew**, **job**, **trade** tag on job.

## 19. Relationships to other objects

- **ScheduleBlock** (46), **Job**, **User**.

## 20. Permissions / visibility

- **schedule.view** tenant-wide; **schedule.edit** office.

## 21. Mobile behavior

- **Read-only** calendar for field MVP; **quick** “When is this job planned?” from job header.

## 22. Notifications / side effects

- Optional **reminder** notifications **informational only** — must **not** say “you may not start” based on schedule alone (`01`).

## 23. Audit / history requirements

- **Block** changes audited in 46.

## 24. Edge cases

- **Timezone:** display in **Company.planningTimeZone** (`01` subquestion reuse v2).

## 25. What must not happen

- **Silent** enforcement in a side route (`01` #8, `9` #7).
- Using **`RuntimeTask.scheduledStartAt`** as **gate** without **COMMITTED** policy (`01`).

## 26. Out of scope

- **Phase C** implementation details beyond **flag hook**.

## 27. Open questions

- **Phase C** ship timing — business roadmap, not canon blocker.
