# Struxient v3 — Core thesis

**Canon**

---

## What Struxient v3 is

Struxient v3 is a **trade-first quote-to-execution system** for contractors: it connects **how trades sell and freeze scope** to **how crews execute that scope on a stable field process**, with **one authoritative path** from **sent quote** to **activated work**, **append-only execution truth**, and **explicit separation** between **commercial truth**, **reusable scope intelligence**, **process structure**, and **runtime facts**.

**Rationale from v2 evidence:** v2 already implements a **line-item → catalog bundle → generated plan → execution package → activation → Flow + runtime manifest** pipeline with **pinned workflow snapshots** and **derived** FlowSpec actionability; v3 **names and protects** that spine instead of letting legacy vocabulary and bridges obscure it.

---

## What Struxient v3 is not

**Canon**

- **Not** a full-home-first “build any house from a universal task graph” product as its **initial wedge**.
- **Not** **raw-task-first**: estimators do not primarily build quotes by dragging **atomic tasks** from a global library.
- **Not** a system where **per-job workflow authoring** is the **default** way to get runnable work.
- **Not** a product where **market competitors** define structural canon.

**What not to do:** Do not market or implement v3 as “a workflow builder that also has quotes” or “a task manager with optional packets.”

---

## Why trade-first matters

**Canon:** The **initial v3 wedge** optimizes for **single-trade and focused-trade** jobs where **reusable SKUs**, **tiers**, **inspection loops**, and **fast office-to-field handoff** dominate—not for arbitrary multi-trade home orchestration on day one.

**Rationale from v2 evidence:** Primary quote authoring attaches **catalog bundle identity + tier** to **line items**; **BundleTemplate**-style packets are the natural reuse unit for **electrical, solar, HVAC-style** packaged scope.

**Canon boundary:** Multi-flow, fan-out, and cross-flow patterns may exist **later**; they do not **define** the v3 core thesis.

---

## Why line-item-fronted / packet-driven is the right center

**Canon**

- **Line items sell:** Customers and estimators reason in **rows on a proposal** (description, quantity, price, grouping). That is the **main user-facing commercial object**.
- **Packets compose:** Reusable **trade scope** lives in **scope packets** (catalog), not in ad-hoc task lists per quote.
- **Tasks know:** **Task definitions** hold **reusable work intelligence** (instructions, inputs, default labor hints) **inside** packet authoring.
- **Nodes structure:** **Process order and branching** live in **FlowSpec / nodes**, supplied by **templates**.

**Rationale from v2 evidence:** `computeGeneratedPlan` expands **line items × resolved catalog templates**; send freezes **plan + execution package**; activation materializes **BUNDLE/MANUAL** work as **runtime instances** on **nodes**.

**What not to do:** Do not center the product story on **TaskDefinition** pick-lists or **workflow canvas** as the first screen for “what we sell.”

---

## Why FlowSpec is repositioned

**Canon:** **FlowSpec** (published workflow: **nodes**, **gates**, **skeleton tasks**, **completion rules**) is the **stable process skeleton and routing framework** for a **class of jobs**. **Quote-selected scope** (via **scope packets** on **line items**) **populates** that skeleton at **freeze** and **instantiates** as **runtime work** at **activation**. FlowSpec does **not** own the **catalog of trade SKUs** or **customer pricing**.

**Rationale from v2 evidence:** `composeExecutionPackage` mirrors workflow **nodes** and merges **bundle-derived** and **manual** tasks **into** those nodes; **WORKFLOW**-origin tasks stay in the **snapshot**; packaged activation creates **RuntimeTask** rows only for **BUNDLE/MANUAL** package tasks.

**What not to do:** Do not treat “pick a workflow” as synonymous with “define what we sold.”

---

## Quote-to-execution mission (v3)

**Canon:** The mission is **no double entry** between **what was sold and frozen** and **what the field is asked to execute**, while preserving **honest separation** between:

| Truth type | Owns |
|------------|------|
| **Quote / commercial** | What customer agreed to pay for which **lines** |
| **Frozen scope + process bind** | What **work** and **which process template** attach to that version |
| **Runtime execution** | What actually **started, completed, failed, or was corrected** |

**Rationale from v2 evidence:** Send writes **immutable snapshot**; activation is **idempotent** and reads **execution package**; **TaskExecution** is append-only execution fact.

**Canon boundary:** Exact **job shell timing** relative to sign (implementation) remains **`10-open-canon-decisions.md`** where not inferable from charter alone.

---

## Pre-job work exists and is not runtime execution

**Canon:** Operational work that happens **before** a signed quote — site surveys, utility checks, feasibility reviews, photo requests — is **real work** performed by field or office staff. It is **not** activated runtime execution and it must **not** force a fake `Job` into the system.

**Model:** `PreJobTask` anchored to a **FlowGroup** (project site). Field workers see pre-job tasks in the **Work Station** with a `PRE_JOB` badge. Evidence captured during pre-job work (photos, measurements, structured inputs) feeds the **Quote Editor** directly.

**Boundary:** `Job` exists **only** after activation of a signed quote. Pre-job work stays attached to the `FlowGroup` as historical evidence.

**What not to do:** Create a Job to track a site survey. Store survey measurements as unstructured Notes. Force pre-job work into the Lead object (leads are person-centric, not site-centric).

---

## Reuse philosophy: curated libraries, not dumping grounds

**Canon:** Struxient v3 separates **curated reusable intelligence** from **project-specific one-off work**:

- **Task definitions** are curated reusable work intelligence (instructions, labor hints, evidence expectations). They are **building blocks for packets and workflow structure**, not a dumping ground for random one-off job tasks.
- **Scope packets** are curated reusable scope structures (trade SKUs). Estimators primarily reuse packets, not isolated tasks.
- **One-off work stays local by default.** Quote-local modifications and AI-drafted scope live as `QuoteLocalPacket` objects tied to the quote, not in the global library.
- **Promotion to library is explicit and human-reviewed.** Estimators can request promotion; admins review and publish.
- **Runtime actuals feed learning signals, not automatic library mutation.** Observed job data can propose updates to library defaults, but never silently overwrites curated catalog truth.

---

## Summary answers (charter checklist)

| Question | Canon answer |
|----------|--------------|
| What is v3 centered on? | **Trade-first quote-to-execution** with **line items** + **scope packets** + **FlowSpec skeleton**. |
| Primary reusable trade scope? | **Scope packet** (catalog). |
| Primary sales-facing object? | **Quote line item**. |
| Primary process structure? | **FlowSpec / nodes** (template). |
| Where does scope meet process? | **Freeze** (plan + execution package) → **activation** (flow + runtime instances). |
