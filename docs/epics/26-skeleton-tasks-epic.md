# Epic 26 — Skeleton tasks

## 1. Epic title

Skeleton tasks

## 2. Purpose

Define **skeleton tasks**: **template-level** executable specs on **nodes** — **every job** using the template has them; distinct from **manifest runtime instances** (`04`).

## 3. Why this exists

**Structural discipline** (permits, job kickoff, standard milestones) must exist **regardless** of which **scope packet** sold (`06`).

## 4. Canon alignment

- **Executable** via **snapshot task id** on flow (`04`).
- **Not** for **trade BOM** replacement (`06`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Process author** | CRUD skeleton tasks on nodes. |
| **Field** | Execute on workstation (39–41). |

## 6. Primary object(s) affected

- **SkeletonTask** (`id`, `nodeId`, `name`, `instructions`, `outcomes[]`, `checklistItems[]`, optional estimates).

## 7. Where it lives in the product

- **Node inspector** “Template tasks” tab.

## 8. Create flow

1. Add skeleton task under node → name required.
2. Define **outcomes** for routing (`pass`, `fail`, `na`) as allowed keys.
3. Optional **checklist** embedded (see open question inspection UX `03`).

## 9. Read / list / detail behavior

- Ordered list per node; drag reorder **draft** only.

## 10. Edit behavior

- Draft only; **id** immutable at publish.

## 11. Archive behavior

- Remove from draft.

## 12. Delete behavior

- Remove; warn if **gates** reference its outcomes.

## 13. Restore behavior

- Undo.

## 14. Required fields

`id`, `nodeId`, `name`.

## 15. Optional fields

`instructions`, `estimatedMinutes`, `evidenceRequired`.

## 16. Field definitions and validations

- Name max 200; **unique** `id` per snapshot.

## 17. Status / lifecycle rules

Lives in **published snapshot**; runtime **TaskExecution** references `taskId = skeleton id` (`04`).

## 18. Search / filter / sort behavior

- Search tasks by name in template.

## 19. Relationships to other objects

- **Payment gate targets** may reference `skeletonTaskId` (`02` decision pack).

## 20. Permissions / visibility

- Process author; field sees **effective** tasks (36).

## 21. Mobile behavior

- Appears in **node work list** (40).

## 22. Notifications / side effects

- None.

## 23. Audit / history requirements

- Template publish.

## 24. Edge cases

- **Rename** task display: **snapshot** keeps id; **UI** label can change in **new** version only.

## 25. What must not happen

- **JobTask** new dependencies (`09`).

## 26. Out of scope

- **Per-job** skeleton edits (default ban `06`).

## 27. Open questions

- **Checklist** model vs separate tasks for inspection steps (`03` subquestion).
