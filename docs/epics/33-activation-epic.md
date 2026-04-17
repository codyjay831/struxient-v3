# Epic 33 — Activation

## 1. Epic title

Activation

## 2. Purpose

Define **activation** as the **idempotent bridge** from **signed (or policy-ready) quote version** with **valid freeze** to **flow** pinned to **workflow snapshot**, **runtime task instances** for **manifest** package tasks, **parallel artifacts** per model, and **audit** (`03`, `02`).

## 3. Why this exists

**Field execution** begins here; botched activation **duplicates** work or **breaks** payment mapping.

## 4. Canon alignment

- **Does not duplicate** skeleton tasks as manifest runtime (`03`).
- **Idempotent**; **unique** activation per quote version (`02` precedent).
- **Inspection** folded: **no** new `InspectionCheckpoint` rows for v3-native (`03` decision).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **PM / office** | Trigger **Activate** if policy allows manual trigger; else **auto** on sign (product). |
| **System** | Performs activation transaction. |

## 6. Primary object(s) affected

- **Activation** record (`quoteVersionId`, `flowId`, `jobId`, `activatedAt`, `activatedBy`, `packageHash`).
- **Flow**, **RuntimeTaskInstance[]** (35).

## 7. Where it lives in the product

- **Quote version** header button **Activate**; **job** page shows activation summary.

## 8. Create flow

1. Preconditions: version `signed` (unless tenant allows **activate unsigned** — **non-default**), **execution package** present, **structured inputs** meet `REQUIRED_TO_ACTIVATE` if any, **job** ensured per **`04-job-anchor-timing-decision`** (already at sign default).
2. Server **transaction**:
   - Verify **expected version** matches **frozen** payload.
   - **Ensure job** idempotent reuse (`04`).
   - Create **Flow** pinned to `workflowVersionId` from package.
   - Inject **RuntimeTask** rows for **BUNDLE/MANUAL/ASSEMBLY manifest** slots; **skip WORKFLOW** skeleton duplication (`03`).
   - **Materialize inspection** as manifest tasks already in package per decision `03` (no parallel table).
   - Write **Activation** audit.
3. **PreJobTask** evidence (site surveys, photos, measurements) on the `FlowGroup` remains accessible from the `Job` as historical reference. These tasks are **not** migrated into the execution graph.
4. Success toast; redirect **Job** or **Flow** dashboard.

## 9. Read / list / detail behavior

- **Activation card:** time, user, counts of runtime tasks created, **errors** if partial (should not commit partial — **atomic**).

## 10. Edit behavior

- **No edit** to activation record; **correct** via **support** tooling rare.

## 11. Archive behavior

- Not applicable.

## 12. Delete behavior

- **Forbidden** in normal product; **support** may **mark** botched activation with **compensating** transaction — out of scope procedure.

## 13. Restore behavior

- **Retry** idempotent activation returns same result.

## 14. Required fields

`quoteVersionId`, `flowId`, `activatedAt`.

## 15. Optional fields

`activationNotes` (internal).

## 16. Field definitions and validations

- **Reject** if **package missing** or **hash mismatch** vs stored snapshot.

## 17. Status / lifecycle rules

**One successful activation** per quote version (unique constraint). **Re-activate** attempts: **no-op** with message.

## 18. Search / filter / sort behavior

- Job list filter **activated today**.

## 19. Relationships to other objects

- **QuoteVersion**, **Job**, **Flow**, **Runtime tasks**, **Payment gates** may gain **runtime targets** post-activation (`02` open subquestion).

## 20. Permissions / visibility

- **job.activate** permission.

## 21. Mobile behavior

- **Read-only** activation status; **trigger** disabled on mobile default.

## 22. Notifications / side effects

- Notify crew **job live** (44, 56).

## 23. Audit / history requirements

- **Immutable** activation audit log entry with **payload references**.

## 24. Edge cases

- **Partial failure:** **rollback** entire transaction; surface **retry**.
- **CO mid-flight:** activation locks to **version**; CO uses **37**.

## 25. What must not happen

- **Second job** same FlowGroup (`04`, `9`).
- **AI** activation (`8`).

## 26. Out of scope

- **Multi-flow** activation (O2).

## 27. Open questions

- **Auto vs manual** activation toggle per company (GTM).
