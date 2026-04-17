# Decision: Job anchor timing (Struxient v3)

## 1. Decision statement

**Decision:** The **Job** is a **durable business anchor** (customer, site/flow group, CRM, **payment gates**, reporting) **distinct** from **execution birth**.

**Canonical v3 lifecycle**

1. **Send (freeze):** Quote version is **immutable**; **no Job required** for **core** freeze integrity (v2 ties job to **flowGroup**, not send).  
2. **Sign:** Customer **accepts** frozen terms; **recommended default:** **ensure Job exists** for the **FlowGroup** **by end of sign** (or **first touch** that needs `jobId`) so **PaymentGate** and **job-scoped** reporting have a **stable anchor** **before** field execution.  
3. **Activation:** **Idempotent** **`ensureJob` + reuse`** — **always** the **authoritative** moment that creates **execution Flow** + **runtime manifest** + **activation audit**. **Never** create a **second** Job for the same **FlowGroup**.

**Execution birth** = **Activation** (Flow + manifest + pinned workflow). **Job birth** = **no later than sign** for **payment-enabled** tenants; **may coincide with activation** only if **no job-scoped** artifacts exist **before** activation (minimal MVP variant).

**Concrete primary model (pick one default for v3 product):** **Job created at customer sign** (company policy may **opt** to defer to activation **only** when **no** pre-activation **job-scoped** features are enabled).

---

## 2. Why this decision matters

**Evidence:** v2 **`PaymentGate`** is **`jobId`-scoped** — **proven** schema. **Activation** calls **`createJobWithValidation(..., allowReuse: true)`** — **proven** `activation-from-package.ts`, implying **job may already exist**. **Sign** route **comments** reference **`autoCreateJobOnSignature`** but **signing.ts** only advances **sales flow**; **job** creation may be **downstream** of **sales flow outcomes** or **manual convert** — **ambiguous** for implementers (`04-job-anchor-timing` open item).

**No-double-entry** and **CRM clarity** require **one** **Job id** per **sold project anchor** and **one** **activation** per **quote**.

---

## 3. v2 evidence

**Evidence**

- **`createJobWithValidation` on activation** with **`allowReuse: true`**, **`sourcePath` quote_activation** — **proven**.  
- **`convertSalesFlowToJob`** creates job **idempotently** from **flow group** — **proven** `sales-flow-routing.ts`.  
- **`Job` ↔ `FlowGroup`** 1:1 style relation in domain docs.  
- **Quote** `flowGroupId` **required** for packaged activation — **proven** activation throws without it.

---

## 4. Options considered

| Option | Description |
|--------|-------------|
| **A — Job only at activation** | First **materialize** Job when **activate**; **nothing** job-scoped **before**. |
| **B — Job at sign (default)** | **Sign** **ensures** Job shell; **activation** **reuses**. |
| **C — Job at send** | Create Job when **proposal sent** — **early**; **risk** unsold work polluting **job** lists. |

---

## 5. Recommended decision

**Recommendation:** **Option B — Job at sign as product default** for **trade** tenants using **quotes → execution**; **Option A** allowed only as **explicit** **company policy** when **payment gates** and **pre-activation job reports** are **disabled**.

---

## 6. Rationale

**Rationale**

1. **Payment gates** need **`jobId`** — schema **fact**.  
2. **`allowReuse: true`** already encodes **“job may pre-exist”** — **align** product story with **code** reality.  
3. **Sign** is **contract** moment — **natural** anchor for **CRM “won job”** without **creating** jobs for **every** sent quote (**reject C**).  
4. **Activation** stays **sharp** as **execution bridge** — **does not** **compete** with **sign** for **“what is a job.”**

---

## 7. What this enables

**Consequence**

- **Stable `jobId`** for **integrations** **after** customer **yes**.  
- **Pre-activation** **payment collection** on **INITIAL_DEPOSIT** gates **without** **inventing** quote-scoped gates (unless **separate** product wants that).  
- **Clear support script:** **Signed → job shell exists → activate → flow runs.**

---

## 8. What this forbids

**What not to do**

- **Two** Jobs per **FlowGroup** for **one** **logical** install.  
- **Treating** **activation** as **job creation** **without** **idempotent reuse** check.  
- **Creating** Job on **every** **send** (**Option C**) in **default** trade wedge — **pollutes** pipeline with **unsigned** jobs unless **product** explicitly wants **“job” = opportunity**.

---

## 9. Risks / tradeoffs

**Risks**

- **Declined** quotes after sign **rare** — job shell may exist; **mitigation:** **job status** or **void** policy (**implementation**).  
- **Sign without** **flowGroupId** — **block** sign or **create** flow group — **already** activation constraint.

---

## 10. MVP blocker status

**MVP blocker status:** **Yes** — **schema and APIs** need **one** **coherent** **ordering** for **Job**, **Quote**, **PaymentGate**, **Activation**.

---

## 11. Follow-on implementation consequences

**Consequence**

- **`signQuote`** (or **listener**) calls **`ensureJobForFlowGroup`** when **`company.createJobOnSign !== false`** (name TBD).  
- **`activate`** **always** **`allowReuse`**.  
- **Document** **`autoCreateJobOnSignature`** successor as **this** **canon** (v2 **comment drift** **corrected** in v3 docs).

---

## 12. Still-open subquestions

**Open subquestion**

- **Exact** **flag** name and **default** (`true`/`false`) — **GTM**.  
- **Job** for **unsigned** **change orders** only — **CO** scoping **may** reuse **same** job — **already** v2 pattern.

**Does not reopen:** **Activation** as **execution birth** vs **job** as **business anchor** — **both** true under this decision.
