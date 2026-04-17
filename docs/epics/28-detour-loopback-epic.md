# Epic 28 — Detours and loopbacks

## 1. Epic title

Detours and loopbacks

## 2. Purpose

Define **DetourRecord** **runtime** obstruction + **resume** **without** editing **published** snapshot (`06`), and UX distinction from **static DETOUR node** (`09`, `20` O20).

## 3. Why this exists

**AHJ failures** and **rework** need **honest** correction paths; **detours** must not become **scope edits** (`09` #11).

## 4. Canon alignment

- **Detour ≠ change order** for sold scope (`09`).
- **Dynamic detour** vs **static DETOUR node** both exist (`06`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Field lead / PM** | Open detour from **failed** task outcome. |
| **Admin** | Close/cancel detour; **override** policy rare. |

## 6. Primary object(s) affected

- **DetourRecord** (`flowId`, `reason`, `blockingNodeIds[]`, `resumePolicy`, `openedBy`, `closedAt`).

## 7. Where it lives in the product

- **Task outcome** dialog “Start rework loop”; **Flow timeline** banner.

## 8. Create flow

1. User completes task with **FAIL** outcome (or manual **Open detour** if policy allows).
2. Select **reason** enum (`inspection_fail`, `damage`, `design_error`, `other`) + notes.
3. System proposes **blocked nodes** set per engine rules; user confirms.
4. Detour **active** → downstream **start eligibility** blocked per `30`.

## 9. Read / list / detail behavior

- **Detours** tab on job: list open/closed; detail shows **graph highlight**.

## 10. Edit behavior

- **Notes** append-only; **blocking set** change **admin** only with audit.

## 11. Archive behavior

- Closed detours **archived** from **active** list but remain in history.

## 12. Delete behavior

- **No delete**; **cancel** with reason adds audit entry.

## 13. Restore behavior

- **Reopen** closed detour admin-only with guard.

## 14. Required fields

`flowId`, `reason`, `openedAt`, `openedBy`.

## 15. Optional fields

`relatedTaskId` (effective id), `evidenceFileIds[]`.

## 16. Field definitions and validations

- Reason notes max 2000 chars.

## 17. Status / lifecycle rules

`open` → `resolved` | `cancelled`.

## 18. Search / filter / sort behavior

- Job filter **has open detour**; sort by opened date.

## 19. Relationships to other objects

- **Flow**; **TaskExecution** outcomes; **not** quote lines.

## 20. Permissions / visibility

- **detour.open** role; field sees on **assigned** jobs.

## 21. Mobile behavior

- **Open/resolve** detour with **photo** evidence (42).

## 22. Notifications / side effects

- Notify PM when detour opened/resolved (56).

## 23. Audit / history requirements

- Full lifecycle logged.

## 24. Edge cases

- **Nested detours:** allowed with **stack** display; **resolve** inner first policy.

## 25. What must not happen

- **Detour** to **change sold line items** (`9`).

## 26. Out of scope

- **Customer-facing** detour explanations (portal) unless product adds.

## 27. Open questions

- **O20** labels for static vs dynamic detour in customer PDFs/training.
