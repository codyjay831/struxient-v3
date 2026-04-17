# Epic 47 — Payment gates

## 1. Epic title

Payment gates

## 2. Purpose

Define **PaymentGate** as **job-scoped** (or flow-scoped in future) **money milestones** that **block task start** for **explicit executable targets** using **`skeletonTaskId` and/or `runtimeTaskId`** per **`02-payment-hold-task-id-mapping-decision`** — **no** string name bridge (`09` #6).

## 3. Why this exists

Trades collect **deposits/progress draws** tied to **specific** work unlocks; mapping must match **engine** ids (`02`).

## 4. Canon alignment

- **Ban** JobTask bridges (`9` #5, `02`).
- **Holds** integrate via `paymentGateId` (`02`, epic 29/48).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Finance** | Configure **gate templates** per job type; **record payments** external or integrated. |
| **PM** | View **blocked** tasks due to gates. |

## 6. Primary object(s) affected

- **PaymentGate** (`jobId`, `name`, `amountDue`, `currency`, `status`, `satisfactionRule` placeholder for ALL/ANY open).
- **PaymentGateTarget** rows: **`targetKind` SKELETON|RUNTIME**, **`taskId`**, **`flowId`** (implicit from job active flow MVP).

## 7. Where it lives in the product

- **Job** → **Money** tab **Gates**; **task** tooltip shows **locked by Payment: {gate}**.

## 8. Create flow

1. **Add gate** on job (post job shell — typically post sign per `04`).
2. Enter **name**, **amount**, **due policy** (fixed date vs milestone).
3. **Attach targets** by **picking tasks** from **effective** list (36) with **explicit** kind+id.
4. **Pre-activation** issue (`02` open): if targets need **runtime ids** that do not exist yet, **either**:
   - **Defer gate creation** until after activation, **or**
   - Use **skeleton-only** targets for pre-mobilize deposits, **or**
   - **Node-level** coarse policy (explicitly documented if chosen) — **must pick** one per tenant **GTM**; **default:** **create payment gates after activation** for **runtime**-scoped work; allow **skeleton-only** for **job start** checklist tasks.

## 9. Read / list / detail behavior

- **Gates list:** columns **Name**, **Amount due**, **Amount paid**, **Status** (`open` / `satisfied` / `void`), **Due** (if set), **Targets** count. **Partial** supported when product allows **multiple payments** toward one gate (epic 48).
- **Detail drawer:** lists **PaymentGateTarget** rows with **human labels** resolved from the **effective task** projection (36), showing **kind** (`SKELETON` | `RUNTIME`) and **stable task id** (copyable for support).
- **Satisfaction vs blocking (normative):**
  - A gate becomes **`satisfied`** when **finance records enough payment** against that gate per tenant **satisfaction policy** (amount thresholds — see epic 48). **Task completion does not satisfy money gates** by default.
  - While **`open`** and **unsatisfied**, **start eligibility** (30) returns **blocked** for **Start** on each **listed target task** via the same **payment block** composition as `getPaymentBlockForFlowSpecTask` (`02`). **Default scope:** only **explicit targets** are blocked (no implicit downstream expansion unless a separate tenant policy is added and documented).
- **Recording payment** transitions gate toward **`satisfied`**; linked **`PAYMENT` hold** (if used) is **released** (48).
- **Multi-target gates:** until **`02` ALL vs ANY** is closed, **UI must show** which targets are listed and **which payment rule** applies (copy: “All listed work is payment-gated” vs “Any one listed milestone satisfies this gate”) — **no silent default** in shipped product; pick one per tenant template and **surface** it here.

## 10. Edit behavior

- **Targets** editable **until first payment** recorded; after, **admin-only** with **audit** and **warning** about **mis-gating**.

## 11. Archive behavior

- **Void gate** finance role; **releases** blocks; **audit**.

## 12. Delete behavior

- **No delete** if payments recorded; **void** only.

## 13. Restore behavior

- **Reopen voided gate** admin-only rare.

## 14. Required fields

`jobId`, `name`, `amountDue`, `currency`.

## 15. Optional fields

`dueAt`, `externalInvoiceId`.

## 16. Field definitions and validations

- Amount ≥0; **targets** must have **exactly one** id field populated per row (`02`).

## 17. Status / lifecycle rules

`open` | `satisfied` | `void`.

## 18. Search / filter / sort behavior

- Jobs filter **unpaid gate**; report **aging**.

## 19. Relationships to other objects

- **Job**, **Flow**, **Payment records**, **Hold** (48).

## 20. Permissions / visibility

- **finance.gates**; field sees **status** but not **bank** details if restricted.

## 21. Mobile behavior

- **Read-only** gate status on task block tooltip.

## 22. Notifications / side effects

- Notify finance when **task attempted** while blocked (optional) — **spam risk** — default **off**.

## 23. Audit / history requirements

- Gate lifecycle + target edits + payment applications.

## 24. Edge cases

- **CO supersedes** runtime task (`37`): **gate targets** must **update** or **auto-fail** build — **block** apply until resolved (`02`).

## 25. What must not happen

- **String** `(nodeName,taskName)` matching (`9` #6).

## 26. Out of scope

- **Merchant processing** integration depth — payments recording as **manual** or **plaid** stub.

## 27. Open questions

- **ALL vs ANY** multi-target satisfaction (`02`).
- **Pre-activation** deposit target strategy (`02`).
