# Struxient v3 — Task identity and behavior

**Canon:** This document **closes** the primary v2 failure mode: **one word “task”** for incompatible concepts.

---

## The five task-like layers (normative names)

| v3 term | What it is | Reusable? | Executable? | Default time/cost intelligence? |
|---------|------------|-----------|-------------|----------------------------------|
| **Task definition** | Library record: **meaning** + structured **field templates** | **Yes** (catalog library) | **No** (not an instance) | **Yes** (defaults for meaning) |
| **Packet task line** | Row inside a **scope packet**: placement + embedded or referenced meaning | **Yes** (as part of packet) | **No** | **Yes** (merged defaults) |
| **Skeleton task** | Task inside **published process template** on a **node** | **Yes** (per template version) | **Yes** (as snapshot task id) | **Optional** (template author) |
| **Pre-job task** | Operational work on a **FlowGroup** before sign/activation | **No** (per project) | **Yes** (in Work Station) | **Optional** |
| **Runtime task instance** | **Materialized** unit for **manifest** work on a **flow** | **No** (per job/flow instance) | **Yes** | **Inherits** from frozen plan + overrides; **actuals** live in **execution truth** |

**Canon:** **Executable** in the field means: can appear in **actionable work projections** and accumulate completion evidence when started/completed — **skeleton**, **runtime instance**, and **pre-job task** all can; **task definition** and **packet task line** cannot without **freeze + activation** (or in the case of pre-job tasks, direct FlowGroup anchoring).

**Pre-job task boundary:** `PreJobTask` is **not** part of the activated execution graph. It lives on the `FlowGroup` and is completed independently of job activation. Its evidence (photos, structured inputs) feeds quote authoring. After activation, it remains as historical evidence on the `FlowGroup`.

**Rationale from v2 evidence:** `TaskDefinition` vs `PacketTaskLine` vs design-time `Task` in snapshot vs `RuntimeTask` + effective merge + activation source filter.

---

## Which layer carries what

**Canon**

- **Reusable work intelligence (words, inputs, default labor hints):** **Task definition** (library) **and** **packet task line** overrides.  
- **Default node placement:** **Packet task line** only (not task definition).  
- **Structural “every job of this type” steps:** **Skeleton tasks**.  
- **“This job’s sold scope” steps:** **Runtime task instances** (after activation) originating from **frozen manifest** classification.  
- **Actual execution truth (started/completed/outcome):** **Execution truth** keyed to **effective task id** (skeleton id **or** runtime instance id) — **not** quote line row.  
- **Actual duration / labor truth:** Derived from **execution timestamps** and policies — **not** from **quote** or **packet defaults** after execution.

**What not to do:** Put **placement** on **task definition** as authoritative for quote scope (v3 **forbids** conflating library with placement).

---

## Who should think about what

**Canon**

| Persona | Primarily thinks in terms of | Should rarely think directly about |
|---------|------------------------------|-----------------------------------|
| **Estimator / sales** | **Line items**, **scope packets**, **tiers**, **structured inputs on quote** | **Skeleton task ids**, **runtime merge mechanics** |
| **Catalog author** | **Scope packets**, **packet task lines**, **task definitions** | **Per-job FlowSpec truth tables** |
| **Process template author** | **Nodes**, **gates**, **skeleton tasks**, **completion rules** | **Commercial line pricing** |
| **Crew / field** | **Actionable work** (effective **skeleton + runtime** tasks on **nodes**) | **Packet JSON**, **library definition ids** |
| **Ops / PM** | **Holds**, **detours**, **schedule**, **change orders** | **Renaming primitives in ad-hoc language** |

**Rationale from v2 evidence:** UI already bundle-first on quote; workstation surfaces effective tasks.

---

## Banned terminology patterns (v3)

**Canon — what not to call “task” loosely**

1. **Do not** say “task” without **one of**: *task definition*, *packet task line*, *skeleton task*, *runtime task instance*, or *plan task row* (freeze artifact only).  
2. **Do not** use **“library task”** to mean **runtime work**.  
3. **Do not** use **“workflow task”** without clarifying **skeleton** vs **manifest**.  
4. **Do not** expose **JobTask**-style naming for **new** features (**legacy** only if migrating data).

**Internal API guideline:** Prefer **explicit** identifiers (`definitionId`, `manifestInstanceId`, `skeletonTaskId`, `planTaskId`) over **generic** `taskId` in **new** public contracts.

**Rationale from v2 evidence:** `JobTask` deprecated; four persisted universes in task deep dive; payment bridge uses legacy naming.

---

## Plan task row (freeze artifact)

**Canon:** A **plan task row** is a **flattened row** inside the **frozen generated plan** (pre- or at-package). It is **not** a separate **persona primitive** for daily language; it is the **snapshot of expanded scope** before/during **execution package** composition.

**Owns:** **Stable id within freeze** for exclusions, overrides, structured answers map.

**Must not collapse into:** **Runtime task instance** (created only after activation rules).

**Rationale from v2 evidence:** `PlanTaskV1` with deterministic ids in `computeGeneratedPlan`.

---

## Package task slot (freeze artifact)

**Canon:** A **package task** is a **node-aligned slot** in the **execution package** with **source classification** (sold scope vs skeleton vs manual). **Naming in docs:** use **package task slot** when discussing freeze; **runtime task instance** when discussing post-activation rows.

---

## Summary: the v2 confusion source (explicit)

**Canon:** v2’s biggest confusion was **collapsing** **library meaning**, **catalog line placement**, **template structure**, and **manifest instances** under **“task.”** **v3** **requires** separation in **canon, APIs, and UX copy**.

**Three sentences to memorize**

1. **Task definitions know; they do not place.**  
2. **Packet task lines compose and place; they are not field instances.**  
3. **Runtime instances execute sold/manual manifest work on nodes; skeleton tasks execute template structure.**  
4. **Pre-job tasks capture pre-quote evidence on site; they do not enter the execution graph.**

---

## Task library curation philosophy

**Canon:** The task definition library is **curated reusable work intelligence** — not a dumping ground for every one-off job task.

- **Task definitions** are building blocks for **packet task lines** and **workflow skeleton tasks**. They carry shared meaning (instructions, labor hints, evidence expectations, structured input templates).
- **One-off work stays local.** Ad hoc tasks created during quoting (via `QuoteLocalPacket`) or at runtime (via runtime injection) do **not** automatically become library `TaskDefinition` records.
- **Promotion is explicit.** When a `QuoteLocalPacket` is promoted to the global library, its task content is reviewed and published as part of the new `ScopePacketRevision`. Individual ad hoc tasks may be promoted to `TaskDefinition` records through a separate admin review step.
- **Runtime actuals inform, they do not overwrite.** Observed execution data (actual duration, crew size, outcomes) may generate **learning suggestions** for updating library defaults, but **never** silently rewrites curated catalog truth without explicit admin approval (`07-time-cost-and-actuals-canon.md`).
