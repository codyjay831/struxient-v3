# Object boundaries — v3 foundation (from v2)

**Labels:** **Proven from code** · **Strong inference** · **Working v3 interpretation** · **Unclear / needs canon decision**

For each layer: **v2 reality** · **owns today** · **should own in v3** · **must NOT own** · **clean adjacent boundaries** · **v3 priority** (primary / secondary / internal / optional)

---

## 1. Quote line item

| Dimension | Content |
|-----------|---------|
| **v2** | `QuoteLineItem`: commercial fields + `bundleKey`/tier/`resolvedBundleId`/`executionMode`/`proposalGroupId`. |
| **Owns today** | **Commercial presentation** of a row; **pointer** to catalog bundle for scope lines; quantity. |
| **Should own in v3** | **Sold scope identity** (which packet + tier + qty), **pricing**, **proposal grouping**; **references**, not embedded graph authoring. |
| **Must NOT own** | Workflow topology, gate logic, or full task library content. |
| **Boundaries** | **Packet catalog** defines default tasks/placement; **snapshot** freezes derived plan; **Flow** runs instances. |
| **Priority** | **Primary** (user-facing sales spine). |

---

## 2. Packet / bundle / scope packet

| Dimension | Content |
|-----------|---------|
| **v2** | `BundleTemplate`: `bundleKey`×`tier`, JSON `tasks` (packet lines), `inspectionCheckpoints`. |
| **Owns today** | **Reusable scope definition** + **default node placement** per task line; optional LIBRARY ref to `TaskDefinition`. |
| **Should own in v3** | **Trade-standard work packages**; **composition** of task lines; **tier variants**; **defaults** for estimates/evidence templates **as authored**. |
| **Must NOT own** | Per-job outcomes, holds, or runtime execution state. |
| **Boundaries** | **Task definition** = shared meaning; **line item** = sale instance; **execution package** = frozen merge for one quote version. |
| **Priority** | **Primary** (reusable trade scope). |

---

## 3. Task definition

| Dimension | Content |
|-----------|---------|
| **v2** | `TaskDefinition` + versions + `TaskDefinitionInputTemplate` (timing enums for quote vs activation vs execution). |
| **Owns today** | **Meaning**: name, instructions, estimates, evidence flag, structured **field definitions**. |
| **Should own in v3** | **Reusable work intelligence** and **input schema**; **version history** for honesty. |
| **Must NOT own** | **Node placement** (that stays packet-owned for LIBRARY lines — **Proven** `packet-line-resolver.ts`). |
| **Boundaries** | Packet lines **merge** definition + overrides; plan copies **resolved** shape at compute time. |
| **Priority** | **Secondary** (library primitive). |

---

## 4. Runtime task

| Dimension | Content |
|-----------|---------|
| **v2** | `RuntimeTask` table; manifest from activation; optional `installItemId`; schedule fields “overlay only.” |
| **Owns today** | **Flow-scoped instance** of **sold or injected** work; metadata for provenance/handoff. |
| **Should own in v3** | **Executable instance** on a node: title, instructions, outcomes, evidence requirement, links to **line/packet** provenance. |
| **Must NOT own** | Graph routing rules (gates); **must not** drive gate evaluation incorrectly (**Proven** routing isolation). |
| **Boundaries** | **Skeleton tasks** live in snapshot; **runtime tasks** merged in **effective snapshot** for UX/engine. |
| **Priority** | **Internal** to execution (field-facing): **primary** for “work we added from quote,” **secondary** to node as organizing concept. |

---

## 5. Node

| Dimension | Content |
|-----------|---------|
| **v2** | `Node` in workflow; `CompletionRule`, `NodeKind`, tasks nested in published snapshot. |
| **Owns today** | **Stage-like** container; **completion policy**; houses **skeleton tasks**. |
| **Should own in v3** | **Process structure** — sequencing, phase behavior within stage, **where** packet tasks land by default. |
| **Must NOT own** | Commercial pricing or customer proposal copy. |
| **Boundaries** | **Gates** connect nodes; **packet** supplies **which** manifest tasks appear **under** which node at activation. |
| **Priority** | **Primary** (organizing field work in time). |

---

## 6. FlowSpec (aggregate)

| Dimension | Content |
|-----------|---------|
| **v2** | Workflow authoring + publish; runtime Flow; engine derives actionability/completion; detours, cross-flow deps, fan-out. |
| **Owns today** | **Immutable published spec** + **append-only truth** + **derived** “what can move.” |
| **Should own in v3** | **Skeleton** topology, **routing**, **completion physics**, **correction mechanics** (detours). |
| **Must NOT own** | **Catalog of trade scope** (packets do). |
| **Boundaries** | **Quote** freezes **what**; **FlowSpec** supplies **how work flows** once instantiated. |
| **Priority** | **Primary** as **engine**; **secondary** as **user-authored artifact** (templates, not per-job). |

---

## 7. Execution package

