# Epic 25 — Gates, routing, and outcomes

## 1. Epic title

Gates, routing, and outcomes

## 2. Purpose

Define **gates** connecting **nodes** with **conditions** and **outcomes** (pass/fail, branch labels) in the **published snapshot** — engine evaluates **routing** without **manifest tasks** altering gate semantics (`09` runtime overlay ban).

## 3. Why this exists

Jobs branch on **inspection results**, **customer selections**, and **template rules**; needs explicit **graph edges**.

## 4. Canon alignment

- **Routing isolation:** manifest/runtime tasks **must not** drive gate evaluation incorrectly (`09` #10, `04`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Process author** | Author gates on draft template. |

## 6. Primary object(s) affected

- **Gate** (`fromNodeId`, `toNodeId`, `conditionType`, `expression` or `outcomeKey` binding).

## 7. Where it lives in the product

- **Canvas edges**; **gate editor** modal.

## 8. Create flow

1. Connect two nodes → pick **condition**: `always`, `onOutcome`, `onExpression` (advanced).
2. Map to **skeleton task outcome keys** or **node completion** signals per engine contract.

## 9. Read / list / detail behavior

- **Gate list** table for accessibility; validate **reachable terminal**.

## 10. Edit behavior

- Draft only.

## 11. Archive behavior

- Remove edge in draft.

## 12. Delete behavior

- Remove edge; warn if breaks reachability.

## 13. Restore behavior

- Undo.

## 14. Required fields

`fromNodeId`, `toNodeId`, `conditionType`.

## 15. Optional fields

`priority`, `label`.

## 16. Field definitions and validations

- **No cycles** unless **explicit** loop template allowed; validator warns.

## 17. Status / lifecycle rules

In snapshot only.

## 18. Search / filter / sort behavior

- N/A.

## 19. Relationships to other objects

- **Skeleton tasks** produce **outcomes** consumed by gates.

## 20. Permissions / visibility

- Process author.

## 21. Mobile behavior

- N/A authoring.

## 22. Notifications / side effects

- Simulation tool **dry-run** routing in template validator (optional).

## 23. Audit / history requirements

- Template publish audit.

## 24. Edge cases

- **Unreachable node:** publish **blocked** or **warning** — product default **block**.

## 25. What must not happen

- **Manifest task completion** wired to **gate** inputs without **explicit** canon change (`09`).

## 26. Out of scope

- **Machine learning** routing.

## 27. Open questions

- **Expression language** for conditions — safe DSL vs fixed enum only at MVP.
