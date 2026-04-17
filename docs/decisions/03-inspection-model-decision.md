# Decision: Inspection model (Struxient v3)

## 1. Decision statement

**Decision:** For **v3-native jobs**, **inspection is not a parallel state machine**. **Pass/fail inspection outcomes that gate progression** are modeled **only** through **FlowSpec**: **nodes**, **skeleton and/or manifest tasks**, **`TaskExecution` outcomes**, **evidence attachments**, and **`DetourRecord`** for **failure / rework loopbacks**.

**Scope packet** **inspection checkpoint definitions** (v2: `inspectionCheckpoints` on bundle) **materialize at freeze** into **deterministic executable units** on the **appropriate node** — **prefer** **`PlanTaskV1` / package slots** that **activate** as **`RuntimeTask` instances** (or attach to **skeleton** tasks only if explicitly authored as **template** inspection steps). **Default:** **manifest inspection tasks** from **packet** so **inspection depth** varies by **tier** without editing the **process template** per SKU.

**Separate `InspectionCheckpoint` table** (or equivalent) is **not** used for **new** v3-native progression truth; **legacy** rows remain **read/migrate** only.

---

## 2. Why this decision matters

**Evidence:** v2 runs **`InspectionCheckpoint`** with its **own status enum** **parallel** to FlowSpec (`07` bolt-on table, pain doc §11.7). That creates **drift**: “inspection passed” vs “inspection node complete” can disagree.

**Trade-first** crews need **one** place to **complete** work and **one** **correction** story (**detours**). **Reporting** should **aggregate** from **execution truth**, not **merge** two hierarchies.

---

## 3. v2 evidence

**Evidence**

- **`InspectionCheckpoint`:** job-scoped, **LOCKED → … → PASS/FAIL**; optional deprecated **`jobTaskId`** — **proven** domain inventory.  
- **Activation:** creates checkpoints from **`generatedPlan.checkpoints`** — **proven** quote-to-execution doc 03.  
- **Detours:** **blocking** detours **obstruct** downstream; **checkpoint** tasks get **actionability exceptions** — **proven** `05-node-stage-workflow-deep-dive.md`.  
- **Packet checkpoints:** defined on **BundleTemplate** — **proven** bundles.

---

## 4. Options considered

| Option | Description |
|--------|-------------|
| **A — Parallel model (v2)** | Keep **InspectionCheckpoint** as **separate** truth for inspections. |
| **B — Full fold** | Only **skeleton** template tasks; **packet** cannot add inspection steps without **template** change. |
| **C — Fold progression; packet manifests inspection tasks** | **Freeze** turns packet checkpoint defs into **plan/package tasks** → **runtime instances** on **INSPECTION** (or relevant) **node**; **failures** → **detours** / outcomes. |

---

## 5. Recommended decision

**Recommendation:** **Option C.**

---

## 6. Rationale

**Rationale**

1. **Single progression truth** — aligns with **canon** FlowSpec as **skeleton + execution physics**.  
2. **Trade-first:** **Tiers** change **how many** inspections / which **checklist** without **per-job workflow** authoring.  
3. **Correction loops:** **FAIL** outcome + **detour** (or **gate** to rework node) **reuses** proven **DetourRecord** mechanics instead of **forking** inspection state.  
4. **Reporting:** **Query `TaskExecution` + evidence** by **node**, **packet provenance**, **line item** metadata on **runtime** tasks.  
5. **Implementation cleanliness:** **Drops** dual-write between **checkpoint** table and **task execution**.

---

## 7. What this enables

**Consequence**

- **AHJ rough / final** → **two manifest tasks** or **two nodes** — **product** choice on **template shape**; both live in **FlowSpec**.  
- **Quote freeze** carries **which** inspection tasks exist (from **packet**).  
- **Mobile** sees **one** **work list** per node.

---

## 8. What this forbids

**What not to do**

- **New** **parallel** “inspection done” flag that **contradicts** **node completion** without **explicit** sync contract.  
- **Hidden** inspection state **outside** **TaskExecution** for **gating**.  
- **Workflow-first** fix: **adding** inspection only by **editing graph** when **packet tier** should have carried it.

---

## 9. Risks / tradeoffs

**Risks**

- **Migration** from **`InspectionCheckpoint`** rows for **existing** jobs — **needs** one-time **bridge** or **dual-read** window (**legacy** only).  
- **Regulatory** wording may expect “inspection record” — **mitigation:** **evidence attachments + execution record** **are** the **record**; export/report **views** can still say “Inspection.”

---

## 10. MVP blocker status

**MVP blocker status:** **Yes** if target trades **require** inspection gating on **day one** — you must **pick** this before **activation** payload design. **Decision itself** removes ambiguity: **build** toward **folded** model, **not** parallel.

---

## 11. Follow-on implementation consequences

**Consequence**

- **Activation:** **stop** creating **free-floating** `InspectionCheckpoint` rows for **v3**; **instead** ensure **packet checkpoints** are **already** **plan tasks** with **node placement** (or **expand** checkpoint defs into **plan tasks** at **computeGeneratedPlan** / freeze).  
- **Templates:** include **INSPECTION** (or similar) **node** with **completion rule** matching **product**.  
- **Failure path:** **product** canon for **FAIL** → **detour** vs **outcome routes** to **rework node** — **detour** is **default** for **ad hoc** AHJ failures.

---

## 12. Still-open subquestions

**Open subquestion**

- **Exact** mapping: one **checkpoint def** → one **runtime task** vs **one task with structured checklist** — **UX** detail.  
- **Pass** that **does not** block **node** (informational only) — use **`required` false** runtime tasks + **completion rule** OR **separate** **evidence-only** subflow — **implementation**.

**Neither** reopens the **primary** decision: **no parallel inspection state machine** for v3-native jobs.
