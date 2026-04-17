# Save / redesign / drop — v3 foundation matrix (from v2)

**Labels:** **Proven from code** · **Strong inference** · **Working v3 interpretation** · **Unclear / needs canon decision**

This extends `docs/reverse-engineering/2026-04-10-struxient-v2/12-preserve-redesign-drop-matrix.md` with the **locked v3 framing** and an explicit **four-way** classification: **save directly** · **save but redesign** · **preserve as historical evidence only** · **drop**.

---

## Section F — Explicit distinctions

### Save directly

Concept is **sound in shape and role**; v3 should **carry the pattern** with minimal structural change (implementation may still change).

| Item | v2 evidence | v3 note |
|------|-------------|---------|
| **Quote versioning + send as freeze boundary** | `send/route.ts`, immutability guards on line items post-snapshot | Keep **one-way freeze** for integrity. |
| **Line item as commercial + scope pointer** | `QuoteLineItem`, catalog dialog | **Center** trade selling here. |
| **Bundle/packet as reusable scope template** | `BundleTemplate`, `resolveBundle`, packet lines | **Center** reusable trade scope here. |
| **Task definition as meaning library** | `TaskDefinition`, LIBRARY resolution | Keep **placement vs meaning** split. |
| **Generated plan (deterministic from line items × packets)** | `computeGeneratedPlan` | Keep **derivation** model. |
| **Execution package as frozen scope↔skeleton bind** | `composeExecutionPackage`, activation gate | Keep **zipper** semantics; may rename. |
| **Idempotent activation record** | `Activation`, `ActivationEvent` | Keep **audit + replay safety**. |
| **Pinned workflow version on Flow** | `Flow.workflowVersionId`, immutable snapshot | Keep **skeleton immutability**. |
| **Append-only execution truth** | `TaskExecution`, `NodeActivation`, outcomes | Keep **event-sourced** execution facts. |
| **Node/gate routing + completion rules** | Schema, `derived.ts` | Keep **process physics**. |
| **DetourRecord correction loop** | `derived.ts`, `DetourRecord` | Keep **non-destructive** corrections. |
| **Hold model (start-blocking only)** | `task-start-eligibility.ts` comments | Keep **overlay** semantics. |
| **Effective snapshot merge for runtime tasks** | `effective-snapshot.ts` | Keep **merge**; document **routing isolation** as invariant. |
| **Portal token for customer access** | `PortalAccessToken` | Keep if **customer approval** stays in scope. |
| **Structured input timing enums (concept)** | `TaskDefinitionRequirementTiming` | Keep **when** data is required across quote→activation→execution — **redesign** UX surfacing. |

---

### Save but redesign

Idea is **proven necessary**; **shape, naming, or coupling** in v2 should **not** be copied literally.

| Item | v2 issue | v3 direction |
|------|----------|--------------|
| **RuntimeTask** | Collapsed naming with other “tasks”; evidence handoff quirks (e.g. metadata paths) | First-class **manifest task instance** concept in API/docs; **stable** evidence + structured-input handoff. |
| **Execution package storage** | Large nested JSON in `QuoteVersion.snapshot` | **Normalized or versioned artifact** with explicit migration story; keep **semantic** (zipper + hash intent). |
| **Quote snapshot JSON** | Multi-concern blob | **Separate** commercial snapshot vs execution bind vs customer view — or strict schema versioning with tooling. |
| **Payment + holds** | `PaymentGate` + `HoldType.PAYMENT` + **legacy JobTask name bridge** | **Single** stable **task id** discipline for payment mapping (**drop** string bridge). |
| **Job progress** | Dual FlowSpec vs legacy formulas | **One** derivation keyed by **execution mode** / job generation. |
| **Scheduling** | Blocks exist; **start eligibility defers** scheduling | **Explicit policy**: enforce or **rename** to non-authoritative intent. |
| **FlowGroup vs Lead** | Duplicate fields | **Single** identity source + optional denormalized cache. |
| **Capability model** | Effectively `view_cost` only in reviewed code | Expand **only** with real permission matrix — or document **tenant-wide** trust model honestly. |
| **Inspection checkpoints** | Parallel to FlowSpec | **Redesign** relationship (fold, link, or parallel-with-contract) — **Unclear / needs canon decision**. |
| **InstallItem** | Useful anchor (`RuntimeTask` FK) | Decide **MVP**: keep for multi-commodity or defer — **Unclear / needs canon decision**. |
| **Change orders** | Bridge to JobTask for REMOVE | **RuntimeTask-first** CO semantics only in v3. |
| **CostEvent / costing bridge** | Good append-only observation | Clarify **accounting** boundary and **variance** attribution. |
| **Assembly engine** | Powerful but overlaps mentally with packets | Position as **rules layer** for **derived** packet lines, not default quoting path — **Working v3 interpretation**. |
| **Fan-out** | BLOCKED + no retry per schema notes | **Needs canon** for MVP vs phase 2. |

---

### Preserve only as historical evidence

Useful for **migrations, audits, and “why we don’t do that”** — **not** structural pillars of v3.

| Item | Reason |
|------|--------|
| **JobTask lifecycle** | Deprecated; packaged activation skips creation — **Proven** `activation-from-package.ts`. Keep **read** paths only as long as data exists. |
| **Legacy payment bridge string matching** | **Anti-pattern** to cite, not replicate. |
| **`/api/sales/convert-to-job` deprecated path** | Evidence of **pre-unified** bridge. |
| **Dual progress code** | Keep file history / ADR on **why** single formula replaced both. |
| **“Workflow-first” UX assumptions** | Any UI that implied authors build **per quote** graphs as primary — learn from, don’t rebuild as default. |

---

### Drop (for v3 foundation — not necessarily day-one delete from DB)

| Item | v2 evidence | v3 stance |
|------|-------------|-----------|
| **JobTask as execution primitive for new work** | Schema deprecation comment | **No new** JobTask-centric features. |
| **String-keyed JobTask payment bridge** | `legacy-payment-bridge.ts` | **Remove** from **foundation**; replace with id-stable mapping. |
| **Dual progress without explicit mode** | `job/progress.ts` | **Drop** ambiguous UI behavior. |
| **Silent scheduling authority** | Eligibility defers scheduling while UI may imply enforcement | **Drop** ambiguous model — choose explicit policy. |
| **Collapsed “task” vocabulary in public API** | Multiple task types | **Drop** for **external** docs/APIs; use distinct terms. |
| **ENV-only module toggles as stealth product** | `moduleFlags` note in pain doc | **Redesign** toward tenant-visible config if modules persist. |

---

## Cross-reference to reverse-engineering doc 12

Doc 12’s “Preserve / Preserve but redesign / Drop / Needs review” aligns with above:

- **FlowSpec core, node/gate model, detours, holds (concept), portal, cost events** → mostly **save directly** or **save but redesign** as listed.  
- **JobTask, dual progress, deprecated convert path** → **drop** or **evidence only**.  
- **Ordering assistant / learning / structured-input AI** → **optional** in doc 12; **locked v3 assumption 10** says **evaluate** AI — **Working v3 interpretation:** **optional accelerators**, not core structure.

---

## See also

- `01-v3-foundation-synthesis.md` — Direct foundation verdict  
- `10-open-canon-questions.md`
