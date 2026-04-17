# Epic 32 — Execution package

## 1. Epic title

Execution package

## 2. Purpose

Define **execution package** as the **node-aligned freeze artifact** merging **plan tasks** into **pinned process template skeleton**: **package task slots** with **source classification** (sold scope vs skeleton vs manual) and **compose-time errors/warnings** (`02`, `03`, `09` #12).

## 3. Why this exists

**Activation** requires a **launch contract** (`02`); **honest** compose messaging prevents silent reroutes (`9`).

## 4. Canon alignment

- **Execution package ≠ scope packet** naming (`05`, `9` #2).
- **Stable node identity** for placement (`06`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Estimator** | Acknowledges **warnings** at send (12). |
| **System** | Composes at send. |

## 6. Primary object(s) affected

- **ExecutionPackage** (`workflowVersionId`, `nodes[]` each with `slots[]`: `packageTaskId`, `nodeId`, `source`, `planTaskId?`, `skeletonTaskId?`, `warnings[]`, `errors[]`).

## 7. Where it lives in the product

- **Send modal** compose summary; **support** tooling page.

## 8. Create flow

- Triggered in **send pipeline** after plan finalization (31): `composeExecutionPackage(plan, workflowSnapshot)`.
- Persist **errors** (blocking) and **warnings** (ack) in package JSON.

## 9. Read / list / detail behavior

- **Per-node** accordion with slots; **color** error/warn icons; **link** to plan row.

## 10. Edit behavior

- **Immutable** post-send; **new version** only.

## 11. Archive behavior

- N/A.

## 12. Delete behavior

- N/A.

## 13. Restore behavior

- N/A.

## 14. Required fields

Package: `workflowVersionId`, `composedAt`, `nodes` array.

## 15. Optional fields

`composeEngineVersion`.

## 16. Field definitions and validations

- **Error** if **plan task** references **unknown node** in snapshot — **block** send.
- **Warning** if **fallback node** used — must **surface** (`9` #12).

## 17. Status / lifecycle rules

Tied to **sent** quote version; **superseded** when new version sent.

## 18. Search / filter / sort behavior

- Internal diagnostics filters only.

## 19. Relationships to other objects

- **Activation** reads package (33); **runtime tasks** created for **manifest** slots only (`03`).

## 20. Permissions / visibility

- Office/support; **not** customer portal.

## 21. Mobile behavior

- Not shown.

## 22. Notifications / side effects

- If compose **errors**, **block** send event (12).

## 23. Audit / history requirements

- Store **full** package or hash + store in cold storage per policy.

## 24. Edge cases

- **Template mismatch** mid-draft: **recompose** preview stale indicator.

## 25. What must not happen

- **Silent reroute** (`9` #12).
- Calling package **packet** (`9` #2).

## 26. Out of scope

- **Multi-flow** package fan-out (O2).

## 27. Open questions

- **Warning taxonomy** standardization for analytics.
