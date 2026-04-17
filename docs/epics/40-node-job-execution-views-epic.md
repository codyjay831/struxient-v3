# Epic 40 — Node and job execution views

## 1. Epic title

Node and job execution views

## 2. Purpose

Define **job-level** and **node-level** **boards** showing **stage progress**, **completion rules** (27), **detours** (28), and **task lists** — the **spatial** mental model for **FlowSpec**.

## 3. Why this exists

PMs and leads navigate **where** the job is in the **process**, not only a flat feed (39).

## 4. Canon alignment

- **Node ≠ line item** (`06`, `9`).
- **Progress** formula single for v3-native (`9` #8) — board pulls **same** engine metrics as dashboards.

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **PM / lead** | View all nodes; **open detour** (28). |
| **Field** | Focus on **current** node + allowed adjacent per policy (read-only peek). |

## 6. Primary object(s) affected

- **View composition** only.

## 7. Where it lives in the product

- **Job** → **Flow** tab **Board** layout; optional **timeline** toggle.

## 8. Create flow

N/A.

## 9. Read / list / detail behavior

- **Kanban columns** = nodes in **topological** order; **column header** shows **completion** state (not started / in progress / complete).
- **Tap column** expands **effective tasks** (36).
- **Badges:** active **hold**, **payment**, **detour** on affected columns.

**Empty job:** not applicable post-activation.

## 10. Edit behavior

- **Drag tasks between nodes** — **forbidden** for v3-native (would violate placement truth); **CO** only path (`37`).

## 11. Archive behavior

N/A.

## 12. Delete behavior

N/A.

## 13. Restore behavior

N/A.

## 14. Required fields

N/A.

## 15. Optional fields

User UI prefs: `boardZoom`.

## 16. Field definitions and validations

- **Column order** derived from **snapshot**, not free-form user sort.

## 17. Status / lifecycle rules

**Node column state** computed from **completion rule** + **task executions**.

## 18. Search / filter / sort behavior

- **Find task** spotlight searches across nodes; highlights column.

## 19. Relationships to other objects

- **Snapshot**, **Flow**, **Detours**, **Holds**.

## 20. Permissions / visibility

- Same as job view.

## 21. Mobile behavior

- **Horizontal swipe** columns; **compact** list mode toggle.

## 22. Notifications / side effects

- Optional **node complete** celebration (56).

## 23. Audit / history requirements

- None for view; **node complete** events audited via executions.

## 24. Edge cases

- **Wide graphs:** **mini-map** navigation control.

## 25. What must not happen

- **Implying** node movement changes **sold scope**.

## 26. Out of scope

- **Auto-layout** graph editor for runtime (that's template author).

## 27. Open questions

- Whether **future** nodes are **visible** to field or **blurred** until unlocked — tenant policy.
