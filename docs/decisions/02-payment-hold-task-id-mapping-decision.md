# Decision: Payment, holds, and task-ID mapping (Struxient v3)

## 1. Decision statement

**Decision:** **Payment gating** and **payment-scoped holds** resolve work using **stable FlowSpec execution identities** only:

- **`skeletonTaskId`**: the **published snapshot task id** (design-time task on a node).  
- **`runtimeTaskId`**: the **manifest runtime task instance id** (quote-origin or injected work).

**PaymentGate** (or successor) **gates one or more executable units** by **referencing those ids explicitly** on the **execution flow** (or job + flow tuple). **No** `(nodeName, taskName)` string matching. **No** **JobTask** linkage for **new** v3-native jobs.

**Holds** remain **start-blocking overlays**: generic holds use **`flowId` + optional `taskId`** where **`taskId` MUST be the same effective id** the engine uses for **`TaskExecution`** (skeleton or runtime). **`HoldType.PAYMENT`** remains **integrated** with **`PaymentGate`** via **`paymentGateId`** (v2 pattern **preserved conceptually**, **replacing** legacy bridges).

---

## 2. Why this decision matters

**Evidence:** v2 **`legacy-payment-bridge.ts`** falls back to **JobTask** lookup by **`targetNodeKey` + task `name`** string match — **fragile** when packaged activation **does not create JobTasks** (`07-readiness-blockers-holds-detours.md`, `PaymentGateTask` schema **@deprecated** `jobTaskId`).

**Locked canon** **bans** string-based payment mapping and JobTask-style execution bridges for **new** work.

---

## 3. v2 evidence

**Evidence**

- **`PaymentGate`:** job-scoped; **`PaymentGateTask`** links gate to **`jobTaskId`** (deprecated comment: unified jobs use **Hold**).  
- **`Hold`:** optional **`paymentGateId`**, **`flowId`**, **`taskId`**; **`HoldType.PAYMENT`** handled in **`getPaymentBlockForFlowSpecTask`** separate from generic holds — **proven** doc 07.  
- **`evaluateFlowSpecTaskStartEligibility`:** composes payment block + holds — **proven**.  
- **Packaged activation:** creates **`RuntimeTask`** for manifest work; skeleton tasks stay in **snapshot** — **proven** `activation-from-package` / task-vs-packet audit.

---

## 4. Options considered

| Option | Description |
|--------|-------------|
| **A — Node-level gates only** | Pay to unlock a **whole node** (coarse). |
| **B — Skeleton tasks only** | Gates attach only to **template** tasks (misses **manifest** install work). |
| **C — Explicit executable id list** | Gate references **N** rows of **`{ kind: SKELETON \| RUNTIME, taskId }`** (or unified string id space with **prefix discipline**). |
| **D — Line-item-level gates only** | Money tied to **commercial** rows, not **executable** units — weak for “pay before rough-in task X.” |

---

## 5. Recommended decision

**Recommendation:** **Option C — explicit executable id list** (conceptually **`PaymentGateTarget`** rows; name in implementation open).

Each target row:

- **`flowId`** (implicit or via job’s active execution flow — **open subquestion** for multi-flow later)  
- **`executableTaskId`**: **must equal** the **`taskId`** used in **`TaskExecution`** for that work (**skeleton id from snapshot** OR **`RuntimeTask.id`**)  
- **`targetKind`**: `SKELETON` \| `RUNTIME` (stored for **validation** and **migration clarity**, even if id strings are globally unique in practice)

**Gates** may attach to **multiple** tasks (all must satisfy policy for gate to clear, or define **ANY/ALL** rule in implementation — **default ANY satisfied** vs **ALL** is **open subquestion** for product).

---

## 6. Rationale

**Rationale**

1. **Matches engine truth:** Start and completion already key on **effective task ids**.  
2. **Covers trade reality:** Deposits may gate **first manifest task** on **mobilize node** (runtime id) or a **skeleton** “job start” checklist.  
3. **Ban compliance:** Eliminates **string** bridge and **JobTask** for **new** paths.  
4. **Holds + gates:** **Payment hold** remains a **first-class** start block **linked** to **gate** — same mental model as v2 **without** legacy leak.

---

## 7. What this enables

**Consequence**

- **Deterministic** “what payment unlocks” in **support** and **audits**.  
- **Change orders:** superseded **runtime** tasks **drop** from active gate targets; **replacement** tasks require **gate policy update** or **new gate** — explicit **product** behavior (not hidden).  
- **Single** payment block function: **unresolved gate** referencing **any** of **my** executable ids → **block start** for those ids (and optionally **node-wide** policy if product adds).

---

## 8. What this forbids

**What not to do**

- **String match** on **node name + display name** for **any** v3-native payment path.  
- **New** **`PaymentGateTask.jobTaskId`** usage for **unified** jobs.  
- **Inventing** a third **shadow** task table for **gating** only.  
- **Silent** retargeting of gates when **workflow template** renames nodes — **template publish** must **invalidate** or **remap** gate targets **explicitly** (migration concern).

---

## 9. Risks / tradeoffs

**Risks**

- **Authoring friction:** Estimators must **pick** tasks to gate — **mitigation:** templates ship **default gate profiles** per trade packet.  
- **Runtime id stability:** **RuntimeTask** ids are stable **after** creation; gates created **before** activation **cannot** reference runtime ids — **mitigation:** gates for **post-deposit manifest work** are created **after activation** OR gate **node-level** “first manifest task in node N” **policy** — **see open subquestion**.

---

## 10. MVP blocker status

**MVP blocker status:** **Yes** for any MVP that includes **payment-before-work** — you need **this mapping** before **schema planning** for **`PaymentGate*`** tables. **No** if MVP **defers** payment gating entirely (rare for trades).

---

## 11. Follow-on implementation consequences

**Consequence**

- Replace **`PaymentGateTask.jobTaskId`** with **`skeletonTaskId`** nullable + **`runtimeTaskId`** nullable (**exactly one** required) **or** single **`executableTaskId`** + **`executableTaskKind`** enum.  
- **Migration:** legacy rows **read-only**; **bridge** script maps old JobTask → runtime/skeleton where possible **once** per tenant.  
- **`getPaymentBlockForFlowSpecTask`** takes **`(flowId, effectiveTaskId)`** and resolves **gate rows** — **no** name walk.

---

## 12. Still-open subquestions

**Open subquestion**

- **Gate satisfaction rule:** **ALL** linked tasks vs **ANY** — product default.  
- **Pre-activation gates:** If deposit must clear **before** activation, gate targets **skeleton-only** or **commercial-only** path — **business** rule; **execution** gates **post-activation** use **runtime ids**.  
- **Multi-flow jobs:** Which **`flowId`** on gate — **defer** to multi-flow canon (not blocking **single-flow** mapping decision).
