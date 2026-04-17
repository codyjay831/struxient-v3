# Epic 24 — Nodes

## 1. Epic title

Nodes (process stages)

## 2. Purpose

Define **node** as **stage-like container** in **published process template**: holds **skeleton tasks**, obeys **completion rule**, connects via **gates** (`06`).

## 3. Why this exists

**Structural ordering** for crews must be **stable** and **separate** from **sold scope** (`02`).

## 4. Canon alignment

- Node **does not own** SKU catalog or pricing (`06`).
- **Static DETOUR node kind** vs **DetourRecord** — distinguish in UX (`06`, `20` O20).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Process author** | CRUD nodes on **template draft**. |

## 6. Primary object(s) affected

- **Node** (`id` stable string in snapshot, `name`, `kind`, `completionRuleId`, `ordinal`).

## 7. Where it lives in the product

- **Template canvas**; **node inspector**.

## 8. Create flow

1. Add node → choose **kind** (`STAGE`, `INSPECTION`, `DETOUR_STATIC`, `TERMINAL`, product enum).
2. Assign **display name**, **internal key** immutable once published.
3. Link **incoming/outgoing gates** (25).

## 9. Read / list / detail behavior

- **Outline** list of nodes sorted by flow order; search node by name in template.

## 10. Edit behavior

- Draft only; **rename display** allowed; **id** immutable after publish.

## 11. Archive behavior

- Remove node from **draft** only if **no edges**; published **cannot remove** — new version.

## 12. Delete behavior

- Same as archive in draft.

## 13. Restore behavior

- Undo in draft editor.

## 14. Required fields

`id`, `kind`, `displayName`, `templateDraftId`.

## 15. Optional fields

`color`, `icon`, `description`.

## 16. Field definitions and validations

- `id` regex: stable slug unique within template version; max 64.

## 17. Status / lifecycle rules

Nodes live in **snapshot**; no runtime status on template node itself.

## 18. Search / filter / sort behavior

- Within template authoring search by name.

## 19. Relationships to other objects

- **1—* SkeletonTask**; **gates** in/out; **package slots** target `nodeId` (`32`).

## 20. Permissions / visibility

- Process author roles.

## 21. Mobile behavior

- **Field** sees **node labels** on work views (40).

## 22. Notifications / side effects

- None.

## 23. Audit / history requirements

- Part of template publish audit.

## 24. Edge cases

- **Split node** refactor: new template version + packet line remap.

## 25. What must not happen

- Collapsing **node** with **line item** or **packet** (`09`).

## 26. Out of scope

- **3D** graph layout algorithms.

## 27. Open questions

- **O20** customer-facing labels for DETOUR static vs runtime detour.
