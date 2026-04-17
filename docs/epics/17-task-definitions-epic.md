# Epic 17 — Task definitions (library)

## 1. Epic title

Task definitions (library)

## 2. Purpose

Define **task definition** as **tenant-scoped reusable work intelligence**: name, instructions, default labor hints, evidence expectations, **structured input templates** — **without** node placement (`02`, `04`).

## 3. Why this exists

Shared **instructions** and **fields** across many packets reduce duplication and power **structured inputs** (18).

## 4. Canon alignment

- **Does not own placement** (`04`).
- **Time/cost defaults** live here and inherit to packet lines (`07`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Catalog author** | CRUD definitions; draft/publish. |
| **Admin** | Deprecate definitions. |

## 6. Primary object(s) affected

- **TaskDefinition** (`id`, `name`, `instructions`, `estimatedMinutes`, `recommendedCrew`, `inputTemplates[]`, `status`).

## 7. Where it lives in the product

- **Catalog → Task definitions** `/catalog/task-definitions`.

## 8. Create flow

1. New definition → name required, instructions optional.
2. Attach **input templates** (18).
3. Save draft → **publish** creates immutable revision for new references; existing packet lines **pin** revision unless **upgraded**.

## 9. Read / list / detail behavior

**List:** Name, trade tags, usage count (packet lines referencing), status.

**Detail:** Effective field preview, **used by** packets list with **jump** links.

## 10. Edit behavior

- Draft: edit all; Published: **fork** new revision.

## 11. Archive behavior

- **Deprecate** hides from **new** picks in packet editor; old references still resolve to pinned revision.

## 12. Delete behavior

- Hard delete if **unused**; else deprecate.

## 13. Restore behavior

- Undeprecate admin.

## 14. Required fields

`name`, `tenantId`.

## 15. Optional fields

`trade`, `tags`, `evidenceExpectation` flags, `safetyNotes`.

## 16. Field definitions and validations

- Name max 200; instructions max 50k plain text.
- **estimatedMinutes** integer ≥0.

## 17. Status / lifecycle rules

`draft` | `published` | `deprecated`.

## 18. Search / filter / sort behavior

- Search name, instructions substring; filter trade; sort updated.

## 19. Relationships to other objects

- Referenced by **PacketTaskLine**; **not** by quotes directly.

## 20. Permissions / visibility

- **catalog.manage_definitions**.

## 21. Mobile behavior

- Read-only lookup optional.

## 22. Notifications / side effects

- Learning suggestions (52) may propose edits — **draft** only.

## 23. Audit / history requirements

- Publish/deprecate and field diffs on draft saves (batched).

## 24. Edge cases

- **Circular** import in copy/paste between tenants — out of scope.

## 25. What must not happen

- **Exposing** definition picker as **primary** quote builder (`01` ban).
- Using the task definition library as a **dumping ground** for random one-off job tasks. Task definitions are **curated reusable work intelligence** — building blocks for packet task lines and workflow skeleton tasks.
- Allowing runtime actuals to **silently overwrite** library defaults (estimated minutes, crew hints). Learning suggestions require explicit admin review before updating library truth.

## 26. Out of scope

- **Global** cross-tenant definition marketplace.

## 27. Open questions

- **Version upgrade assistant** for packets when definition revision changes — tooling epic.
