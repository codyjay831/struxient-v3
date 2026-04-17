# Epic 14 — Quote change and revision workflow

## 1. Epic title

Quote change and revision workflow

## 2. Purpose

Define how **new quote versions** supersede **sent** proposals, how **void** works, and how **pre-activation** corrections differ from **post-activation change orders** (epic 37) — preserving **audit** and **immutable** snapshots.

## 3. Why this exists

Customers change their minds; errors are found. Without a controlled revision story, teams **mutate** frozen data or fork ambiguous truth.

## 4. Canon alignment

- **`03`:** Silent unfreeze forbidden; corrections via **new version** or **controlled** mechanisms.
- **Post-activation** scope deltas: **change orders** (37), not silent quote edits.

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Estimator** | Start **revision** from **sent** (not signed) or **signed** (policy) versions. |
| **Admin** | **Void** versions; **force** supersede. |

## 6. Primary object(s) affected

- **QuoteVersion** lineage (`supersedesVersionId`, `voidReason`).
- Optional **RevisionRequest** record for approvals.

## 7. Where it lives in the product

- **Version history** UI: **Revise**, **Void**, **Compare** (optional).

## 8. Create flow — revision

1. User clicks **New version** on sent/signed version.
2. Choose **carry forward** options: lines, structured answers, attachments (selectable checkboxes).
3. System creates **new draft** `versionNumber+1`, links `supersedesVersionId`.
4. Prior **sent** version marked `superseded` when **new** version is **sent** (not at draft creation) — **default** to avoid losing **active** sent proposal prematurely.

**Alternative policy (explicit):** mark old as `superseded` immediately when new draft created — **not recommended**; document if chosen.

## 9. Read / list / detail behavior

- Timeline shows **branch**; **Compare v3 vs v4** table (line totals, added/removed lines).

## 10. Edit behavior

- Only **draft** tip editable.

## 11. Archive behavior

- N/A per version.

## 12. Delete behavior

- **Void** sets `status=void`, `voidReason`, `voidedBy`, `voidedAt`; **does not** delete snapshot rows.

## 13. Restore behavior

- **Unvoid** admin-only with **legal** acknowledgement; rare; reverts status to **sent** only if **no** dependent signature conflicts — **default disallow** if signed exists.

## 14. Required fields

For void: `voidReason` (enum + free text) required.

## 15. Optional fields

`internalApprovalId`.

## 16. Field definitions and validations

- Cannot void if **activated** from that version **without** following **CO** rules — **block** void; use operational **cancel job** policy instead.

## 17. Status / lifecycle rules

See epic 08; add `void`, `superseded`.

## 18. Search / filter / sort behavior

- Filter quotes with **void** versions; **open revisions** (draft exists while old sent).

## 19. Relationships to other objects

- **Activation** pins to **specific** signed version; revising **after** sign **does not** alter activated baseline — **new** work requires **CO** or **new quote** per policy.

## 20. Permissions / visibility

- **quote.revise**, **quote.void** permissions.

## 21. Mobile behavior

- **Read-only** history; no void on mobile default.

## 22. Notifications / side effects

- Notify customer when **new** proposal supersedes portal link (email with new link).

## 23. Audit / history requirements

- Full audit of revision start, void, supersede events.

## 24. Edge cases

- **Customer signed v3** but office creates v4 draft: **portal** must show **latest sent** only; **signed v3** remains legally signed until **void** — **critical**: signing **v4** required for new commercial terms.

## 25. What must not happen

- **Editing** signed snapshot in place.
- **Hiding** that a new version changes **price**.

## 26. Out of scope

- **Legal redlining** collaboration suite.

## 27. Open questions

- **Post-sign revision** before activation: allow automatic **carry** of signature? **Default no** — customer must re-sign changed commercial terms.
