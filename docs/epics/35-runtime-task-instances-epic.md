# Epic 35 — Runtime task instances

## 1. Epic title

Runtime task instances

## 2. Purpose

Define **runtime task instance** as **flow-scoped** materialized work for **manifest** plan/package tasks on a **node**, with **provenance** to **line/packet** where applicable (`02`, `03`, `04`).

## 3. Why this exists

Crews execute **sold scope** as **instances** separate from **skeleton** template tasks (`04`).

## 4. Canon alignment

- **Does not** drive **gate routing** incorrectly (`9` #10).
- **Append-only execution truth** on **TaskExecution**, not on instance row beyond **materialized metadata** (`03`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Field** | Start/complete per eligibility (30). |
| **PM** | **Inject** ad-hoc runtime tasks if policy allows (non-routing-breaking) (`03`). |

## 6. Primary object(s) affected

- **RuntimeTask** (`id`, `flowId`, `nodeId`, `name`, `instructions`, `source`, `planTaskId?`, `lineItemId?`, `evidenceFlags`, `schedule fields` as intent only per `07`).

## 7. Where it lives in the product

- **Node board** (40), **work feed** (39), **task detail** (41).

## 8. Create flow

- **Primary:** **activation** from package (`33`).
- **Secondary:** **PM inject** dialog: name, node, **reason**, **non-routing** attestation checkbox; audit.

## 9. Read / list / detail behavior

- List by **node** and **actionable** filter (30).
- Detail shows **provenance**, **evidence**, **execution history** (TaskExecution).

## 10. Edit behavior

- **Instructions overlay** editable by office **pre-start** only; **post-start** **correction** via **structured input correction** policy (`03`) — link epic 37.

## 11. Archive behavior

- **Superseded** by CO: instance marked `superseded` with pointer to replacement (`37`).

## 12. Delete behavior

- **No delete** after **start**; **void** requires admin with **compensating** execution entries.

## 13. Restore behavior

- **Un-supersede** only via CO rollback policy — rare.

## 14. Required fields

`flowId`, `nodeId`, `displayName`, `source`.

## 15. Optional fields

`planTaskId`, `lineItemId`, `estimatedMinutes` snapshot.

## 16. Field definitions and validations

- **Schedule fields** labeled **intent not execution truth** in UI (`07`, decision `01`).

## 17. Status / lifecycle rules

`not_started` | `in_progress` | `completed` | `failed` | `cancelled` | `superseded` — derived primarily from **TaskExecution**; instance row may cache for list performance **but** engine uses truth tables.

## 18. Search / filter / sort behavior

- Filter **by node**, **by line item**, **by actionable**; sort by **node order** then **priority**.

## 19. Relationships to other objects

- **TaskExecution** 1—* ; **Evidence files** (42); **PaymentGate targets** may reference `runtimeTaskId` (`02`).

## 20. Permissions / visibility

- Field: assigned crew policies (59); **start/complete** permissions (O13 — epic 59 default **tenant member**).

## 21. Mobile behavior

- Full **start/complete** UX (43).

## 22. Notifications / side effects

- Webhook `runtime_task.completed`.

## 23. Audit / history requirements

- Creation, injection, supersession, **instruction edits** pre-start.

## 24. Edge cases

- **CO removes line:** supersede instances; **gate targets** update (`02` open).

## 25. What must not happen

- **JobTask** new usage (`9` #5).
- **Manifest** completion **changing** gate logic silently (`9` #10).

## 26. Out of scope

- **InstallItem** anchor (O4).

## 27. Open questions

- **O13** fine-grained task ACL matrix vs tenant-wide.
