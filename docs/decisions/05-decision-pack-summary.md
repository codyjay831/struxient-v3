# Decision pack summary — scheduling, payment mapping, inspection, job timing

**Purpose:** Close **high-ambiguity** items that **blocked** clean **schema / implementation planning** for Struxient v3. **Sources:** v3 canon (`../canon/`), foundation, reverse-engineering docs, selective v2 code (activation, schema, eligibility notes).

---

## 1. Scheduling authority (`01-scheduling-authority-decision.md`)

**What was decided**

- **MVP:** Scheduling is **non-authoritative intent** only — **does not** gate **task start** in **central eligibility**.  
- **UX/product truth:** Calendar is **planning visibility**, not **permission** to start (until a **future** **optional** **`COMMITTED`-only** enforcement phase is **explicitly** shipped).

**What remains open**

- **When** to ship **COMMITTED** enforcement and **granularity** (task vs node) — **phase** decision, **not** ambiguity on MVP behavior.  
- **Timezone** edge cases — **implementation**.

**MVP blocker?** **No** for **core** execution planning; **Yes** if product **claims** calendar enforcement **without** building **Phase C**.

---

## 2. Payment / hold / task-ID mapping (`02-payment-hold-task-id-mapping-decision.md`)

**What was decided**

- **Gates** reference **`skeletonTaskId` and/or `runtimeTaskId`** (or **unified `executableTaskId` + kind**) — **same ids** as **`TaskExecution.taskId`** space.  
- **No** string **name** bridge; **no** **new** **JobTask** dependencies for **v3-native** payment.  
- **Holds** + **`HoldType.PAYMENT`** stay **conceptually** linked to **`PaymentGate`** via **`paymentGateId`**.

**What remains open**

- **ALL vs ANY** task satisfaction for **multi-target** gates.  
- **Pre-activation** deposit **targets** when **runtime ids** do not exist yet — **business** rule (skeleton-only vs post-activation gate creation).

**MVP blocker?** **Yes** if **payment-before-work** is **in** MVP **scope** — **schema** for **`PaymentGate*`** must follow this mapping.

---

## 3. Inspection model (`03-inspection-model-decision.md`)

**What was decided**

- **No parallel `InspectionCheckpoint` progression truth** for **v3-native** jobs.  
- **Inspection** that **gates** progression = **FlowSpec tasks** + **outcomes** + **evidence** + **detours** for **fail/rework**.  
- **Packet** inspection definitions **materialize** as **manifest** (default) **executable** units on the **appropriate node** at **freeze/activation**.

**What remains open**

- **One task per checkpoint** vs **structured sub-checklist** — **UX**.  
- **Legacy** **dual-read** migration duration.

**MVP blocker?** **Yes** for **inspection-heavy** trades **before** **activation** payload design — **direction** is now **fixed**.

---

## 4. Job anchor timing (`04-job-anchor-timing-decision.md`)

**What was decided**

- **Job** = **business anchor**; **Activation** = **execution birth** (Flow + manifest).  
- **Default:** **Job ensured by sign** (policy may defer **only** when **no** pre-activation **job-scoped** features).  
- **Activation** always **idempotent job reuse** for **flow group** — **never** duplicate job.

**What remains open**

- **Company flag** default (`createJobOnSign`) — **GTM**.  
- **Void** semantics for signed-then-cancelled — **ops**.

**MVP blocker?** **Yes** — **ordering** of **sign**, **job**, **payment gates**, **activation** must be **implemented** consistently.

---

## 5. What still blocks schema / implementation planning (outside this pack)

This pack **does not** resolve:

- **Multi-flow / fan-out** MVP scope (`canon/10` **O2**).  
- **InstallItem** requirement (`O4`).  
- **Freeze storage** normalization vs JSON (`O12`).  
- **Portal** structured-input depth (`O17`).  
- **Signature** provider parity (`O16`).  
- **Learning / GL** depth (`O15`).  
- **FlowGroup vs Lead** canonical identity (`O7`) — **medium**.

These are **smaller** than the **four** **ambiguity** axes **this pack** closed for **core** **quote → execute** **integrity**.

---

## 6. Is the project ready to move into schema / implementation planning?

**Decision:** **Yes**, for the **trade-first quote-to-execution core**, **provided**:

1. **This pack** is **accepted** as **normative** alongside **existing canon**.  
2. **Payment gating** either **follows** **`02`** in **MVP** or **is explicitly deferred** (rare).  
3. **Inspection-heavy** MVP **commits** to **`03`** (folded model) **or** documents **legacy read** exception **only** for **migration**.

**If** **multi-flow** or **install item** **complexity** is **day-one** **required**, **spike** those **before** **locking** **schema** — they are **not** **reopened** by this pack but **remain** **canon** **open** items.

---

## Recommended next phase

**Recommendation:** **Schema planning** — **next**.

**Why:** The **four** decisions **that most often poisoned** v2 **design discussions** (**scheduling split-brain**, **payment identity**, **inspection dual truth**, **job vs activation timing**) are **now** **decided** enough to **derive**:

- **start-eligibility** contract (scheduling **explicitly** out for MVP),  
- **`PaymentGate*` / `Hold`** shapes (**executable id** targets),  
- **activation** outputs (**no** parallel inspection table for **new** jobs),  
- **sign/activate** orchestration (**job** at **sign** default, **reuse** at **activation**).

**Implementation planning** (sprints, routes) should **immediately follow** **schema** sketches so **IDs** and **transactions** match **this pack**.

**Another decision pack** is **only** needed **if** stakeholders **reject** one of **`01–04`** or **elevate** **multi-flow**, **portal**, or **accounting** to **blocking** **before** **schema** — **not** as a **default** **next** step.

---

## Canon note (no silent rewrite)

**No contradiction** found between this pack and **`Struxient_v3/docs/canon/*`**. **`10-open-canon-decisions.md`** items **O5, O6, O8, O3, O1** are **substantially narrowed** here; **update** **`10`** in a **future** **canon maintenance** pass to **reference** **`docs/decisions/01–04`** as **resolved** ( **out of scope** for this task per user instruction to **not rewrite canon** unless **serious** contradiction — **none** found).
