# Epic 41 — Runtime task execution UX

## 1. Epic title

Runtime task execution UX

## 2. Purpose

Define **task detail** experience for **starting**, **pausing** (if allowed), **completing**, **failing**, **outcomes**, **checklists**, and **linking evidence** for both **skeleton** and **runtime** tasks — backed by **TaskExecution** append-only truth (`03`, `04`).

## 3. Why this exists

**Execution** is the core **field** transaction; ambiguous UX creates **bad execution data** and **payment** disputes.

## 4. Canon alignment

- **Actual duration** from **execution timestamps**, not quote (`07`).
- **Outcome** drives **detour** / **routing** where applicable (`25`, `28`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Field** | Start/complete with evidence when required (42). |
| **QC** | Add **secondary** sign-off if template requires two-person rule (59). |

## 6. Primary object(s) affected

- **TaskExecution** rows (`taskId`, `kind`, `startedAt`, `completedAt`, `outcome`, `notes`, `actorUserId`).
- UI **state machine** mirrors server.

## 7. Where it lives in the product

- **Modal** or **full page** `/jobs/:jobId/tasks/:taskId` unified for skeleton/runtime (kind badge).

## 8. Create flow

**Start:**  
1. Tap **Start** → eligibility check (30).  
2. On success, server writes **start** execution event; UI timer begins (display only; server authoritative).  

**Complete:**  
1. Fill **required checklist** items.  
2. Select **outcome** if template provides multiple.  
3. Attach **evidence** if `evidenceRequired`.  
4. Submit → **complete** event; UI shows **immutable** summary card.

## 9. Read / list / detail behavior

- **History** tab lists **execution events** chronologically (append-only).
- **Instructions** panel shows **merged** text from packet/runtime materialization.

## 10. Edit behavior

- **Notes** on **active** execution editable until **complete** — policy: **append-only notes** recommended; if editable, audit each change.
- **Outcome** change after complete: **admin-only** **reversal** flow with **reason** (rare).

## 11. Archive behavior

N/A for executions; **cancel** creates **cancel** event.

## 12. Delete behavior

- **No delete** of execution events; **support reversal** adds **correcting** entry (double-entry style).

## 13. Restore behavior

N/A.

## 14. Required fields

On complete: `outcome` if defined; `completedAt` server.

## 15. Optional fields

`laborMinutes` entry **for observation** only — does **not** override timestamps as truth unless product explicitly uses as **correction** (default **no**; use epic 50).

## 16. Field definitions and validations

- **Evidence required** gate blocks **complete** with inline list of missing items.

## 17. Status / lifecycle rules

Task **state** derived: `not_started` → `in_progress` → `completed` | `failed` | `cancelled`.

## 18. Search / filter / sort behavior

N/A on detail; **job** views filter by task state.

## 19. Relationships to other objects

- **Evidence files** (42); **Structured inputs** at execution phase (18); **Payment gates** may watch **certain** completions (`47`).

## 20. Permissions / visibility

- **task.execute**; **QC** second signature permission.

## 21. Mobile behavior

- **Large touch targets**; **offline start queue** — **dangerous** — default **block** until online unless 43 defines **safe** queue rules.

## 22. Notifications / side effects

- Webhook `task.completed` with **ids** explicit (`02`).

## 23. Audit / history requirements

- **Immutable** execution event log; visible on task detail.

## 24. Edge cases

- **Double start:** server rejects; UI refreshes state.
- **Long-running** task **multi-day:** **pause** not standard — use **complete** daily chunks only if product adds **time segments** (out of scope).

## 25. What must not happen

- **AI** streaming into **TaskExecution** (`8`).
- **Client clock** setting **official** timestamps without server.

## 26. Out of scope

- **Wearables** integration.

## 27. Open questions

- **Reversal** UX depth — legal + support policy.
