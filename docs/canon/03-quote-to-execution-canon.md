# Struxient v3 — Quote-to-execution canon

**Canon:** Normative pipeline from **work entering the system** through **freeze**, **sign**, **activation**, and **post-activation mutability**.

---

## How work enters the system

**Canon**

### Pre-job operational work (before quoting)

**PreJobTask** records anchored to a **FlowGroup** capture **real human operational work on the site/project** that happens **before** sign/activation — site surveys, utility checks, feasibility reconnaissance, access-coordination visits, and similar **dispatchable** work. They do **not** create a `Job` or enter the **execution graph** (`planTaskId` / manifest / `TaskExecution` universe). See `02-core-primitives.md` for the full boundary (**including what must not become a PreJobTask**: record completeness and generic readiness debt stay on the **owning record**, not as automatic PreJobTasks).

**Honest product slice:** Today the codebase exposes **schema + read-only visibility** (quote workspace + global work feed); full lifecycle authoring, start/complete APIs, and normalized pre-job evidence are **optional later** — canon does **not** require shipping them immediately to keep `PreJobTask` valid.

**Directional (when built):** Evidence and structured capture for pre-quote site work should **inform** quoting; until dedicated pre-job evidence tables exist, avoid implying every photo or measurement lives on the `PreJobTask` row itself.

### Quote-time scope entry

1. **Catalog-driven lines** — Primary path: pick **scope packet** + tier → line row.  
2. **Manual / office-authored line items** — User creates **quote line items**; scope-bearing lines **attach** to a **scope packet** identity + **tier** (and quantity).  
3. **AI-assisted drafts** — May propose **packet content**, **lines**, or **structured inputs**; **never** freeze truth until **human commit** (`08-ai-assistance-canon.md`). All AI-drafted scope starts as a **QuoteLocalPacket** (local to the quote, not in the global library).
4. **Quote-local packet forks** — When an estimator modifies the task structure (add/remove/reorder tasks) of a library packet on a specific quote, the system creates a **QuoteLocalPacket** as a deep copy. The `QuoteLineItem` switches its reference from the library revision to the local packet. Minor overrides (quantity, price, description) remain on the `QuoteLineItem` and do **not** trigger a fork.
5. **Rules-generated scope (assembly path)** — **Secondary**: declarative rules may **emit plan tasks** into draft/freeze with provenance; **default** quoting path remains **packet-on-line-item** (`05-packet-canon.md`).

**Rationale from v2 evidence:** `AddLineItemDialog` is bundleKey+tier; assemblies merge `assemblyTasks` overlay; AI routes exist as drafts.

**What not to do:** Do not treat **workflow editing** as the **primary** intake for **what was sold**. Do not allow AI to create global library packets without explicit human promotion and admin review.

---

## What line items are allowed to be

**Canon**

- **Scope lines:** Reference a **scope packet** + **tier** (when execution-generating mode) and carry **commercial fields**.  
- **Non-executing lines:** Allowed (e.g. fee, artifact-only) **without** manifest task generation, per **execution mode** policy.  
- **Quantity:** Expands **manifest work** deterministically (same packet × N → repeated plan tasks per canon rules).

**Does not allow:** A scope line that **silently** invents **unbounded ad-hoc graph structure** without going through **packet**, **manual plan task**, or **approved rules (assembly)** paths.

**Rationale from v2 evidence:** `ExecutionMode` + `computeGeneratedPlan` quantity loops.

---

## How packets attach

**Canon:** **Line item** holds **which scope packet** (stable catalog key + tier resolution) applies to that **sold row**. **Packet task lines** define **default node placement**; **freeze** expands into **plan** and **execution package** against the **selected process template** for that quote version.

**Must not collapse into:** “Workflow defines SKUs.”

---

## What freezes at send

**Canon:** **Send** is the **scope + process-bind freeze** for that **quote version** (in addition to customer-facing proposal payload):

- **Commercial snapshot** of line items (for customer + audit).  
- **Generated plan** — deterministic expansion of **line items × packets × quantity** plus **draft overlays** (exclusions, manual plan tasks, instruction overrides, structured input answers, rules-generated tasks if present).  
- **Execution package** — **node-aligned** merge of **frozen plan tasks** into the **chosen published process template** (skeleton), with **compose-time** warnings/errors recorded.  
- **Process template identity** pinned for composition (which **workflow template / published version** was used).

