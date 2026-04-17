# Time, cost, and learning — v3 structural foundation (from v2)

**Labels:** **Proven from code** · **Strong inference** · **Working v3 interpretation** · **Unclear / needs canon decision**

This maps **estimates, pricing, actuals, and learning** to the **right objects** so v3 does not collapse them into one overloaded “task.”

---

## 1. Where time lives today (v2 evidence)

| Layer | Fields / behavior | Evidence |
|-------|-------------------|----------|
| **Task definition** | `estimatedMinutes`, `recommendedCrewSize` | Schema `TaskDefinition` |
| **Packet line / resolved bundle task** | Same fields can appear on embedded lines or merge from definition | `BundleTaskDefinition` in `types.ts`, resolver |
| **Plan aggregate** | `totalElapsedMinutes`, `totalLaborMinutes`, `peakCrewSize` | `GeneratedJobPlanV1` — **Proven** `computeGeneratedPlan` rolls up |
| **Package summary** | Echoes plan labor rollup | `ExecutionPackageV1.summary` — **Proven** `composer.ts` |
| **Runtime task** | No native “actual duration” field cited in foundation skim | **Unclear** — duration truth likely in **TaskExecution** timestamps (**Strong inference** — needs code canon). |
| **Task execution** | `startedAt`, `outcomeAt` etc. | Append-only execution truth — **Proven** schema comments in reverse-engineering |
| **Schedule** | `ScheduleBlock` times; `RuntimeTask.scheduledStartAt/EndAt` “overlay only” | **Proven** schema comment in `08-scheduling-time-horizon.md` |

---

## 2. v3 placement rules (working interpretation)

### 2.1 Task definition — **estimates as reusable defaults**

**Should own:** **Typical** duration and crew size **per unit of work** as authored in library; **not** job-specific actuals.

**Must not own:** **Sold quantity** or **line pricing**.

### 2.2 Scope packet — **rolled-up defaults for the SKU**

**Should own:** **Packet-level** defaults when the same estimate applies to **the whole tier**; **composition** of line-level defaults.

**Must not own:** **Actuals** or **customer-specific** adjustments (those are **quote overlay** or **runtime**).

### 2.3 Quote line item — **commercial time-to-money (indirect)**

**Should own:** **Price** fields (`unitCost`, `markup`, `total`, `quantity`) — **Proven** `QuoteLineItem`.

**Working v3 interpretation:** **Labor hours sold** may be **derived** from plan totals for **margin math**, but **line item** remains **commercial** authority for **what customer pays**, not **field truth**.

**Must not own:** **Field completion** state.

### 2.4 Plan / execution package — **frozen rollups for that quote version**

**Should own:** **Snapshot** of **estimated** effort used for **proposal integrity** and **capacity preview** at send.

**Must not own:** **Post-send edits** without new version / formal patch rules.

### 2.5 Runtime task + task execution — **actual work interval truth**

**Should own:** **When work actually started/ended** at **execution** granularity — **Strong inference:** derive from **`TaskExecution`** rows (and engine rules), not from `RuntimeTask` schedule hints.

**Must not own:** **Quote pricing**.

### 2.6 Schedule objects — **intent vs commit (must pick)**

**Proven from code:** Start eligibility **does not** evaluate scheduling (`task-start-eligibility.ts` note).

**Working v3 interpretation:**

- If **calendar = commit:** scheduling **must** participate in **start** (or a parallel **hard gate**).  
- If **calendar = intent:** rename surfaces to avoid “blocked” confusion; **do not** imply enforcement.

### 2.7 Cost / actual events — **observation layer**

**Proven from code:** `CostEvent` append-only; optional links to job/flow/task execution (`02-domain-model-inventory.md`).

**Should own:** **Incurred cost** observations (labor override, material actual, etc. per costing epic direction).

**Must not own:** **Sold price** or **workflow structure**.

### 2.8 Learning — **downstream analytics**

**Proven from code:** `LearningEvidence`, `LearningSuggestion` — reviewable suggestions (`10-automation-ai-inventory.md`).

**Should own:** **Patterns** for **tuning** packet defaults or definitions after enough signal.

**Must not own:** **Execution truth** directly.

---

## 3. Variance model (conceptual)

**Working v3 interpretation:**

```
frozen_estimate (plan/package at send)
        vs
derived_actual (TaskExecution intervals + CostEvent + material actuals)
        →
variance attributed to { packet, task definition, line item, node?, crew? }
```

**Unclear / needs canon decision:** **Attribution keys** (single primary vs multi-factor) and **when** variance is **visible** (job closeout only vs live).

---

## 4. Bid accuracy improving over time

**Proven from code:** Learning tables and dismiss/defer flows exist; not required on activation hot path.

**Working v3 interpretation:**

1. **Capture** actuals reliably (**CostEvent** + **execution timestamps**).  
2. **Aggregate** by **packet** and **task definition** (and maybe **trade** + **region** metadata).  
3. **Suggest** updates to **packet defaults** or **definitions** through **human-approved** workflow — **optional** module.

**Do not** silently change **frozen** quotes or **published** templates from learning without audit (**Working v3 interpretation**).

---

## 5. Evidence (photos/docs) vs cost

**Proven from code:** `EvidenceAttachment` ties to **task** execution truth; separate from `CostEvent`.

**Working v3 interpretation:** **Evidence** proves **work quality/compliance**; **cost events** prove **money/time** — correlate in **analytics**, don’t merge tables blindly.

---

## 6. Summary table

| Concept | Task definition | Packet | Line item | Plan/package | Runtime / execution | CostEvent | Learning |
|---------|-----------------|--------|-----------|--------------|---------------------|-----------|----------|
| **Default estimate** | ✓ primary | ✓ compose | — | frozen copy | — | — | reads |
| **Sold price** | — | — | ✓ primary | snapshot echo | — | — | — |
| **Actual duration** | — | — | — | — | ✓ truth | — | reads |
| **Actual cost** | — | — | — | — | optional link | ✓ primary | reads |
| **Calendar** | — | — | — | — | overlay / block | — | — |

---

## See also

- `03-object-boundaries.md`  
- `05-trade-first-foundation.md`  
- Reverse-engineering `08-scheduling-time-horizon.md`
