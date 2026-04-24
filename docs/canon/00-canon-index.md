# Struxient v3 — Canon index

**Status:** Normative product/architecture canon for Struxient v3.  
**Supersedes for “what v3 is”:** Foundation docs (`../foundation/`) are exploratory synthesis; **this folder is authoritative** for v3 structure until revised by explicit canon change.

---

## How to use this documentation set

| Layer | Location | Role |
|-------|----------|------|
| **Canon (normative)** | `Struxient_v3/docs/canon/*.md` | What v3 **is**, **must do**, and **must not repeat** from v2. Use for implementation prompts, reviews, and stakeholder alignment. |
| **Foundation (descriptive)** | `Struxient_v3/docs/foundation/*.md` | How v2 evidence + locked assumptions were **reasoned into** v3 shape. Historical reasoning; defer to canon when they differ. |
| **Research / reverse-engineering** | `docs/v3-research/*`, `docs/reverse-engineering/2026-04-10-struxient-v2/*` | **Evidence** and v2 behavior inventory. Not normative for v3. |

**Canon boundary:** Canon defines **concepts, ownership, and pipeline semantics**. It does **not** define Prisma tables, routes, or migration steps unless a doc explicitly notes a conceptual anchor.

---

## What is locked (inputs — do not reopen without new stakeholder instruction)

These are **canon inputs**, listed in charter and foundation; individual canon docs apply them:

1. Trade-first v3 wedge, not full-home-first.  
2. Not raw-task-first.  
3. Line-item-fronted, packet-driven, task-definition-supported.  
4. Whole-job workflow = **process structure**, not main reusable trade scope.  
5. Quote-selected scope determines what **manifest work** exists.  
6. Reusable packet task lines carry **default node placement**.  
7. Activation populates **stable node-based process**; **default** is not per-job manual workflow authoring.  
8. FlowSpec = **stable process skeleton / node-and-routing framework** populated from quote at activation.  
9. Market tools do not define canon.  
10. AI exists in v2 as **capability to evaluate**; not automatic canon without human commit rules.  
11. Working mnemonic: **line items sell · packets compose · tasks know · nodes structure · runtime executes**.
12. Pre-job **human operational work** on the site/project lives on the FlowGroup as `PreJobTask`, not as a fake Job — **narrow use** is fine; **do not** use `PreJobTask` as the bucket for **record completeness** or **missing CRM fields** (readiness stays on the owning record; see `02-core-primitives.md`).
13. Quote-local packet modifications and AI-drafted scope start as `QuoteLocalPacket` — local to the quote, not in the global library until explicitly promoted.
14. The task and packet libraries are **curated reusable intelligence**, not dumping grounds. One-off work stays local. Runtime actuals feed learning suggestions, not automatic library mutation.

---

## What remains open

See **`10-open-canon-decisions.md`** for the **minimal** remaining list after this canon closes everything evidence and locked assumptions allow.

---

## Canon documents

| Doc | Purpose |
|-----|---------|
| `01-v3-core-thesis.md` | What v3 is and is not; trade-first center; FlowSpec repositioning; mission. |
| `02-core-primitives.md` | Definitions, ownership, and non-collapse rules for each major object. |
| `03-quote-to-execution-canon.md` | End-to-end pipeline: entry → freeze → sign → activation → mutability → CO/detours/holds. |
| `04-task-identity-and-behavior.md` | Closed vocabulary for all “task-like” layers; banned loose usage. |
| `05-packet-canon.md` | Scope packets as primary reusable trade scope; tiers, definitions, AI, naming. |
| `06-node-and-flowspec-canon.md` | Nodes, FlowSpec, skeleton tasks, population at activation, detours, no workflow-first sales. |
| `07-time-cost-and-actuals-canon.md` | Estimates vs price vs actuals vs learning; what belongs where. |
| `08-ai-assistance-canon.md` | What AI may draft; commit boundary before freeze/activation truth. |
| `09-banned-v2-drift-patterns.md` | Hard bans on repeating v2 confusion and bridges. |
| `10-open-canon-decisions.md` | Narrowed open decisions only; MVP vs defer. |

---

## Reading order

1. `01-v3-core-thesis.md`  
2. `02-core-primitives.md`  
3. `03-quote-to-execution-canon.md`  
4. `04-task-identity-and-behavior.md`  
5. `05-packet-canon.md` + `06-node-and-flowspec-canon.md`  
6. `07-time-cost-and-actuals-canon.md` + `08-ai-assistance-canon.md`  
7. `09-banned-v2-drift-patterns.md`  
8. `10-open-canon-decisions.md`

---

## Canonical one-paragraph model

Struxient v3 is a **trade-first quote-to-execution system** where **quote line items** are the primary **sales-facing** unit: each scope-bearing line attaches to a reusable **scope packet** (catalog composition of **packet task lines** with default **node** placement, optionally backed by **task definitions** for shared work intelligence). When estimators or AI modify task structure for a specific project, the system creates a **quote-local packet** (QuoteLocalPacket) — a project-scoped fork that keeps the curated library clean; useful local patterns can be **promoted** to the global library through explicit admin review. Optional **pre-job tasks** (`PreJobTask`) on the **FlowGroup** capture **real human site/project operational work** before activation (surveys, checks, access visits — **not** generic “fill missing fields” readiness); they never substitute for a **Job** and remain **separate** from the execution graph. **Current builds** may expose them as **read-only visibility** only until optional lifecycle/evidence work ships. A **process template** (FlowSpec: published **nodes**, **gates**, **skeleton tasks**) provides the **railway** for every job of that type — not the catalog of what was sold. At **send**, the system **freezes** commercial truth together with a deterministic **generated plan** and **execution package** that zips **sold scope** into that skeleton. After **customer sign**, **activation** creates the **job execution binding** (pinned workflow version + **flow**) and **instantiates manifest work** as **runtime task instances** on the correct nodes while **skeleton tasks** remain in the immutable snapshot; **append-only execution truth** (starts, outcomes, evidence) lives in the runtime layer, separate from quote truth. **Holds** and **payment** block **start** without mutating graph truth; **detours** model corrections and loopbacks; **cost/actual events** observe money and time after the fact. **AI** may **draft** catalog or quote content — always as **QuoteLocalPacket** during quoting — but **never** becomes freeze or activation truth without an explicit **human commit** step. Runtime actuals feed learning signals but never silently overwrite curated library truth.

---

## Three biggest v2 mistakes we are not repeating

1. **Collapsed “task” vocabulary** — Using one word for catalog meaning, workflow spec, plan rows, package slots, runtime rows, and legacy job tasks. **v3 canon** uses **distinct terms** (see `04-task-identity-and-behavior.md`).

2. **Workflow-first or raw-task-first selling** — Letting process graphs or atomic task libraries become the **primary** way estimators define **trade scope**. **v3** centers **line items + scope packets**; FlowSpec is **skeleton**, not SKU catalog.

3. **Legacy bridges and split-brain truth** — **JobTask**-style execution primitives, **string-matched** payment mapping, **dual progress** math, and **scheduling that implies enforcement** without start eligibility alignment. **v3** bans these patterns (`09-banned-v2-drift-patterns.md`) and requires **one progress story** and **stable id** discipline for money and gates.