**Rationale from v2 evidence:** `send/route.ts` computes plan, merges overlay, composes package, writes `QuoteVersion.snapshot`; immutability after send for that version’s core freeze.

**Canon boundary:** **Storage shape** (one JSON blob vs normalized tables) is **implementation** — **semantic freeze** is canon.

**What not to do:** Treat send as “email only” without **execution package** integrity when **activation** depends on it.

---

## What happens at sign

**Canon:** **Customer sign** (or approved signature path) is the **authorization event** that the **frozen proposal version** is **accepted** for execution binding. It does **not** replace **freeze**: scope and package are already **frozen at send** for that version.

**Rationale from v2 evidence:** Sign route transitions quote status; activate requires **SIGNED**.

**Open question:** Exact **job shell** creation relative to sign vs activation — **`10-open-canon-decisions.md`** (does not change freeze/sign semantics).

---

## What activation does

**Canon:** **Activation** (post-sign, policy-gated):

1. Ensures **target quote version** matches **expected** frozen version.  
2. Creates or reuses **job anchor** per policy (implementation timing **open** where not specified).  
3. Creates **flow** bound to **pinned process template version** consistent with **execution package** composition context.  
4. Creates **runtime task instances** for **manifest** work (**sold scope + manual plan** classification) **on** the **nodes** specified by the **package**.  
5. **Does not** duplicate **skeleton tasks** as manifest runtime instances — skeleton work remains **snapshot tasks** for that flow.  
6. Creates **parallel artifacts** per retained model (e.g. **inspection checkpoints** from frozen plan) if canon/product retains them.  
7. Records **idempotent activation audit**.

**Rationale from v2 evidence:** `activation-from-package.ts` behavior; package required on packaged path.

---

## How runtime work is instantiated

**Canon:** **Runtime task instances** are the **materialized** units of **quote-origin manifest work** (and **manual plan** tasks) on **specific nodes**, with **provenance** to **line/packet** where applicable. **Skeleton tasks** are **not** instantiated this way; they execute as **design-time task ids** in the **bound snapshot**.

**Rationale from v2 evidence:** Injection loop skips **WORKFLOW** source package tasks for `RuntimeTask` creation.

---

## What remains mutable after activation

**Canon**

- **Operational:** **Holds**, **payment** satisfaction, **detours**, **schedule artifacts** (per scheduling canon — see **open decisions** if authority unset).  
- **Scope delta:** **Change orders** (add/remove/supersede) per policy — **not** silent rewrite of **original freeze**; **audit** preserved.  
- **Field overlays:** **Structured input corrections** (clerical/CO-linked) per policy.  
- **Ad-hoc work:** **Runtime-added tasks** under explicit **non-routing-breaking** rules.

**Does not allow:** **Silent edit** of **sent freeze** for that version; corrections require **new version** or **controlled patch** policy if product introduces one.

**Rationale from v2 evidence:** Change orders, `StructuredInputCorrection`, runtime task APIs, holds/detours separate from snapshot mutation.

---

## Where change orders, detours, and holds fit

| Mechanism | Role |
|-----------|------|
| **Change order** | **Scope or task-lineage** change **after** activation (add bundle, remove/supersede task) — **commercial + execution** policy per product. |
| **Detour** | **Correction / loopback** **without** republishing **process template**. |
| **Hold** | **Start-blocking** operational pause **without** mutating graph truth. |

**What not to do:** Use **detours** to replace **formal scope change** when **sold work** truly changes.

---

## End-to-end ordering (canonical)

**Canon:** **Author line items (packets)** → **select process template** for quote version → **send** (**freeze** plan + execution package) → **sign** → **activate** (**flow + runtime instances + audits**) → **execute** under FlowSpec truth + overlays.

**Rationale from v2 evidence:** Packaged hot path in reverse-engineering doc 03.

---

## Charter answers (this doc)

| # | Answer |
|---|--------|
| What freezes at send? | **Commercial line snapshot + generated plan + execution package + template bind used for compose.** |
| What activates at sign/activation? | **Sign** = acceptance; **activation** = **job/flow/runtime instantiation** from **frozen package**. |
| Mutable after activation? | **Ops overlays + CO + corrections + ad-hoc runtime tasks** — **not** silent unfreeze. |
