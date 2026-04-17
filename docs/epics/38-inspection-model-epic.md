# Epic 38 — Inspection model (folded)

## 1. Epic title

Inspection model (folded into FlowSpec)

## 2. Purpose

Define **inspection** behavior for **v3-native jobs** per **`03-inspection-model-decision`**: **no parallel InspectionCheckpoint progression truth**; **pass/fail gating** through **tasks + outcomes + evidence + detours**; **packet checkpoint definitions** materialize as **manifest** executable units on correct **node** at **freeze/activation**.

## 3. Why this exists

v2 **dual** inspection state caused drift (`03` decision rationale); v3 needs **one** progression story.

## 4. Canon alignment

- **Scope packet** may carry **checkpoint defs** (15); **plan/package** includes them as tasks (`31`, `32`).
- **FAIL** paths use **detours** (28) default (`03`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Catalog author** | Define checkpoint defs on packet (15). |
| **Field** | Execute **inspection tasks** like any runtime task (41). |
| **Inspector role** | Optional **permission** to **sign off** specific outcomes (59). |

## 6. Primary object(s) affected

- **No new v3 table** for checkpoint truth — uses **RuntimeTask** / **SkeletonTask** rows with `category=INSPECTION` flag.
- **Legacy InspectionCheckpoint** **read-only** for migration window (`03`).

## 7. Where it lives in the product

- **Node board** shows inspection tasks under **INSPECTION** node or tagged section.
- **Reporting** filters `taskCategory=INSPECTION`.

## 8. Create flow

- **Freeze** expands checkpoint defs → **plan rows** with stable ids (`31`).
- **Activation** creates **runtime instances** (`33`).

## 9. Read / list / detail behavior

- **Inspection dashboard** = filtered **effective** task list (36) + **evidence** completeness (42).

## 10. Edit behavior

- **Same** as runtime tasks pre-start; **post-pass** locked except **admin correction** with audit.

## 11. Archive behavior

- Superseded by CO (37) like other tasks.

## 12. Delete behavior

- No ad-hoc delete post-activation.

## 13. Restore behavior

- Via CO rollback policy.

## 14. Required fields

On **checkpoint-derived** tasks: `checkpointDefId` provenance optional but **recommended** for reporting.

## 15. Optional fields

`authorityJurisdiction`, `permitNumber` on structured inputs (18).

## 16. Field definitions and validations

- **Outcomes** limited to template-defined keys (`26`).

## 17. Status / lifecycle rules

Follow **TaskExecution** outcomes; **no second** `LOCKED/PASS` enum elsewhere.

## 18. Search / filter / sort behavior

- Filter jobs by **failed inspection tasks** open.

## 19. Relationships to other objects

- **Packet** defs → **plan** → **runtime**; **DetourRecord** on fail.

## 20. Permissions / visibility

- **inspect.signoff** optional role; **customer** sees **portal** summary only if product enables.

## 21. Mobile behavior

- **Offline** evidence queue (43); **start** still server-gated if policy requires.

## 22. Notifications / side effects

- Notify office on **FAIL** outcome (56).

## 23. Audit / history requirements

- **Outcome changes** via TaskExecution audit (57).

## 24. Edge cases

- **Informational** inspection (non-gating): mark task **non-required** in completion rule (`27`, `03` open subquestion).

## 25. What must not happen

- **New** parallel inspection state machine for v3-native (`03` #8 forbids).
- **Workflow-only** inspection when **tier** should carry it (`03`).

## 26. Out of scope

- **Legacy dual-read** migration implementation details — engineering migration epic.

## 27. Open questions

- **One task per checkpoint** vs **checklist sub-items** (`03` UX subquestion).
