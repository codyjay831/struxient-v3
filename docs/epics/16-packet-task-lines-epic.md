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

- **PacketTaskLine** (`packetRevisionId`, `kind`, `definitionId?`, `embeddedPayload?`, `targetNodeId`, `overrides`).

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
| `targetNodeId` (stable id in template) | string | Compose placement (`06`). |
| Line meaning | embedded OR definition ref | Work identity. |

## 15. Optional fields

`checkpointDefId` linkage for inspection materialization (`03` decision).

## 16. Field definitions and validations

- **targetNodeId** must exist on **compatibility template** set or **warn** at publish.
- Overrides max lengths match definition caps.

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
