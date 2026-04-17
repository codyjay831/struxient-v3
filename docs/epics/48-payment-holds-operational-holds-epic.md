# Epic 48 — Payment holds and operational holds (integration)

## 1. Epic title

Payment holds and operational holds

## 2. Purpose

Define how **`HoldType.PAYMENT`** **composes** with **PaymentGate** via `paymentGateId` and how **generic holds** coexist in **start eligibility** (30) — single **composition function** (`02` decision, v2 precedent).

## 3. Why this exists

Users need **one** explanation when blocked: **money vs permit vs weather** — without duplicate/conflicting overlays (`03`).

## 4. Canon alignment

- **Hold** blocks **start**, not graph truth (`02`).
- **Payment** mapping uses **executable ids** (`02`, `9`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Finance** | Record payment → auto-**satisfy** gate → auto-**release** linked **payment hold** if configured. |
| **PM** | Apply/release **non-payment** holds (29). |

## 6. Primary object(s) affected

- **Hold** (29), **PaymentGate** (47), **PaymentApplication** (recording).

## 7. Where it lives in the product

- **Job** **Blockers** summary panel aggregates **Holds + Unsatisfied Gates**.

## 8. Create flow

**Payment hold auto:**  
When gate created, optional toggle **“Also create active payment hold”** — default **on** for clarity (shows in hold list). **OR** implicit hold **virtual** — **pick one**; **recommend** **explicit** `Hold` row for **consistent** UI.

**On payment recorded:**  
1. Mark gate `satisfied`.  
2. **Release** linked `Hold` where `type=PAYMENT` and `paymentGateId` matches.  
3. **Eligibility** cache invalidate for affected tasks.

## 9. Read / list / detail behavior

- **Unified timeline** of **hold events** and **payment events** (could be 57).

## 10. Edit behavior

- **Hold release** always explicit with reason.

## 11. Archive behavior

- Released holds **archived** to history.

## 12. Delete behavior

- **No delete** active hold.

## 13. Restore behavior

- **Reopen** hold admin-only.

## 14. Required fields

For payment hold: `paymentGateId` required.

## 15. Optional fields

`autoCreated` boolean.

## 16. Field definitions and validations

- **Start eligibility** must query **both** `getGenericHoldBlock` and `getPaymentBlockForFlowSpecTask` **together** (`02`).

## 17. Status / lifecycle rules

Align with 29 and 47.

## 18. Search / filter / sort behavior

- Job filter **blocked by payment** vs **blocked by non-payment**.

## 19. Relationships to other objects

- **Flow**, **tasks**, **gates**, **payments**.

## 20. Permissions / visibility

- **finance.record_payment** vs **hold.apply** separation.

## 21. Mobile behavior

- **Read-only** blocker reasons on **Start** dialog.

## 22. Notifications / side effects

- When **gate satisfied**, notify **crew lead** “Work on {tasks} unblocked” (56).

## 23. Audit / history requirements

- Correlate **payment id** to **gate satisfaction** in audit.

## 24. Edge cases

- **Partial payments** — if supported, **hold** remains until **threshold** met; **UI** shows **remaining balance**.

## 25. What must not happen

- **Payment state** mutating **snapshot** (`03`).

## 26. Out of scope

- **Escrow** legal instruments.

## 27. Open questions

- **Partial payment** MVP or defer — finance GTM.
