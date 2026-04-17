# Struxient v3 — Time, cost, and actuals canon

**Canon**

---

## Principle: no single object owns all time/cost truth

**Canon:** **Quote truth**, **catalog defaults**, **freeze rollups**, **execution truth**, and **cost observations** are **different authorities**. **v3 forbids** one row (e.g. “the task”) from becoming the **dumping ground** for **price + estimate + actual duration + GL cost** without explicit layering.

**Rationale from v2 evidence:** Overload caused confusion between `QuoteLineItem`, plan rollups, `TaskDefinition` estimates, `RuntimeTask` schedule overlays, and `CostEvent`.

---

## Where default time estimates live

**Canon**

- **Task definition:** **Typical** duration and crew hints for **reusable meaning** (library defaults).  
- **Packet task line:** **Effective default** for that **packet row** after merge (embedded or definition + overrides).  
- **Frozen plan / execution package:** **Snapshot** of rolled-up **estimates** used for **proposal integrity** and **capacity preview** at send — **not** post-hoc **actuals**.

**Rationale from v2 evidence:** `estimatedMinutes` / `recommendedCrewSize` on definitions and bundle tasks; `GeneratedJobPlanV1` totals.

---

## Where packet-level estimates live

**Canon:** **Authoring time:** on **packet task lines** (and inherited from **task definitions** when referenced). **Freeze time:** reflected in **plan row** and **package slot** metadata as **frozen estimate snapshot**.

**Does not own:** **Actual hours worked** on the job.

---

## Where commercial price lives

**Canon:** **Quote line item** (and **quote-level** adjustments if product supports) owns **what the customer is charged** for that **row**. **Not** owned by **task definition** or **scope packet** template as **authoritative** per-job price.

**Rationale from v2 evidence:** `QuoteLineItem` monetary fields.

---

## Where actual execution time lives

**Canon:** **Authoritative actual duration** is derived from **execution truth** — **start/finish/outcome timestamps** on **TaskExecution** (and engine rules), **not** from **catalog defaults** and **not** from **quote lines**.

**Schedule overlays** (`scheduledStartAt` / calendar blocks) are **planning intent** unless/until **scheduling authority** canon explicitly promotes them (**see open decisions**).

**Rationale from v2 evidence:** Append-only task execution; schema comment that runtime schedule fields are **not** execution truth in v2.

---

## Where actual money / cost observations live

**Canon:** **Cost / actual events** (and future accounting handoff) own **incurred cost** **observations**. They **do not** redefine **sold price**.

**Rationale from v2 evidence:** `CostEvent` append-only in domain inventory.

---

## How variance is understood

**Canon:** **Variance** compares **frozen estimate snapshot** (at send) to **actual execution time** and **cost observations** (and optionally **commercial margin** vs **actual margin** at job level). Attribution may reference **scope packet**, **task definition**, **line item**, **node** — **governance** for auto-updates is **open** (`10-open-canon-decisions.md`).

---

## How future learning flows back

**Canon:** **Learning** consumes **aggregated** actuals + outcomes and may propose **updates** to **task definitions** or **scope packets** — **never** silently rewriting **frozen quotes** or **published templates** without **explicit approval** policy.

**Reuse philosophy:**
- Runtime actuals (observed duration, crew size, material usage) generate **learning signals**.
- Learning signals may propose updates to **task definition** defaults (estimated minutes, crew hints) or **scope packet** content.
- **No automatic library mutation.** Every proposed update requires explicit **admin review and approval** before it changes curated library truth.
- The system may surface suggestions like "Last 10 jobs using packet X averaged 4.2 hours vs the default estimate of 3 hours" — but the admin decides whether to update the library default.
- **QuoteLocalPacket** actuals are especially useful for learning: they capture the estimator's project-specific assumptions alongside the observed outcomes, providing a richer signal than standard library defaults alone.

**Rationale from v2 evidence:** `LearningSuggestion` review flows exist; post-MVP in matrix.

---

## Object that must never become the overloaded source of every kind of truth

**Canon:** **No single “task” record** (of any flavor) may be the **only** place storing **sold price + catalog estimate + actual hours + GL postings**. **Layer explicitly.**

---

## “What belongs where” table (normative)

| Concern | Task definition | Scope packet / packet task line | Line item | Frozen plan / execution package | Skeleton task (template) | Runtime task instance | Execution truth (starts/outcomes) | Cost / actual event |
|---------|-----------------|----------------------------------|-----------|--------------------------------|--------------------------|----------------------|-----------------------------------|---------------------|
| Library default minutes | **Yes** | inherits | — | snapshot copy | optional | — | — | — |
| Placement | **No** | **Yes** | — | snapshot copy | N/A | N/A | — | — |
| Sold customer price | — | — | **Yes** | echo only | — | — | — | — |
| Frozen estimate rollup | — | source | — | **Yes** | — | — | — | — |
| Structural template work | — | — | — | in snapshot | **Yes** | — | executes | — |
| Manifest instance | — | source | provenance | slot | — | **Yes** | executes | optional link |
| Actual duration | — | — | — | — | — | — | **Yes** | — |
| Actual money | — | — | — | — | — | — | — | **Yes** |

---

## What not to do

- Treat **packet defaults** as **crew actuals**.  
- Treat **line item total** as **job cost truth**.  
- Hide **scheduling** as “blocked” in UX when **start eligibility** does not enforce calendar (**until** canon picks authority — **open**).  
- Let **learning** overwrite **freeze** without audit.
