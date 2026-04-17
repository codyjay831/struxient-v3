# Epic 20 — Assemblies and rules-generated scope

## 1. Epic title

Assemblies and rules-generated scope

## 2. Purpose

Define the **secondary** path where **declarative rules** emit **additional plan tasks** into **draft/freeze** with **provenance**, while **default** quoting remains **packet-on-line-item** (`05-packet-canon`).

## 3. Why this exists

Some segments (e.g. parameterized solar) need **generated** tasks beyond static packet tiers **without** making **workflow-first** the default (`01`).

## 4. Canon alignment

- **Assembly merges overlay** into plan (`foundation`); **must not replace** packets as default.
- **Banned:** treating assembly as **required** for all trades (`05`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Rules author** | Maintain **published** rule sets per tenant/trade. |
| **Estimator** | Provide **rule inputs** on quote; **preview** generated tasks before send. |

## 6. Primary object(s) affected

- **AssemblyRuleSet** (versioned, published).
- **RuleInput** answers on `QuoteVersion`.
- **Generated overlay tasks** in **plan** with `source=ASSEMBLY` classification (`31`).

## 7. Where it lives in the product

- **Quote editor** “Rules” panel when packet enables assembly hook.
- **Catalog** admin for rules.

## 8. Create flow

1. Author publishes **rule set** with **input schema** and **emit tasks** template (declarative spec — implementation language out of scope).
2. On quote, user fills **inputs**; clicks **Run rules**.
3. System proposes **overlay tasks** as **draft** rows attached to quote version; user **accepts** each group or **accept all**.
4. On send, accepted overlay **frozen** with **provenance** to rule version + inputs snapshot.

## 9. Read / list / detail behavior

- **Diff view** between **packet-only** plan and **with assembly**; highlight **added** rows.

## 10. Edit behavior

- Change inputs → **re-run** rules marks prior overlay **stale**; user must **re-accept** (prevent silent drift).

## 11. Archive behavior

- Deprecate rule set: **block new** quotes using it; old frozen quotes unaffected.

## 12. Delete behavior

- Cannot delete published rule set versions; deprecate.

## 13. Restore behavior

- N/A.

## 14. Required fields

Rule set: `name`, `trade`, `publishedRevision`.

## 15. Optional fields

`maxEmitTasks` guard, `tenantScope`.

## 16. Field definitions and validations

- **Emit bounded:** fail if rule tries to emit > N tasks (tenant config).

## 17. Status / lifecycle rules

Rule set: `draft` | `published` | `deprecated`.

## 18. Search / filter / sort behavior

- Catalog list rule sets by trade.

## 19. Relationships to other objects

- Plan rows (31) carry `provenance.assemblyRuleId`.

## 20. Permissions / visibility

- **rules.publish** admin; estimators **run**.

## 21. Mobile behavior

- Not applicable for authoring; **read-only** summary on field optional.

## 22. Notifications / side effects

- Warn on send if **stale** assembly overlay pending re-accept.

## 23. Audit / history requirements

- Store **inputs snapshot** and **rule revision** on send.

## 24. Edge cases

- **Non-deterministic** rules: **forbidden** — rules must be **pure** functions of inputs + packet context.

## 25. What must not happen

- **Workflow-first** quoting via assemblies.
- **Silent** apply on send without accept.

## 26. Out of scope

- Visual **rules builder UI** vs code-based rules — implementation.

## 27. Open questions

- **Rule language** choice (JSON DSL vs TS sandbox) — engineering.
