# Epic 31 — Generated plan (freeze artifact)

## 1. Epic title

Generated plan (freeze artifact)

## 2. Purpose

Define **generated plan** as the **deterministic expansion** of **quote line items × scope packets (or QuoteLocalPackets) × quantity** plus **overlays** (exclusions, manual plan tasks, instruction overrides, structured answers, assembly tasks) **frozen at send** (`03`, `04` plan task row). When a line item references a `QuoteLocalPacket` (forked or AI-drafted), the plan expansion uses the local packet's task structure instead of the global library.

## 3. Why this exists

**Execution package** composition requires a **stable intermediate** with **plan task row ids** for references, exclusions, and audit.

## 4. Canon alignment

- **Plan task row** is **freeze artifact**, not runtime instance (`04`).
- **Inspection checkpoint defs** materialize here per **`03-inspection-model-decision`** (folded into manifest tasks).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Estimator** | Adds **manual plan tasks**, exclusions, overrides on **draft** only. |
| **System** | Computes plan at send (12). |

## 6. Primary object(s) affected

- **GeneratedPlan** snapshot (`version`, `tasks[]` with stable `planTaskId`, `lineItemId`, `packetRef`, `nodeId`, `source`, `estimates`).

## 7. Where it lives in the product

- **Quote editor** “Plan preview” tab; **support** diagnostic page post-send.

## 8. Create flow

- **Draft:** recompute **on demand** with **debounce** when lines change.
- **Send:** compute final plan → persist in version snapshot (12).

## 9. Read / list / detail behavior

- **Table** grouped by node; columns: planTaskId, name, source (`BUNDLE`, `BUNDLE_LOCAL` for QuoteLocalPacket, `MANUAL`, `ASSEMBLY`, `WORKFLOW` skeleton reference if listed for preview only), estimates, **excluded** flag.

## 10. Edit behavior

- **Draft:** toggle exclude, edit override text, add manual row with **target node** picker.
- **Sent:** **immutable**; corrections via **new version** or **CO** (37).

## 11. Archive behavior

- Not applicable; tied to quote version.

## 12. Delete behavior

- Remove manual rows on draft only.

## 13. Restore behavior

- Undo stack in draft.

## 14. Required fields

Each plan row: `planTaskId`, `nodeId`, `source`, `displayName`.

## 15. Optional fields

`definitionId`, `lineItemId`, `quantityIndex`, `checkpointDefId` provenance.

## 16. Field definitions and validations

- **planTaskId** deterministic hash from inputs (`v2` precedent) — **stable** across recompute given same inputs.
- **Quantity loops:** `quantityIndex` 1..N (`03`).

## 17. Status / lifecycle rules

Plan version increments only on **draft** recompute; **frozen** copy on send.

## 18. Search / filter / sort behavior

- Filter rows by source, node, line item in preview UI.

## 19. Relationships to other objects

- Feeds **execution package** (32); **activation** consumes package, not raw plan only.

## 20. Permissions / visibility

- Office full; field **read** post-activation via **effective** views (36) — not raw plan editor.

## 21. Mobile behavior

- Read-only **summary** count per node optional.

## 22. Notifications / side effects

- Warn if **manual task** has **invalid node** for selected template at send.

## 23. Audit / history requirements

- Frozen plan hash on send audit (12).

## 24. Edge cases

- **Library packet revision** or **quote-local packet contents** changed between draft sessions: **warn** on send with **diff**; block if **incompatible** (identity per `planning/01` §6 — local packet id stable; **item** edits change `planTaskId`s until send freezes).

## 25. What must not happen

- Treating **plan row** as **runtime instance** (`04`).

## 26. Out of scope

- **Normalized** plan tables vs JSON (`O12`) — semantics only here.

## 27. Open questions

- **O12** storage shape — engineering.
