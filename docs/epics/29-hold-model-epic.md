# Epic 29 — Hold model

## 1. Epic title

Hold model

## 2. Purpose

Define **Hold** as **operational overlay** blocking **start** (or scoped starts) **without mutating** process or quote truth (`02`, `07`).

## 3. Why this exists

Permits, weather, RFIs, and **payment** pauses must **not** rewrite snapshots (`03`).

## 4. Canon alignment

- **Hold ≠ detour ≠ CO** (`03` table).
- **PAYMENT** hold links **`paymentGateId`** (`02` decision pack).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **PM / office** | Apply/release **generic** holds. |
| **Finance** | Link **payment** holds to gates (48). |
| **Field** | View active holds on job.

## 6. Primary object(s) affected

- **Hold** (`flowId`, `type`, `taskId` optional effective id, `paymentGateId` optional, `reason`, `activeFrom`, `releasedAt`, `releasedBy`).

## 7. Where it lives in the product

- **Job ops** panel “Holds”; **banner** on work feed (39).

## 8. Create flow

1. **Apply hold** → pick `HoldType` enum subset for MVP (`09` O9 narrowed by tenant config 60): `PERMIT`, `WEATHER`, `RFI`, `PAYMENT`, `CUSTOM`.
2. Optional **scope**: whole flow vs **specific effective task id** (`taskId`).
3. For `PAYMENT`, pick **PaymentGate** (47) → sets `paymentGateId`.
4. Save → **active** until released.

## 9. Read / list / detail behavior

- List active holds first; history collapsible.

## 10. Edit behavior

- **Reason** editable while active (audit); **type** immutable after create.

## 11. Archive behavior

- Released holds move to **history**; not deleted.

## 12. Delete behavior

- **No delete** of active hold; **release** only.

## 13. Restore behavior

- **Re-apply** simulates new hold row; do not un-delete old.

## 14. Required fields

`flowId`, `type`, `reason`, `createdBy`.

## 15. Optional fields

`taskId`, `paymentGateId`, `expectedReleaseAt`.

## 16. Field definitions and validations

- If `type=PAYMENT`, `paymentGateId` required unless product allows **generic** payment hold without gate — **default require** gate for traceability (`02`).

## 17. Status / lifecycle rules

`active` → `released`.

## 18. Search / filter / sort behavior

- Filter jobs by **active hold type**; report **aging**.

## 19. Relationships to other objects

- **Flow**; **PaymentGate**; **Start eligibility** (30).

## 20. Permissions / visibility

- **hold.apply**, **hold.release** permissions; field **read**.

## 21. Mobile behavior

- Read-only **hold banner**; **cannot release** unless role (default office only).

## 22. Notifications / side effects

- Notify crew when **release** (56).

## 23. Audit / history requirements

- Apply/release with actor, timestamps, optional notes.

## 24. Edge cases

- **Duplicate** active holds same type: **allowed** or **blocked** — default **allowed** with **merge suggestion** UI.

## 25. What must not happen

- **Hold** editing **snapshot** tasks (`02`).

## 26. Out of scope

- **Automatic weather** API integration.

## 27. Open questions

- **O9** exact `HoldType` MVP list — tenant config in epic 60.
