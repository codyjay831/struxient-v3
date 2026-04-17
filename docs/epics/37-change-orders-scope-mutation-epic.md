# Epic 37 — Change orders (scope mutation)

## 1. Epic title

Change orders (scope mutation)

## 2. Purpose

Define **change orders** as **post-activation** **scope deltas** (add/remove/supersede manifest work, optional commercial adjustments) with **audit** — **not** silent snapshot rewrites (`03`).

## 3. Why this exists

Sold work changes after **activation**; **detours** are insufficient when **commercial** or **manifest** sets change (`09` #11).

## 4. Canon alignment

- **CO** may touch **commercial + execution** policy (`03` table).
- **Learning** never silently overwrites freeze (`07`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Estimator / PM** | Author **CO draft**; submit approval if required. |
| **Customer** | Sign **CO** proposal (mirror quote sign subset) if commercial. |
| **System** | Apply **CO** package to **flow** with **new** runtime tasks / supersede. |

## 6. Primary object(s) affected

- **ChangeOrder** (`jobId`, `status`, `draftPackage`, `appliedAt`).
- **Runtime task** supersede links; optional **quoteVersion** link for **CO document**.

## 7. Where it lives in the product

- **Job** tab **Change orders**; **New CO** wizard.

## 8. Create flow

1. Start CO from job → describe **reason**.
2. Add **lines** (new packet lines) or **remove** tasks (select runtime tasks to supersede) per **permissions**.
3. **Recompose** mini **package delta** against **same pinned template** or **policy** if template update disallowed.
4. **Customer sign** if **price** changes.
5. **Apply** → transactional: create new runtime tasks, mark **superseded**, update **payment gate targets** if needed (`02` open).

## 9. Read / list / detail behavior

- CO list with status; detail shows **diff** table **before/after**.

## 10. Edit behavior

- **Draft** editable; **submitted** locked; **applied** immutable.

## 11. Archive behavior

- **Void draft** CO.

## 12. Delete behavior

- Delete **draft** only.

## 13. Restore behavior

- **Restore voided draft** admin-only within 24h — optional.

## 14. Required fields

`jobId`, `reason`, `createdBy`.

## 15. Optional fields

`customerSignedAt`, `linkedQuoteVersionId` (CO as mini-quote).

## 16. Field definitions and validations

- **Apply** must **fail** if **payment gates** would reference **removed** tasks without **update** — **block** with checklist (`02`).

## 17. Status / lifecycle rules

`draft` | `pending_customer` | `ready_to_apply` | `applied` | `void`.

## 18. Search / filter / sort behavior

- Job filter **has pending CO**; sort `updatedAt`.

## 19. Relationships to other objects

- **Job**, **Flow**, **Runtime tasks**, **Payment gates**, optional **Quote version** for CO doc.

## 20. Permissions / visibility

- **co.author**, **co.apply**; customer sees **their** pending CO portal.

## 21. Mobile behavior

- **Read-only** CO status; **sign** if portal mobile.

## 22. Notifications / side effects

- Notify customer to sign; notify crew when **applied** (56).

## 23. Audit / history requirements

- **Full** diff audit on apply.

## 24. Edge cases

- **Concurrent** CO drafts: **block** second or **merge** — default **warn** and block apply until resolved.

## 25. What must not happen

- **Silent** snapshot rewrite of **original** signed quote (`3`).
- Using **detour** for **true** scope removal (`9`).

## 26. Out of scope

- **Accounting** revenue recognition rules.

## 27. Open questions

- **CO ALL/ANY** gate retargeting defaults (`02`).
