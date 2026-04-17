# Decision: Scheduling authority (Struxient v3)

## 1. Decision statement

**Decision:** For **v3 MVP**, scheduling is **non-authoritative planning intent** only: **calendar and schedule blocks do not gate FlowSpec task start**. A **later phase** (explicitly versioned product capability) may introduce **optional enforcement** limited to **`COMMITTED`** schedule blocks only, wired into the **same** start-eligibility pipeline used for holds and payment.

**Canon boundary:** This **closes** the v2 **split-brain** pattern where UI could imply scheduling mattered while **`evaluateFlowSpecTaskStartEligibility`** explicitly **deferred** scheduling (`SCHEDULING_DEFERRED_NOTE`).

---

## 2. Why this decision matters

**Evidence:** v2 persists **`ScheduleBlock`** (with `ScheduleTimeClass`: COMMITTED, PLANNED, REQUESTED, SUGGESTED), **`ScheduleChangeRequest`**, and **`RuntimeTask.scheduledStartAt`/`scheduledEndAt`** (schema comment: **not** execution truth), while **centralized start eligibility does not evaluate scheduling** (`08-scheduling-time-horizon.md`, `07-readiness-blockers-holds-detours.md`).

Without a **normative v3 rule**, teams will repeat **ambiguous authority**: crews see a “scheduled” badge but can start, or office believes work is locked when the engine allows it — violating **locked canon** item **10** (ban **split-brain scheduling ambiguity**).

---

## 3. v2 evidence

**Evidence**

- **`evaluateFlowSpecTaskStartEligibility`:** scheduling policy **deferred**; not evaluated in Phase 1 note — **proven** in reverse-engineering doc 08.
- **`ScheduleBlock`:** optional `taskId`, `flowId`, `jobId`; **append-only** history via `supersededAt` — **proven** schema.
- **`RuntimeTask` schedule fields:** “User commitment overlay only — not execution truth” — **proven** schema comment.
- **Pain doc §11.3:** scheduling vs start eligibility split called **medium-high** severity.

---

## 4. Options considered

| Option | Description |
|--------|-------------|
| **A — Full enforcement** | Any `ScheduleBlock` (or selected classes) **blocks start** until window/time rules satisfied. |
| **B — Intent only (MVP)** | Scheduling is **visibility + planning**; **never** blocks start until a **later** explicit capability ships. |
| **C — COMMITTED-only enforcement (day one)** | Only **`COMMITTED`** blocks participate in start eligibility; other classes remain intent. |

---

## 5. Recommended decision

**Recommendation:** **Option B for v3 MVP**, with **Option C** specified as the **only** allowed **future enforcement shape** (no ad-hoc per-tenant rules without a written policy).

---

## 6. Rationale

**Rationale**

1. **Honesty:** Matches **actual** v2 engine behavior today for start — avoids **lying** in UX while MVP ships.  
2. **Canon compliance:** **Split-brain** is banned; **explicit** “calendar does not gate start” is **one coherent story**.  
3. **Trade-first MVP:** Fast quote-to-execution and mobile continuity **do not require** calendar enforcement on day one; **permits/holds** already cover many real blockers (`07`).  
4. **Future path:** **`COMMITTED`** already exists as a **semantic hook** for “this time is real” without inventing a third boolean.

---

## 7. What this enables

**Consequence**

- Office can **plan** crews and show **lenses** without blocking field **truth** engine.  
- **Single sentence** for support/docs: **“Starting work follows FlowSpec + holds + payment + structured-input readiness — not the calendar (MVP).”**  
- **Clear product milestone** to add **`enforceCommittedScheduleBlocks`** (tenant or company flag) that **only** reads **COMMITTED** rows and **only** affects **start eligibility** (not completion).

---

## 8. What this forbids

**What not to do**

- **Imply** in UI, marketing, or training that **being on the calendar** **prevents** or **allows** **start** in MVP.  
- Add **silent** enforcement in a **non-central** route while **main** eligibility **ignores** schedule.  
- Use **`RuntimeTask.scheduledStartAt`** as **enforcement source** without **first** promoting a **`COMMITTED`** `ScheduleBlock` policy (if ever).  
- Treat **REQUESTED/SUGGESTED/PLANNED** as **hard gates** in any phase without **new canon review**.

---

## 9. Risks / tradeoffs

**Risks**

- **Discipline-heavy** contractors may **want** enforcement immediately — **mitigation:** phase flag + **COMMITTED** semantics.  
- **Double booking** is possible in MVP — **acceptable** for wedge; **capacity** views remain **advisory**.

---

## 10. MVP blocker status

**MVP blocker status:** **Not a blocker** to begin **schema / implementation planning** for **core quote-to-execution**. It **is** a **blocker** for **shipping** a product **claim** “scheduling controls start” until **Phase C (COMMITTED enforcement)** is implemented **and** documented.

---

## 11. Follow-on implementation consequences

**Consequence**

- **MVP:** Start-eligibility module **documents** scheduling as **out of scope**; calendar APIs **do not** call into eligibility.  
- **UX copy** on calendar surfaces: **“Planning only — does not block task start.”**  
- **Phase 2:** One function branch: **`if (tenant.enforceCommittedScheduleBlocks)`** → evaluate **COMMITTED** blocks overlapping **now** for **effective task id** / **node** scope per block’s `taskId` / `flowId`.

---

## 12. Still-open subquestions

**Open subquestion**

- **Granularity** when enforcement ships: block by **`taskId` only** vs **node-level** default when `taskId` null — **implementation detail** at build time.  
- **Timezone** source of truth for enforcement window — **already** `Company.planningTimeZone` in v2; **reuse** unless canon updates.

**None of these block** the **scheduling authority** decision itself.
