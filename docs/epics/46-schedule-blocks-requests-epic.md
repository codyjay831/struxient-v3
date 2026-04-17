# Epic 46 — Schedule blocks and requests

## 1. Epic title

Schedule blocks and requests

## 2. Purpose

Define **ScheduleBlock** rows: **time window**, **time class** (`COMMITTED`, `PLANNED`, `REQUESTED`, `SUGGESTED` per v2 precedent), optional links to **`jobId`**, **`flowId`**, **`taskId`**, **supersede** history — and **ScheduleChangeRequest** workflow if product ships **crew requests**.

## 3. Why this exists

Persists **planning intent** with enough structure for a **future** **COMMITTED** enforcement phase (`01`) without lying today.

## 4. Canon alignment

- **Only COMMITTED** may ever gate start in future phase (`01`); **others** never hard gate MVP.

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Dispatcher** | Create/edit **PLANNED/COMMITTED** per policy. |
| **Field** | Create **REQUESTED**; cannot mark **COMMITTED** unless role (59). |

## 6. Primary object(s) affected

- **ScheduleBlock** (`startsAt`, `endsAt`, `timeClass`, `jobId?`, `flowId?`, `taskId?`, `assignedUserIds[]`, `supersededAt?`).
- **ScheduleChangeRequest** optional (`requestedBy`, `status`).

## 7. Where it lives in the product

- **Calendar** (45); **Job** schedule strip; **Task** **Plan** tab showing **intent** times.

## 8. Create flow

1. User selects slot → **Create block**.
2. Pick **time class** with **help text** explaining **MVP** non-enforcement except future **COMMITTED** (`01`).
3. Link to **job** and optionally **task** (`taskId` = **effective** id + kind metadata — mirror `02` decision patterns).
4. Save → visible on calendars.

## 9. Read / list / detail behavior

- **List** upcoming blocks for a user; **conflicts** highlighted **informational** (“double-booked”) — **no** hard prevention MVP.

## 10. Edit behavior

- **Drag** resize/move updates row; **append-only** history via `supersededAt` new row (v2 pattern) — **product choice**: **either** mutate with audit **or** supersede chain — **pick one**; default **supersede chain** for **compliance**.

## 11. Archive behavior

- **Cancel** block: `status=cancelled` or supersede with zero-length — define **one**; prefer **`cancelledAt`**.

## 12. Delete behavior

- **Hard delete** forbidden if referenced in **audit**; **cancel** only.

## 13. Restore behavior

- **Uncancel** admin within 24h optional.

## 14. Required fields

`startsAt`, `endsAt`, `timeClass`, `tenantId`.

## 15. Optional fields

`title`, `notes`, `color`.

## 16. Field definitions and validations

- `endsAt > startsAt`; **max duration** per tenant (e.g. 14 days) to prevent mistakes.

## 17. Status / lifecycle rules

`active` | `cancelled` | `superseded`.

## 18. Search / filter / sort behavior

- Filter by **time class**, **job**, **user**; sort by start time.

## 19. Relationships to other objects

- **Job**, **Flow**, **Runtime/Skeleton task** intent reference (metadata).

## 20. Permissions / visibility

- Users see **own** blocks + **team** if manager.

## 21. Mobile behavior

- **Create REQUESTED** block from mobile; **photo** optional.

## 22. Notifications / side effects

- **Request** approvals notify manager (56).

## 23. Audit / history requirements

- Log create/cancel/move with **before/after** times.

## 24. Edge cases

- **DST** transitions: use tenant timezone rules (`01`).

## 25. What must not happen

- **PLANNED** blocks blocking **start** in MVP (`1`).

## 26. Out of scope

- **Route optimization** / **travel time**.

## 27. Open questions

- **O6** if Phase C: **ScheduleBlock** vs **RuntimeTask schedule fields** precedence — **conditional** on Phase C (`01`, canon O6).
