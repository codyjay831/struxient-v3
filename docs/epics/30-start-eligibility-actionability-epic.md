# Epic 30 — Start eligibility and actionability

## 1. Epic title

Start eligibility and actionability

## 2. Purpose

Define the **central** computation of whether an **executable task** (skeleton or runtime instance) may be **started**: composition of **flow state**, **node completion**, **holds**, **payment gates**, **detours**, **structured-input readiness** — and explicitly **excludes scheduling** as authority for **MVP** per **`01-scheduling-authority-decision`**.

## 3. Why this exists

**Split-brain** “UI says blocked but engine allows” was a v2 failure mode (`09` #7); v3 requires **one** eligibility story.

## 4. Canon alignment

- **`docs/decisions/01`:** MVP scheduling **non-authoritative**; UI must **not** imply calendar gates start.
- **Payment** uses **executable ids** (`02` decision pack).
- **Manifest tasks** do not alter **gate routing** (`09` #10).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Field** | Sees **why blocked** tooltip on **Start** button. |
| **Engine** | API enforces same rules as UI. |

## 6. Primary object(s) affected

- **EligibilityResult** (computed, cacheable): `{ canStart: boolean, reasons: Code[] }`.
- No separate persisted row required unless audit needs **snapshots** of denials (optional).

## 7. Where it lives in the product

- **Workstation** (39), **task detail** (41), **mobile** (43); **badge** on task rows.

## 8. Create flow

Not applicable — computation only.

## 9. Read / list / detail behavior

- **Reason codes** localized strings:
  - `HOLD_ACTIVE`, `PAYMENT_GATE_UNMET`, `NODE_NOT_READY`, `DETOUR_BLOCKS`, `STRUCTURED_INPUT_MISSING`, `TASK_ALREADY_COMPLETED`, `FLOW_COMPLETE`, `SCHEDULING_NOT_ENFORCED` (never blocking in MVP — **omit** from blocking set; **do not** show as block).

## 10. Edit behavior

- **Overrides:** admin **force start** flag per tenant **emergency** — **audited**, **rare**; default **disabled**.

## 11. Archive behavior

- Not applicable.

## 12. Delete behavior

- Not applicable.

## 13. Restore behavior

- Not applicable.

## 14. Required fields

N/A.

## 15. Optional fields

N/A.

## 16. Field definitions and validations

- **API** must return **same codes** as UI; **version** eligibility engine `schemaVersion` for migrations.

## 17. Status / lifecycle rules

N/A.

## 18. Search / filter / sort behavior

- Work feed filter **blocked vs actionable** (39).

## 19. Relationships to other objects

- Inputs from **Hold**, **PaymentGate**, **DetourRecord**, **CompletionRule**, **TaskExecution** state, **StructuredInputAnswer** phase.

## 20. Permissions / visibility

- **force_start** admin permission.

## 21. Mobile behavior

- Offline: **cannot start** if cannot verify server-side rules — **queue** or **block** with message (43).

## 22. Notifications / side effects

- Optional alert when task becomes **actionable** (56).

## 23. Audit / history requirements

- Log **admin force start** with reasons.

## 24. Edge cases

- **Race:** two crew start same task → **server** rejects second with `ALREADY_STARTED`.

## 25. What must not happen

- **Calendar** silently blocking in one client while API allows (`9` #7).
- **String-based** payment mapping (`9` #6).

## 26. Out of scope

- **Phase C** `enforceCommittedScheduleBlocks` — future flag from decision `01`.

## 27. Open questions

- **Granularity** when Phase C ships: task vs node — decision `01` subquestion.
