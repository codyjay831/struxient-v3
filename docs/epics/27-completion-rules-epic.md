# Epic 27 — Completion rules

## 1. Epic title

Completion rules

## 2. Purpose

Define **completion rules** per **node**: when a **stage** is **complete** for routing (e.g. all required tasks done, subset, voting) — part of **published snapshot** (`06`).

## 3. Why this exists

Without explicit rules, **node completion** is ambiguous between **skeleton** vs **manifest** tasks and **breaks** progression math (`09` single progress story for v3-native).

## 4. Canon alignment

- **Derived completion** from **engine** + snapshot (`06`).
- **v3-native** jobs: **one** declared derivation for progress (`09` #8).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Process author** | Pick rule type per node; configure parameters. |

## 6. Primary object(s) affected

- **CompletionRule** (`nodeId`, `mode`, `params`).

## 7. Where it lives in the product

- **Node inspector** “Completion” section.

## 8. Create flow

1. Select **mode** enum:
   - `ALL_REQUIRED_TASKS` (default): all tasks marked **required** on node must reach **completed** outcome.
   - `ANY_OF_SET`: specify task id list.
   - `CUSTOM_EXPRESSION` (advanced, optional MVP).
2. Save on draft; validate **referenced task ids** belong to node.

## 9. Read / list / detail behavior

- **Preview** explanation string for field UX (“Complete all tasks in this stage”).

## 10. Edit behavior

- Draft only.

## 11. Archive behavior

- N/A; rule deleted with node removal in draft.

## 12. Delete behavior

- Reset to default **ALL_REQUIRED** when rule removed.

## 13. Restore behavior

- Undo.

## 14. Required fields

`nodeId`, `mode`.

## 15. Optional fields

`excludedTaskIds`, `requireEvidenceOnAll`.

## 16. Field definitions and validations

- Params JSON schema validated against `mode`.

## 17. Status / lifecycle rules

Frozen in snapshot.

## 18. Search / filter / sort behavior

- N/A.

## 19. Relationships to other objects

- **Skeleton tasks** flagged `required` participate; **manifest** tasks **excluded** from **gate** driving per canon — **completion display** may still show **manifest** progress separately (36) — **must not** create **second** incompatible **%** without labeling (`9`).

## 20. Permissions / visibility

- Process author.

## 21. Mobile behavior

- Shown as **stage progress** chip (40).

## 22. Notifications / side effects

- When node completes, **notify** PM (optional 56).

## 23. Audit / history requirements

- Template publish.

## 24. Edge cases

- **Zero tasks** on node: publish **blocked** unless **terminal** passthrough node type allowed.

## 25. What must not happen

- **Dual** incompatible **percent complete** formulas (`9`).

## 26. Out of scope

- **Weighted** completion by dollar value.

## 27. Open questions

- Whether **manifest** tasks count toward **node completion UI** only vs **routing** — **routing** remains per canon **isolation**; **UI** may show **combined** with clear legend (product).
