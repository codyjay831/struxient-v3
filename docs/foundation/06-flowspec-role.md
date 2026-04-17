# FlowSpec role in v3 — repositioned process skeleton

**Labels:** **Proven from code** · **Strong inference** · **Working v3 interpretation** · **Unclear / needs canon decision**

**Locked assumptions:** FlowSpec = **stable process skeleton / node-and-routing framework**; quote-selected scope **populates** it at activation; **not** the main reusable trade scope object; **default** is not per-job manual workflow authoring.

---

## 1. What FlowSpec was doing in v2

### 1.1 Design time

**Proven from code:** Tenant `Workflow` with `WorkflowStatus`; `Node`, `Task` (design-time), `Gate`, optional `FanOutRule`, `CrossFlowDependency`; publish produces immutable `WorkflowVersion.snapshot` JSON (`02-domain-model-inventory.md`).

**Strong inference:** Builder UI and validate APIs treat workflows as **authorable artifacts** — substantial surface area (`01-product-surface-inventory.md` implied by synthesis).

### 1.2 Runtime

**Proven from code:** `Flow` binds `workflowVersionId`; engine records `NodeActivation`, `TaskExecution`, `NodeOutcome`; derives **actionable** tasks, **node completion**, **flow completion** (`derived.ts`); **DetourRecord** overlays dynamic blocking; **RuntimeTask** merges into **effective snapshot** (`effective-snapshot.ts`).

### 1.3 Quote bridge

**Proven from code:** Quote version picks **`workflowTemplateId`**; send uses **published** tenant workflow’s latest version snapshot to **`composeExecutionPackage`** (`send/route.ts`, `composer.ts`).

**Proven from code:** Activation creates **RuntimeTask** only for **BUNDLE** and **MANUAL** package tasks; **WORKFLOW** tasks remain **only** in bound snapshot (`activation-from-package.ts` header comments).

---

## 2. What part is still valuable for v3

| Capability | Why keep |
|------------|----------|
| **Immutable published snapshot** | Safety: crews execute against **known** graph; auditors can replay. |
| **Gates + outcomes** | Models real **branching** (pass/fail, rework, cancel) without custom code per job. |
| **Node completion rules** | **Stage** semantics inside a node (ALL vs ANY vs SPECIFIC) — **Proven** `CompletionRule`. |
| **Append-only task executions** | **Truth** for “what happened” vs editable config. |
| **Detours** | **Correction loops** without mutating published topology — **high value** for AHJ/inspection reality. |
| **Cross-flow / fan-out (optional)** | For **multi-flow** jobs within a **FlowGroup** — **defer** for trade MVP if not needed. |
| **Start eligibility composition** | Separates **graph motion** from **operational holds** (`task-start-eligibility.ts`) — **concept** is strong; **payment bridge** needs redesign. |

---

## 3. Why reposition as “process skeleton” (not scope catalog)

**Proven from code:** **Scope tasks** enter from **`BundleTemplate`** → plan → package; **structural tasks** come from **workflow snapshot** nodes (`composer.ts`).

**Working v3 interpretation:**

- **FlowSpec** answers: **In what order do stages open?** **What outcomes route where?** **What structural checks exist on every job of this type?**
- **Packets** answer: **What trade work was sold on this line?** **What defaults apply?** **Where should that work land in the skeleton?**

If FlowSpec is treated as the **scope catalog**, teams will **encode SKUs into the graph** and **break reuse** — v2 already split scope into **bundles**; v3 should **enforce that mental model** in product and docs.

---

## 4. How packets/tasks populate FlowSpec at activation

**Proven from code (mechanism):**

1. **Compose** builds **package nodes** 1:1 with workflow nodes (skeleton).  
2. Each **bundle plan task** maps to a node by **`targetNodeId`** (preferred) or **`targetNodeKey`** (legacy), with **reroute** to entry if missing (`composer.ts`).  
3. **WORKFLOW** tasks from snapshot are appended per node (bundle/manual typically ordered before workflow tasks in composer).  
4. **Activate** walks package and creates **RuntimeTask** rows for **BUNDLE/MANUAL** on **`node.nodeId`**.

**Working v3 interpretation:**

- **Packet task lines** carry **default placement** — this is the **authoritative intent** for **where** sold work attaches in the skeleton.  
- **Activation** is a **deterministic bind** of frozen package to **pinned** workflow version — **no** reinterpretation from catalog at activation time.

**Unclear / needs canon decision:** How tightly v3 **constrains** templates so **reroute** is rare (template packs per trade vs free-form authoring).

---

## 5. What FlowSpec should stop being responsible for

**Working v3 interpretation (aligned with v2 evidence):**

| Responsibility | Should move / stay |
|----------------|-------------------|
| **Defining sold trade scope** | **Packets + line items**, not workflow tasks as primary. |
| **Commercial pricing** | **Quote line items** only. |
| **Customer proposal narrative** | **Proposal groups + line descriptions**, not workflow. |
| **Mutable “what work exists” after sign** | **Change orders** + **runtime injection** rules — **not** silent workflow edits on published version. |
| **Payment truth** | **PaymentGate + holds** — FlowSpec **triggers** gating via **start eligibility**, should not **duplicate** ledger truth. |

**Proven from code:** Published snapshot is **immutable** — FlowSpec **already cannot** own post-hoc scope edits without new version / CO path.

---

## 6. Should manual workflow authoring per job exist at all?

**Proven from code:** v2 **always** uses a **published workflow** for execution package composition; quote selects **template** / track — not a bespoke per-quote graph file in the reviewed hot path.

**Working v3 interpretation:**

- **Default for trade MVP:** **No** per-job graph authoring for **execution**. Jobs **inherit** a **trade + job-type template** (e.g. “resi electrical install,” “solar install”).  
- **Authoring** happens at **template** level (company or system templates), **versioned** and **published** — matches **activation should populate stable node structure** (locked assumption 7).  
- **Exceptions:** **Detours** and **runtime tasks** handle **local variation**; **change orders** handle **scope deltas**; **new template version** handles **process change** — not one-off node drawing per job.

**Unclear / needs canon decision:** Whether **enterprise** customers require **per-job workflow fork** — if yes, treat as **advanced** tier, not structural default for **trade-first** v3 story.

---

## 7. Preventing workflow-first thinking from reasserting

**Anti-patterns to flag in canon review:**

1. **“Pick tasks from the workflow library to build the quote”** as primary UX — contradicts **line-item-fronted** assumption.  
2. **Encoding SKU lists only in workflow tasks** — duplicates **BundleTemplate** and breaks **tiering**.  
3. **Teaching users that RuntimeTask is the only “real task”** — **skeleton tasks** are **real** for **gating** and **structural completion** (**Proven** injection rules).  
4. **Using graph edits** to fix **sold scope** — should be **change order** or **new quote version**.

**Healthy framing sentence for internal docs:**  
**“The workflow is the railway; packets are the freight. Activation couples specific freight cars to the train at send/freeze.”**

---

## 8. Summary

| Question | Answer |
|----------|--------|
| What is FlowSpec in v3? | **Immutable process skeleton** + **execution physics** (nodes, gates, completion, detours, truth tables). |
| What is it not? | **Primary trade scope catalog** or **pricing model**. |
| How does quote scope attach? | **Packet lines** → plan → **execution package** → **RuntimeTask manifest** on **skeleton nodes**. |
| Per-job workflow editing? | **Not default**; template publish + detours/CO/runtime for variation. |

---

## See also

- `07-task-packet-node-relationship.md`  
- `02-end-to-end-structure.md`  
- `03-object-boundaries.md`
