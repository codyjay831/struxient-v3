# Epic 23 — Process templates

## 1. Epic title

Process templates (published workflows)

## 2. Purpose

Define **process template** authoring lifecycle: **draft** graph → **publish** → **immutable WorkflowVersion** snapshot (`06`) containing **nodes**, **gates**, **skeleton tasks**, **completion rules** — the **FlowSpec skeleton** for a **class of jobs**.

## 3. Why this exists

**Per-job workflow authoring is not default** (`06`); companies need **published templates** to compose **execution packages** (`32`) and bind at **send** (`03`).

## 4. Canon alignment

- **FlowSpec ≠ scope catalog** (`06`).
- **Template publish** human-governed; AI cannot silently publish (`08-ai`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Process author** | Edit drafts, publish. |
| **Admin** | Deprecate template, manage visibility. |
| **Estimator** | **Select** published version on quote version (08). |

## 6. Primary object(s) affected

- **WorkflowTemplate** (`name`, `trade`, `description`).
- **WorkflowVersion** (`templateId`, `version`, `status`, `snapshot`).

## 7. Where it lives in the product

- **Catalog → Process templates** `/catalog/process-templates`.
- **Quote version** picker.

## 8. Create flow

1. New template → name, trade.
2. Author **nodes** (24), **gates** (25), **skeleton tasks** (26), **completion rules** (27).
3. **Validate** graph (acyclic where required, reachability to terminal).
4. **Publish** → snapshot immutable; version increments.

## 9. Read / list / detail behavior

**List:** Name, trade, **latest published version**, draft indicator.

**Detail:** Graph canvas + **inspector**; **read-only** for published versions with **clone to draft**.

## 10. Edit behavior

- **Draft:** full structural edit.
- **Published:** **fork** new draft from snapshot; cannot edit published snapshot in place.

## 11. Archive behavior

- **Deprecate** template: hidden from **new** quote picks; existing quotes **pin** old version.

## 12. Delete behavior

- Delete template only if **never published**; else deprecate.

## 13. Restore behavior

- Undeprecate admin.

## 14. Required fields

`name`, `tenantId`.

## 15. Optional fields

`icon`, `defaultForTrade` flag (suggest on new quote).

## 16. Field definitions and validations

- Publish requires ≥1 node, terminal reachability, **no orphan** gates.

## 17. Status / lifecycle rules

Template: `draft` | `published` | `deprecated`. Version: `draft` | `published`.

## 18. Search / filter / sort behavior

Search name; filter trade; sort updated.

## 19. Relationships to other objects

- **QuoteVersion** pins `publishedWorkflowVersionId`.
- **Packet lines** reference **node ids** from **compatible** templates (16).

## 20. Permissions / visibility

- **process.publish** role.

## 21. Mobile behavior

- Read-only **diagram** thumbnail optional.

## 22. Notifications / side effects

- Warn quotes on **draft** if selected template **new publish** available — informational only.

## 23. Audit / history requirements

- Publish events with **diff summary** (node count, gate count).

## 24. Edge cases

- **Breaking rename** of node id: **migration tool** required for packet lines (16 epic).

## 25. What must not happen

- **Workflow-first** sales (`09`).
- **Encoding SKUs** only as skeleton tasks without packets (`06`).

## 26. Out of scope

- **Multi-flow** fan-out (O2).

## 27. Open questions

- **O18** enterprise per-job template fork — exception path only.