| Dimension | Content |
|-----------|---------|
| **v2** | `ExecutionPackageV1`: nodes mirroring workflow, each with `PackageNodeTask[]` (BUNDLE / WORKFLOW / MANUAL), hashes in `compositionContext`. |
| **Owns today** | **Frozen** “zipper” of **scope + skeleton** for one quote version at send. |
| **Should own in v3** | **Launch contract**: authoritative mapping **sold tasks → nodes** for activation (+ warnings/errors list from compose). |
| **Must NOT own** | Mutable operational state (holds, detours, schedule). |
| **Boundaries** | **Generated plan** is parallel flat view + overlays; package is **node-aligned** execution view. |
| **Priority** | **Internal** (system spine), **primary** for integrity between sales and field. |

---

## 8. Activation

| Dimension | Content |
|-----------|---------|
| **v2** | `Activation` row + `ActivationEvent`; transactional create Job, Flow, checkpoints, RuntimeTasks. |
| **Owns today** | **Idempotent** bridge quote version → runtime entities; stores `planJson`/results. |
| **Should own in v3** | **Single** “go live” operation: bind skeleton, inject manifest tasks, record audit. |
| **Must NOT own** | Ongoing job edits (those are CO/runtime APIs). |
| **Boundaries** | Consumes **execution package** + snapshot; produces **Flow** + **RuntimeTask** set. |
| **Priority** | **Primary** (one-time, critical). |

---

## 9. Hold / blocker

| Dimension | Content |
|-----------|---------|
| **v2** | `Hold` types (PAYMENT, PERMIT, …); scoped job/flow/task; **start** eligibility only. |
| **Owns today** | **Operational** pause without mutating workflow truth. |
| **Should own in v3** | Same: **policy overlay** on **start**. |
| **Must NOT own** | Completed task truth or node completion records. |
| **Boundaries** | Composed with **payment gates** in eligibility; v3 should **remove JobTask string bridge** (**Strong inference** from pain doc). |
| **Priority** | **Secondary** (operations), **primary** for revenue/permits when enabled. |

---

## 10. Detour / loopback

| Dimension | Content |
|-----------|---------|
| **v2** | `DetourRecord` + `DetourType` BLOCKING/NON_BLOCKING; affects `computeBlockedNodes`, `computeFlowComplete`, actionable exceptions. |
| **Owns today** | **Runtime correction path** without republishing workflow. |
| **Should own in v3** | Same pattern; clarify vs **static DETOUR nodes** (two “detour” notions in v2 — `05`). |
| **Must NOT own** | Scope definition (use change order for true scope delta — **Working v3 interpretation**). |
| **Boundaries** | Engine derives blocks from detours; **gates** remain publish-time. |
| **Priority** | **Secondary** but **high value** for inspections/failures. |

---

## 11. Scheduling object(s)

| Dimension | Content |
|-----------|---------|
| **v2** | `ScheduleBlock`, `ScheduleChangeRequest`, `RuntimeTask` schedule fields; **not** in start eligibility. |
| **Owns today** | **Intent** and **calendar artifacts**; ambiguous authority vs engine. |
| **Should own in v3** | Either **authoritative commit times** (then **must** gate or warn loudly) or **non-authoritative planning** — **pick explicitly**. |
| **Must NOT own** | Silent override of FlowSpec truth. |
| **Boundaries** | **Task start** policy should reference scheduling **if** calendar is authoritative. |
| **Priority** | **Optional** early v3 if scope is MVP-light; **secondary** when included — **must** resolve split-brain. |

---

## 12. Cost / actual event objects

| Dimension | Content |
|-----------|---------|
| **v2** | `CostEvent` append-only; optional links to job/flow/task execution. |
| **Owns today** | **Observed** cost signals, not gating truth. |
| **Should own in v3** | **Actuals layer** for margin, learning, accounting handoff. |
| **Must NOT own** | **Sold price** (line item) or **frozen plan totals** without version context. |
| **Boundaries** | Feeds **learning** suggestions; does not replace **TaskExecution** outcomes. |
| **Priority** | **Optional** / **secondary** for early v3; **primary** for finance-heavy tenants later. |

---

## 13. AI package / line-item drafting capability

| Dimension | Content |
|-----------|---------|
| **v2** | Ordering assistant, structured-input AI drafts, catalog package AI draft; drafts not truth until commit (`10`). |
| **Owns today** | **Proposals** and **candidates** in side tables / run records. |
| **Should own in v3** | **Acceleration** of **authoring** (catalog + quote), always **reviewable**. |
| **Must NOT own** | Activation input or customer-visible proposal without human gate. |
| **Boundaries** | Output lands in **packet** or **line item** or **structured input answers** only after commit rules. |
| **Priority** | **Optional** product module; **evaluate** per segment. |

---

## Summary diagram (conceptual)

```
[Task definitions] ----embedded/ref----> [Scope packet / BundleTemplate]
       |                                        |
       |                                        v
       +-------------------------------> [Quote line item] (sale instance)
                                                |
                         send/freeze            v
                      [Generated plan] ---> [Execution package]
                                                |
                      activate                  v
                      [Flow + pinned snapshot skeleton]
                      [Runtime tasks on nodes] + [TaskExecution truth]
                      [Holds / detours / schedule overlays / cost events]
```

---

## See also

- `07-task-packet-node-relationship.md`  
- `04-save-redesign-drop-foundation-matrix.md`
