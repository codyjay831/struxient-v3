# Epic 16 — Packet task lines

## 1. Epic title

Packet task lines

## 2. Purpose

Define **packet task lines**: rows inside a **scope packet** with **default node placement**, **embedded meaning** OR **task definition reference**, and **packet-local overrides** — per `02`, `04`, `05`.

## 3. Why this exists

**Task definitions know; packet lines place** (`04`). Without explicit line behavior, placement drifts to definitions incorrectly.

## 4. Canon alignment

- **Placement on packet line**, not on definition alone (`04`).
- **LIBRARY vs EMBEDDED** union (`foundation/07`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Catalog author** | CRUD lines on **draft** packet revisions. |

## 6. Primary object(s) affected

- **PacketTaskLine** (`packetRevisionId`, `lineKey`, `sortOrder`, `tierCode?`, `lineKind`, `definitionId?`, `embeddedPayload?`, **`targetNodeKey`** — top-level column, required, `overrides`).

**Canon amendment (authorized for first promotion slice):** `targetNodeKey` is promoted to a **top-level column** on `PacketTaskLine` (not an embedded JSON field). This brings catalog packet lines to structural parity with `QuoteLocalPacketItem.targetNodeKey` and enables the direct row-copy promotion contract. Historically `targetNodeId` / `targetNodeKey` was tolerated as either a top-level column or an embedded JSON field inside `embeddedPayloadJson`; the interim promotion slice settles on the top-level column.

## 7. Where it lives in the product

- **Packet editor** sub-grid; **node picker** against **selected template** compatibility matrix.

## 8. Create flow

1. **Add line** → choose **From library** (pick `taskDefinitionId`) or **Embedded**.
2. Set **target node** from **published template** dropdown (filtered to templates marked compatible with packet trade).
3. Optional overrides: **name**, **instructions**, **estimated minutes**, **evidence flags**.
4. Save → ordinal appended.

## 9. Read / list / detail behavior

**Grid columns:** Ordinal, display name, kind, **node**, definition id, **warnings** (missing node on template).

**Detail drawer:** Merged preview of **effective** fields (resolver output).

## 10. Edit behavior

- Draft revision only; reorder drag; **copy line** within packet.

## 11. Archive behavior

- Remove line from draft; published immutable.

## 12. Delete behavior

- Delete line in draft; confirm if referenced by **rules** (20).

## 13. Restore behavior

- Undo stack in editor.

## 14. Required fields

| Field | Type | Why |
|-------|------|-----|
| `lineKey` | string | Stable identity within the revision; unique per `scopePacketRevisionId`. |
| `sortOrder` | int | Deterministic expansion order. |
| `lineKind` | enum (`EMBEDDED` \| `LIBRARY`) | Meaning source. |
| **`targetNodeKey`** (top-level column, stable node key in pinned template) | string | Compose placement (`06`). Promoted to top-level per interim promotion slice for parity with `QuoteLocalPacketItem`. |
| Line meaning | embedded payload OR definition ref | Work identity. |

## 15. Optional fields

`checkpointDefId` linkage for inspection materialization (`03` decision).

## 16. Field definitions and validations

- **`targetNodeKey`** must exist on **compatibility template** set or **warn** at publish. Stored as a **top-level string column** on `PacketTaskLine` (not nested in `embeddedPayloadJson`).
- Overrides max lengths match definition caps.

## 16a. Promotion mapping contract (QuoteLocalPacketItem → PacketTaskLine)

**Canon (authorized for first promotion slice, sourced from `05-packet-canon.md`):** When a `QuoteLocalPacket` is promoted, each `QuoteLocalPacketItem` is copied 1:1 into a `PacketTaskLine` on the newly created `DRAFT` `ScopePacketRevision`:

| `QuoteLocalPacketItem` | `PacketTaskLine` | Rule |
|---|---|---|
| `lineKey` | `lineKey` | verbatim |
| `sortOrder` | `sortOrder` | verbatim |
| `tierCode` | `tierCode` | verbatim (nullable) |
| `lineKind` | `lineKind` | enum value preserved |
| `embeddedPayloadJson` | `embeddedPayloadJson` | deep copy |
| `taskDefinitionId` | `taskDefinitionId` | verbatim (nullable) |
| `targetNodeKey` | `targetNodeKey` | verbatim — required on both |

**No field transformation, no merging, no reordering.** The new revision is a faithful snapshot of the source items at promotion time.

## 17. Status / lifecycle rules

Lines version with **packet revision**; no independent status.

## 18. Search / filter / sort behavior

- Filter lines by node, by definition id, by kind.

## 19. Relationships to other objects

- **PacketTaskLine *—1 TaskDefinition** (optional); **feeds** plan rows (31).

## 20. Permissions / visibility

- Catalog author roles; estimators **read** via packet picker summaries only.

## 21. Mobile behavior

- Not applicable for authoring.

## 22. Notifications / side effects

- None.

## 23. Audit / history requirements

- Included in **packet revision** audit.

## 24. Edge cases

- **Template node renamed** in new template version: **publish** warns to **remap** lines.

## 25. What must not happen

- **AI** committed placement without human (`08-ai`).

## 26. Out of scope

- **Cross-packet** line inheritance.

## 27. Open questions

- **Multi-template** compatibility: enforce single **canonical** template family per trade vs many — affects picker filtering.
