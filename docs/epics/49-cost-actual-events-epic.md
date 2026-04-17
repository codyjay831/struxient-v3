# Epic 49 — Cost and actual events

## 1. Epic title

Cost and actual events

## 2. Purpose

Define **append-only cost / actual events** as **money observations** after the fact, **separate** from **quote price** and **packet estimates** (`02`, `07-time-cost-and-actuals-canon`).

## 3. Why this exists

Margin and **true job cost** require **layered** truth without overloading **line items** or **tasks** (`07` table).

## 4. Canon alignment

- **CostEvent** does **not** redefine **sold price** (`07`).
- **No single overloaded task row** for all truths (`07`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Finance / PM** | Record **actuals** against **job** or **task** context. |
| **Admin** | Configure **GL** mapping depth (60) — shallow MVP ok. |

## 6. Primary object(s) affected

- **CostEvent** (`jobId`, `amount`, `currency`, `category`, `occurredAt`, `vendor`, `memo`, optional `runtimeTaskId`/`skeletonTaskId` link, `source` enum `manual`, `import`).

## 7. Where it lives in the product

- **Job** → **Costs** tab; **task** detail **Costs** strip (read-only rollup).

## 8. Create flow

1. **Add cost** → amount, date, category, memo.
2. Optional link **task** for attribution.
3. Save → immutable event row (corrections via **reversing** event + link).

## 9. Read / list / detail behavior

- **Table** sortable by date, category, amount; **subtotals** by category.
- **Empty:** “No costs recorded — add material receipts or labor burden.”

## 10. Edit behavior

- **No edit** to posted event; **reverse** with **paired** negative event + reason.

## 11. Archive behavior

- **Void** event = reversing entry; **no hide** without audit.

## 12. Delete behavior

- **Hard delete** forbidden after **posting**; **draft** events deletable.

## 13. Restore behavior

- N/A.

## 14. Required fields

`jobId`, `amount`, `currency`, `occurredAt`, `category`, `createdBy`.

## 15. Optional fields

`vendor`, `invoiceFileId`, `taskRef`.

## 16. Field definitions and validations

- Amount can be **negative** only for **reversal** rows linked to `reversesEventId`.
- Currency must match **job** currency or **convert** with stored **FX rate** optional — **MVP:** single **tenant currency** only.

## 17. Status / lifecycle rules

`draft` | `posted`.

## 18. Search / filter / sort behavior

- Filter category, date range, **linked task**; export CSV.

## 19. Relationships to other objects

- **Job**, **Task** attribution optional, **File** invoice (06).

## 20. Permissions / visibility

- **cost.record**; field **no access** by default.

## 21. Mobile behavior

- **Quick capture** photo of receipt creates **draft** cost with attachment (optional).

## 22. Notifications / side effects

- Webhook `cost.posted` for accounting integrations.

## 23. Audit / history requirements

- Posting and reversals fully audited.

## 24. Edge cases

- **Duplicate** invoice upload hash: **warn**.

## 25. What must not happen

- **Silent** rewrite of **quote totals** from costs (`7`).

## 26. Out of scope

- **Full GL** subsystem (`O15`).

## 27. Open questions

- **O15** learning + GL governance depth.
