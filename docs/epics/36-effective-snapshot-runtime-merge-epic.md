# Epic 36 — Effective snapshot and runtime merge

## 1. Epic title

Effective snapshot and runtime merge

## 2. Purpose

Define how the **UI and APIs** present **merged** **skeleton tasks** (from **pinned workflow snapshot**) with **runtime task instances** into a single **effective work projection** while **preserving routing isolation** for the engine (`04`, v2 `effective-snapshot` precedent, `09` #10).

## 3. Why this exists

Field users need **one list** per node; engineers must not **conflate** identities.

## 4. Canon alignment

- **Distinct ids** always (`04` banned loose "task").
- **Routing** uses **snapshot** rules; **overlay** for **actionability** only (`9` #10).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Field / PM** | Consume merged views. |
| **Integrations** | Read **effective** API with **explicit** id kinds in payload. |

## 6. Primary object(s) affected

- **EffectiveTaskProjection** DTO (`kind: SKELETON | RUNTIME`, `taskId`, `nodeId`, `display`, `eligibility`, `executionSummary`).

## 7. Where it lives in the product

- All **execution** lists (39–41, 43).

## 8. Create flow

Not applicable — computed on read with caching.

## 9. Read / list / detail behavior

- **Badges:** `Template` vs `Sold work` labels on rows.
- **Detail** shows **underlying** ids in **developer/support** panel (toggle).

## 10. Edit behavior

- **No direct** edit of projection; edits target **underlying** objects.

## 11. Archive behavior

- Not applicable.

## 12. Delete behavior

- Not applicable.

## 13. Restore behavior

- Not applicable.

## 14. Required fields

Each projected row: `kind`, `taskId`, `nodeId`.

## 15. Optional fields

`planProvenance`, `lineItemLabel`.

## 16. Field definitions and validations

- API schema **must** use **`skeletonTaskId` vs `runtimeTaskId`** fields or **`executableTaskId` + `executableTaskKind`** (`02` decision).

## 17. Status / lifecycle rules

Projection **ephemeral**; **no** persisted status.

## 18. Search / filter / sort behavior

- Filters apply to **merged** list; **kind** filter toggles.

## 19. Relationships to other objects

- Inputs: **snapshot**, **runtime tasks**, **TaskExecution**, **detours**, **holds** (for eligibility display).

## 20. Permissions / visibility

- Same as underlying tasks.

## 21. Mobile behavior

- **Same** merge rules as desktop; **offline** shows last synced projection with **stale** banner.

## 22. Notifications / side effects

- None.

## 23. Audit / history requirements

- **No** audit of projection reads; audit **underlying** changes.

## 24. Edge cases

- **Duplicate display names:** disambiguate with **line label** suffix.

## 25. What must not happen

- **Collapsed** `taskId` without kind in **public** API (`4`, `9`).

## 26. Out of scope

- **GraphQL** specific shapes — any API ok if explicit.

## 27. Open questions

- **Caching TTL** and **invalidation** events for large jobs — engineering performance.
