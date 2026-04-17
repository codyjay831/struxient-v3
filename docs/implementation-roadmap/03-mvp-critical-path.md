# Struxient v3 — MVP critical path (trade-first quote → execution)

**Definition of MVP success:** A tenant can **sell** with **line items + scope packets**, **freeze** an honest **plan + execution package** on **send**, **sign**, **activate** to create **flow + manifest runtime tasks**, and **record execution truth** on at least **one manifest task** — with **skeleton** execution proven soon after. **No** workflow-first selling (`canon/01`), **no** collapsed task vocabulary (`canon/04`), **no** string payment bridges for new paths (`canon/09`, `decisions/02`).

---

## Must exist (non-negotiable)

| Capability | Canon / decision / planning |
|------------|----------------------------|
| **Tenant + auth + tenant isolation** | Platform |
| **Customer + FlowGroup** | CRM anchors (`epics 02–03`, `decisions/04`) |
| **Published scope packet revision** + lines w/ **node placement** | `canon/05`, `epics 15–16` |
| **Published workflow version** snapshot (nodes + skeleton tasks + enough routing to validate) | `canon/06`, `epics 23–27` |
| **Quote + QuoteVersion + QuoteLineItem** (manifest scope **XOR:** `scopePacketRevisionId` *or* `quoteLocalPacketId` when packet-backed — `04`, `planning/01`) | `canon/02`, `epics 07–09` |
| **Pin `workflowVersionId` on quote version** | `epics 07–08` (version-scoped choice) |
| **Compose + atomic send/freeze** (plan + package + `sent`) | `canon/03`, `epics 12`, `31–32`, `planning/04` |
| **Signature acceptance + audit** | `canon/03`, `epic 13` |
| **Job ensure on sign (default)** | `decisions/04`, `epic 34` |
| **Idempotent activation** | `canon/03`, `epic 33` |
| **`flowId` + `runtimeTask` manifest materialization rules** | `canon/03`, `epics 35` |
| **`TaskExecution` append-only** | `canon/03–04`, `epic 41` |
| **Tagged executable identity in APIs** | `planning/01` |
| **Start eligibility** = holds + payment (if enabled) + node readiness + **NOT scheduling MVP** | `decisions/01`, `epic 30` |
| **Effective merged read** for UI lists | `epic 36` |
| **Minimal field UI** to start/complete | `epics 39, 41` |

---

## Should exist immediately after first field demo (still “MVP+”)

| Capability | Why |
|------------|-----|
| **Skeleton task start/complete** | Proves dual execution universe (`canon/04`, slice `V6` in `02-vertical-slices.md`) |
| **Detours + holds (non-payment)** | Real jobs stall — `epics 28–29` |
| **Evidence attach (minimal)** | Even one file ref prevents fake completions (`epic 42`) |
| **Basic job page + flow board** | Ops usability (`epic 40`) |

---

## Can defer safely (wedge GTM permitting)

| Area | Defer rationale |
|------|------------------|
| **Leads** full product** | Not on execution spine (`epic 01`) |
| **Portal customer sign** | Office sign acceptable early (`O16`) |
| **Customer-entered structured inputs** | Office can satisfy `REQUIRED_*` gates (`O17`) |
| **Assemblies / rules-generated scope** | Secondary path (`canon/05`) |
| **AI drafting** | Non-core (`canon/08-ai`) |
| **Payment gates** | If first customers don’t gate labor — add in Phase 9 (`01-v3-build-sequence.md`) |
| **Scheduling enforcement** | Explicitly out for MVP (`decisions/01`); optional calendar **display** can be later (`epics 45–46`) |
| **Change orders** | After baseline activation stable (`epic 37`) |
| **Learning loop** | Post data (`epic 52`, `O15`) |
| **Variance dashboards** | After cost/time capture (`epics 49–51`) |
| **Global search** | Nice (`epic 58`), not spine |
| **Multi-flow** | Blocked on **O2** (`planning/06`) |

---

## MVP acceptance checklist (binary)

1. **Send** creates **immutable** version state + **frozen** plan/package artifacts.  
2. **Compose warnings** visible; **errors** block send (`canon/09#12`).  
3. **Activation** is **idempotent** and creates **exactly one** job per flow group policy (`decisions/04`).  
4. **Runtime tasks** exist for **manifest** slots; **skeleton** not duplicated as runtime (`canon/03`).  
5. **TaskExecution** records **start/complete** with **`RUNTIME` kind** correctly.  
6. **Public/API** payloads do not emit **bare** `taskId` without discriminator (`planning/01`).  
7. **Scheduling** does not block start in MVP (`decisions/01`).

---

## Explicit non-goals for MVP (do not accidentally build)

- **Workflow-first quoting** as default (`canon/01`, `canon/09#3`).  
- **JobTask** new usage (`canon/09#5`).  
- **Parallel inspection checkpoint progression truth** for v3-native (`decisions/03`).  
- **Silent compose reroutes** (`canon/09#12`).  
- **Calendar implied permission to start** (`decisions/01`, `canon/09#7`).
