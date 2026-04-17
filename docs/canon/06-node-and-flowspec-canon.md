# Struxient v3 — Node and FlowSpec canon

**Canon**

---

## What a node is

**Canon:** A **node** is a **stage-like container** in the **published process template**: it belongs to a **workflow version snapshot**, contains **skeleton tasks**, obeys a **completion rule**, and participates in **gate-defined routing** to other nodes (including **terminal** outcomes).

**Owns:** **Structural position** in the job’s **process**, **skeleton task** set for **every** job using that template, **completion semantics** for that stage.

**Does not own:** **SKU catalog**, **customer pricing**, **sold manifest** (that **populates into** nodes at freeze/activation).

**Rationale from v2 evidence:** `Node`, `CompletionRule`, composer builds **package nodes** from workflow snapshot.

---

## What a node is not

**Canon:** A node is **not** a **quote line item**, **not** a **scope packet**, and **not** a **commercial stage** in the accounting sense unless explicitly labeled as such in UX.

---

## What FlowSpec is

**Canon:** **FlowSpec** is the **combined contract** for:

1. **Design-time:** **Workflow** authoring → **publish** → **immutable WorkflowVersion snapshot** (nodes, **gates**, **skeleton tasks**, optional advanced features).  
2. **Runtime:** **Flow** instance **pinned** to that snapshot; **append-only** execution facts; **derived** rules for **actionable** work, **node completion**, **flow completion**, **detours**, **holds at start**.

**Canon boundary:** In v3 **rhetoric**, say: **FlowSpec = process skeleton + execution physics** for jobs running under a template.

**Rationale from v2 evidence:** Schema + `derived.ts` + engine + activation pin.

---

## What FlowSpec is not

**Canon:** FlowSpec is **not** the **scope catalog**, **not** the **proposal pricer**, and **not** the **authoritative commercial freeze** (those are **quote** domain artifacts).

**What not to do:** Encode **trade SKUs** **only** as **workflow tasks** without **scope packets** on **line items**.

---

## How scope packets populate nodes

**Canon:** At **send**, **compose** maps each **plan task row** (from **line items × scope packets × quantity** + overlays) onto a **node** using **packet task line default placement** (prefer **stable node identity** over fragile name-only matching). Result: **execution package** with **per-node** list of **package task slots** including **source classification**.

At **activation**, **manifest** classifications become **runtime task instances** **on** those **node** ids; **skeleton** classifications remain **snapshot tasks**.

**Rationale from v2 evidence:** `composeExecutionPackage`, `activation-from-package` injection by `nodeId`.

---

## What skeleton tasks are

**Canon:** **Skeleton tasks** are **tasks authored on the process template** inside **nodes**. They exist for **every** job using that template. They carry **structural** work (checklists, required gates, standard milestones) **not** specific to **which** scope packet was sold.

**Executable:** **Yes**, via **snapshot task identity** on the flow.

**Rationale from v2 evidence:** WORKFLOW-sourced package tasks; not duplicated as `RuntimeTask` on packaged activation.

---

## What structural tasks are for

**Canon:** **Structural / skeleton** tasks enforce **repeatable process discipline**: what must happen in a **stage** for **routing** and **completion rules** to advance **regardless** of **which** **scope packet** was on the line items.

**What not to do:** Use skeleton tasks to **replace** **scope packets** for **trade BOM-style** reuse.

---

## Per-job manual workflow authoring — default

**Canon:** **Not allowed as default** for v3 trade wedge. **Normal:** Company uses **published process templates** (trade + job-type). **Per-job** graph editing is **exception** (enterprise/advanced), never the **assumed** estimator path.

**Rationale from v2 evidence:** Packaged path always composes against **published** tenant workflow version selected at quote; no canon requirement for per-quote custom graph in hot path.

**Canon boundary:** Whether **enterprise** tier allows **forked template per job** — **product** decision under **`10-open-canon-decisions.md`** if needed; **default** remains **template-driven**.

---

## Detours and loopbacks vs nodes

**Canon**

- **Dynamic detour (DetourRecord):** **Runtime** obstruction + **resume** behavior **without** mutating **published** snapshot — **correction loop**.  
- **Static DETOUR node kind (template):** **Authored** branch topology — **different** from **DetourRecord**; both may exist.

**Must distinguish in UX** to avoid “detour” meaning drift.

**Rationale from v2 evidence:** Doc 05/11 contradiction notes; schema has both.

---

## What “process structure” means in v3

**Canon:** **Process structure** = **ordered and branching stages** (**nodes**), **rules for completing** each stage, **routing** by **outcomes**, and **template-level** **skeleton tasks** — **independent** of **which** **scope packet** was sold, but **receiving** **manifest work** **into** those stages via **freeze**.

**Analogy (allowed in internal canon):** **Railway = FlowSpec nodes/gates**; **freight = manifest runtime instances** placed by **scope packets**.

---

## Charter alignment

| Locked assumption | Canon restatement |
|-------------------|-------------------|
| FlowSpec = skeleton | **Immutable template** + **runtime engine**; **not** scope catalog. |
| Activation populates stable nodes | **Compose + activate** place **manifest** work **on** **pinned** node ids. |
| Packet tasks carry default placement | **Packet task line** → **plan row** → **package slot** → **runtime instance**. |

---

## What not to do (summary)

- **Workflow-first sales** (process template as **primary** scope definer).  
- **Per-job workflow authoring** as **default** trade flow.  
- **Collapsing** **node** with **line item** or **scope packet**.  
- **Letting runtime manifest tasks** alter **gate routing** semantics (v2 invariant preserved).
