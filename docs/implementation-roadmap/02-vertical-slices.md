# Struxient v3 — Vertical slices

**Purpose:** Smallest **end-to-end** increments that prove **real integration**, not horizontal layers in isolation.  
**Companion:** `01-v3-build-sequence.md`.

---

## What makes a slice “meaningful”

A slice is **vertical** if it crosses **at least three** of:

- **Data model** (schema)
- **Server behavior** (transaction or engine)
- **Client UI** (or API-only if explicitly internal)
- **Canon constraint** (freeze, identity, activation, eligibility)

**Not** a slice: “create Prisma models for 40 tables” or “build login page alone.”

---

## Catalog of slices (recommended pool)

| ID | Name | End state proven |
|----|------|------------------|
| **V1** | **Composable draft** | Office user can open a **draft** quote version, attach **customer + project**, add **line items** with manifest scope pinned to a **published packet revision** *or* a **quote-local packet** (XOR) and **select a published workflow version**. *(Early demos often use catalog-only lines.)* Persist + reload. |
| **V2** | **Freeze send** | Same draft can run **compose** (dry-run + final), then **Send** atomically creates **immutable** `sent` version with **plan + package** artifacts and **blocks further commercial edits**. |
| **V3** | **Sign + job shell** | Sent version can be **signed** (office path acceptable), producing **signature audit** and **`jobId`** ensured per `decisions/04` default. |
| **V4** | **Activation + manifest rows** | Signed version **activates idempotently**, creating **`flowId`** + **`runtimeTask`** rows for manifest slots **without** instantiating skeleton duplicates (`canon/03`). |
| **V5** | **Execute one manifest task** | Field user can **start + complete** a chosen **`RUNTIME`** task with **`TaskExecution`** rows; eligibility runs **without** scheduling enforcement MVP (`decisions/01`). |
| **V6** | **Execute one skeleton task** | Same for **`SKELETON`** task via tagged ref (`planning/01`) — proves **dual** execution path. |
| **V7** | **Payment gate blocks start** | Gate with **runtime target** blocks start until **payment recorded**; hold release integrates (`decisions/02`, `epics 47–48`). |
| **V8** | **Minimal CO** | Post-activation add/supersede **one** manifest task with audit (`epic 37` minimal). |

---

## First 3 slices to build (decisive recommendation)

### 1) **Build `V2` — Freeze send** *as soon as* a draft can persist lines

**Why first (not V1 alone):** `V1` alone tempts teams to over-build quote UI without ever touching **compose immutability** — the highest-risk canon constraint (`canon/03`, `canon/09#12`). **V2** forces **plan/package IDs**, **transaction boundaries**, and **template/packet alignment** early.

**Prerequisite:** Minimum `V1` capability must exist **inside** the same iteration (same sprint) as `V2` — but **ship criteria** is **V2**, not a perfect quote workspace.

### 2) **`V4` — Activation + manifest rows**

**Why second:** Proves the **bridge** from **freeze** to **runtime** — where v2 historically had **drift** (activation idempotency, skeleton vs manifest duplication). Without `V4`, you only have a fancy PDF machine.

**Prerequisite:** `V3` (sign + job) can be **collapsed into the same delivery** as `V4` if you use an internal **“dev sign”** button — but **production** still needs explicit sign semantics (`epic 13`). **Minimum:** implement **`V3` immediately before `V4`** in the same milestone if staffing is tight.

### 3) **`V5` — Execute one manifest task**

**Why third:** Proves **`TaskExecution`** keyed by **`RUNTIME` + `flowId`**, eligibility composition, and **tagged public contract** (`planning/01`). This is the **first “field truth”** slice.

**Follow immediately with `V6`** (skeleton) in the **next** slice if possible — small incremental cost, huge risk reduction for **payment targeting** and **merged feeds**.

---

## Suggested milestone grouping (pragmatic)

| Milestone | Slices | Demo story |
|-----------|--------|------------|
| **M1: Frozen proposal** | V1 (minimal) + **V2** | “We can send a proposal that freezes scope + package honestly.” |
| **M2: Live job** | **V3** + **V4** | “Signed proposal becomes a job with manifest tasks materialized.” |
| **M3: Field truth** | **V5** (+ **V6** next) | “Crew can complete sold work; system records execution.” |

---

## What to stub inside early slices

- **Proposal PDF:** HTML snapshot or stored JSON only (`epic 12`).
- **Portal:** office sign (`epic 13` / `O16`).
- **Structured inputs:** none or office-only (`O17`).
- **Payment:** skip until **M3** unless your wedge demands it (`planning/06#4`).
- **Scheduling:** no blocks in eligibility (`decisions/01`).

---

## Deferred slices (safe until spine demos)

- **V7** payment gate — unless finance is day-one.
- **V8** CO — after execution stable.
- **Assemblies/AI/portal polish** — accelerators, not spine.
