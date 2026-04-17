# Task · packet · node relationship — v3 foundation

**Labels:** **Proven from code** · **Strong inference** · **Working v3 interpretation** · **Unclear / needs canon decision**

**Goal:** Make it **painfully clear** how these differ and connect under **line-item-fronted, packet-driven, task-definition-supported** v3.

---

## 0. Vocabulary cheat sheet (use in API + UI)

| Term | v2 anchor | What it is |
|------|-----------|------------|
| **Task definition** | `TaskDefinition` | Reusable **meaning** + structured **field templates** — **no** node placement. |
| **Packet task line** | `PacketTaskLine` / resolved `BundleTaskDefinition` | One row in a **scope packet** with **default node placement** + optional overrides + optional LIBRARY ref. |
| **Scope packet** | `BundleTemplate` (rename in UX if desired) | Reusable **composition** of packet task lines (+ checkpoints) for a **tier**. |
| **Skeleton task** | Design-time `Task` inside published `WorkflowVersion.snapshot` | **Process** step required by template (every job of this type). |
| **Plan task** | `PlanTaskV1` | **Flattened** sold/manually-added task row in `GeneratedJobPlanV1` before/after overlays. |
| **Package task** | `PackageNodeTask` | **Node-aligned** frozen slot in `ExecutionPackageV1` (`source`: BUNDLE / WORKFLOW / MANUAL). |
| **Runtime task instance** | `RuntimeTask` | **Live** row on a **Flow** for **manifest** work (BUNDLE/MANUAL origins) + ad-hoc adds. |
| **Legacy job task** | `JobTask` | **Deprecated** — evidence only for old jobs / bridges. |

**Working v3 interpretation:** Ban the naked word **“task”** in user-facing copy without one of these qualifiers.

---

## 1. Task definitions as reusable work intelligence

**Proven from code:** `TaskDefinition` stores name, instructions, estimates, `evidenceRequired`, hints; `TaskDefinitionInputTemplate` defines **fields** and **timing** (quote vs activation vs execution) (`schema`, `types.ts`).

**Owns:** **What** the work means, **what questions** must be answered, **default** labor hints.

**Does not own:** **Which node** it runs on — **Proven:** LIBRARY packet lines keep **placement on the line** (`packet-line-resolver.ts`: “Placement always comes from the packet line”).

**v3 role:** **Library** inside **packet authoring** — **secondary** to packets for **reuse narrative**.

---

## 2. Packet tasks carrying default node placement

**Proven from code:** Each embedded or referenced line includes `targetNodeKey` / `targetNodeId` (+ optional `intentNodeKey` for display).

**Compose step:** Plan tasks carry same placement; composer maps to **`PackageNode`**; reroute if node name missing (`composer.ts`).

**Working v3 interpretation:** **Default placement** is a **catalog author’s decision** (“rough-in tasks default to ROUGH-IN node”). Estimators **choose packet + tier**, not **node** per task, unless advanced override exists.

**Unclear / needs canon decision:** Whether v3 allows **per-quote node override** without new packet version — v2 has instruction overrides and exclusions at plan level (**Proven** overlays).

---

## 3. Packets as reusable scope composition

**Proven from code:** `BundleTemplate` groups many lines + inspection checkpoint definitions; **tier** variants.

**Working v3 interpretation:** **Packet** = **trade SKU** at a **depth level** (tier). This is the **main reusable scope object** for v3 (**locked assumption 3**), **not** raw tasks.

**Relationship to line item:** **QuoteLineItem** = **how many / which proposal group / commercial terms** + **which packet identity** (`bundleKey`, tier).

---

## 4. Nodes as process structure

**Proven from code:** Nodes contain **skeleton tasks**; **CompletionRule** defines how node completes; **gates** choose next node from **outcomes** (`05-node-stage-workflow-deep-dive.md`).

**Working v3 interpretation:** **Node** = **stage / phase container** in the **template railway** — defines **order and branching**, not **sold BOM**.

**Relationship to packets:** Many packet task lines may map **into the same node**; one line’s quantity loop may create **multiple** plan tasks in the same node (**Proven** quantity expansion in `computeGeneratedPlan`).

---

## 5. Runtime tasks as live execution instances

**Proven from code:** Created on activation for **BUNDLE/MANUAL** package tasks; merged into effective snapshot; **excluded from gate routing** (`effective-snapshot.ts`, `activation-from-package.ts`).

**Working v3 interpretation:** **Runtime task** = **instance of sold or ad-hoc work** **on a node**, participating in **TaskExecution** like skeleton tasks **for worker UX**, but **scoped** differently in **provenance** and **origin**.

**Critical invariant (preserve):** **Do not** let runtime tasks **alter** **gate** semantics — **Proven** routing isolation comment.

---

## 6. Skeleton (WORKFLOW) tasks vs manifest (BUNDLE/MANUAL) tasks

**Proven from code:** Composer sets `source: "WORKFLOW"` from snapshot; activation **skips** RuntimeTask creation for those; they execute from **snapshot** task ids (`composer.ts`, `activation-from-package.ts`).

| Aspect | Skeleton (WORKFLOW) | Manifest (BUNDLE/MANUAL) |
|--------|---------------------|---------------------------|
| **Origin** | Template author | Quote scope / estimator |
| **Frozen in** | `WorkflowVersion.snapshot` | `ExecutionPackage` + plan |
| **Instantiated as** | Snapshot task id | `RuntimeTask` row |
| **Purpose** | **Every job** structural steps | **This job’s sold scope** |

**Working v3 interpretation:** v3 messaging should **never** say “only runtime tasks are real” — **skeleton tasks** **block/enable** progression per **completion rules**.

---

## 7. End-to-end relation (one diagram)

```
[Task definitions] ----referenced by----> [Packet task lines]
        |                                        |
        |         catalog                       |
        v                                        v
                 [Scope packet / BundleTemplate]
                                        ^
                                        | picked by
[Quote line item] -----------------------+
        |
        | computeGeneratedPlan
        v
[Plan tasks (flat + overlays)] ---> composeExecutionPackage ---> [Package tasks on nodes]
        |                                              activate
        v                                                v
                         [Flow + pinned skeleton + RuntimeTask instances]
```

---

## 8. What “not raw-task-first” means here

**Working v3 interpretation:** Users **do not** build execution by **pulling atomic tasks from a global list** as the **first** move. They **pick line items** backed by **packets**; **task definitions** refine **consistency** inside packets; **nodes** order execution; **runtime tasks** are **materialized** scope.

**Raw tasks** still exist **inside** packets and as **manual overlays** — they are **implementation detail**, not **primary UX primitive**.

---

## See also

- `03-object-boundaries.md`  
- `06-flowspec-role.md`  
- `docs/v3-research/task-vs-packet-audit.md`
