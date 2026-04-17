# End-to-end structure — trade-first v3 foundation (from v2)

**Labels:** **Proven from code** · **Strong inference** · **Working v3 interpretation** · **Unclear / needs canon decision**

This document is the **structural backbone** narrative: quote input → freeze → activation → field execution → feedback. It applies the **locked v3 assumptions** (line-item-fronted, packet-driven, FlowSpec as skeleton).

---

## A. Full structural shape (v3-leaning)

### A.1 Quote line items (customer + commercial spine)

**Proven from code:** `QuoteLineItem` holds pricing, `proposalGroupId`, `bundleKey`, tier, `resolvedBundleId`, `executionMode` (`GENERATES_TASKS` | `ARTIFACT_ONLY` | `NO_EXECUTION`).

**Working v3 interpretation:** The **line item** is the **primary object customers and estimators share** as “what we’re selling.” Execution intent for scope-bearing lines flows **through** the attached packet identity, not through ad-hoc task lists on the row.

### A.2 Reusable packets / bundles (catalog scope)

**Proven from code:** `BundleTemplate` stores JSON **packet task lines** (EMBEDDED or LIBRARY); `resolveBundle` + `computeGeneratedPlan` expand to `PlanTaskV1`.

**Working v3 interpretation:** The **scope packet** is the **reusable trade SKU** (per tier). It **owns default node placement** (`targetNodeKey` / `targetNodeId`) per line. v3 vocabulary should pick **one** customer/contractor-facing term (e.g. **scope packet**).

### A.3 Task definitions (reusable meaning)

**Proven from code:** `TaskDefinition` + `TaskDefinitionInputTemplate`; LIBRARY lines reference `definitionId`; placement stays on the packet line.

**Working v3 interpretation:** **Task definitions** are **not** the primary sales object; they are **shared building blocks** for packet authoring and consistency across jobs.

### A.4 Node structure (process staging)

**Proven from code:** `Node` in workflow; `CompletionRule`; tasks inside nodes; `computeNodeComplete` in `derived.ts`.

**Working v3 interpretation:** **Nodes** are **where** work lives in time and dependency order for a **template** process — **orthogonal** to **what** was sold (packets).

### A.5 FlowSpec (skeleton + truth engine)

**Proven from code:** Published `WorkflowVersion.snapshot` immutable; `Flow` pins version; gates route by outcomes; `TaskExecution` / `NodeActivation` append-only.

**Working v3 interpretation:** FlowSpec is the **process skeleton and execution physics** — not the main reusable **trade scope** catalog. See `06-flowspec-role.md`.

### A.6 Send / freeze

**Proven from code:** `POST .../send` computes plan, merges `draftPlanOverlay`, validates required structured inputs for send, `composeExecutionPackage`, writes `QuoteVersion.snapshot`, sets quote **SENT**, portal token (`03-quote-to-execution-breakdown.md`, `send/route.ts`).

**Working v3 interpretation:** **Send** = **commercial + execution-intent freeze** (not “email only”).

### A.7 Sign / activation

**Proven from code:** `sign/route.ts` elevates quote to **SIGNED**; `activate/route.ts` requires **SIGNED**, matching `workflowTemplateId`, V1 snapshot with **`executionPackage`**; `activateFromExecutionPackage` creates Job, Flow, checkpoints, RuntimeTasks (`03`).

**Working v3 interpretation:** **Activation** = **materialize** frozen scope onto **pinned skeleton**; idempotent.

### A.8 Runtime tasks (manifest instances)

**Proven from code:** `RuntimeTask` created for package tasks with source **BUNDLE** or **MANUAL**; merged into **effective snapshot** at read time; excluded from gate routing (`effective-snapshot.ts`, `04-task-system-deep-dive.md`).

**Working v3 interpretation:** **Runtime tasks** = **sold work instances** (and manual overlays) **on nodes**; distinct from **skeleton tasks** embedded in the workflow snapshot.

### A.9 Blockers / holds / detours / loopbacks

**Proven from code:** `evaluateFlowSpecTaskStartEligibility` composes flow BLOCKED, actionability, holds (non-PAYMENT path), payment block, structured inputs (`04`, `07`). `DetourRecord` + `computeBlockedNodes` (`05`, `07`).

**Working v3 interpretation:** **Holds** = operational pause on **start**; **detours** = **correction topology** without editing published graph.

### A.10 Scheduling

**Proven from code:** `ScheduleBlock`, `ScheduleChangeRequest`, `RuntimeTask.scheduledStartAt/EndAt` with comment “User commitment overlay only — not execution truth”; **scheduling explicitly not evaluated** in centralized start eligibility (`08-scheduling-time-horizon.md`).

**Working v3 interpretation:** v3 must **declare authority**: either scheduling **gates start** or is **explicitly non-binding intent** — v2’s gap is not copyable.

### A.11 Costing / actuals / learning

**Proven from code:** `CostEvent` append-only; `LearningEvidence` / `LearningSuggestion` (`02-domain-model-inventory.md`); epic notes in `10-automation-ai-inventory.md`.

**Working v3 interpretation:** **Actuals** are **observations**; **learning** is **downstream** of stable execution truth — optional for early v3 unless canon says otherwise.

### A.12 AI-assisted authoring

**Proven from code:** Ordering assistant (`ordering-assistant/*`), structured-input AI drafts (non-truth until commit), catalog `package-ai-draft` (`10`).

**Working v3 interpretation:** **Accelerators** for **packets and line items**; **human commit** remains the boundary for freeze truth.

---

## E. End-to-end flow (clean v3-leaning sequence)

### E.1 How work enters the system

| Entry mode | v2 evidence | Working v3 interpretation |
|------------|-------------|---------------------------|
| **Manual line item creation** | APIs + editor create `QuoteLineItem` | Still valid; may attach **custom description** + **packet** or non-executing modes. |
| **Reusable packet-backed line items** | `AddLineItemDialog` selects `bundleKey` + tier | **Default** trade path. |
| **AI text/voice draft line items** | Ordering assistant, structured input AI | **Draft → review → commit** to line items + **scope pins** (`scopePacketRevisionId` / `quoteLocalPacketId` per XOR) or non-executing lines; not activation input until frozen. |
| **Plan-upload-generated draft line items** | **Unclear / needs canon decision** — not proven as single pipeline in reviewed docs; may be product gap. |
| **AI-created package drafts** | `catalog/package-ai-draft` | **Authoring assist** for **catalog**, not per-job freeze substitute. |

### E.2 Quote scope → execution intent

**Proven from code:** `computeGeneratedPlan` expands bundles × quantity; overlays add manual tasks, exclusions, assembly tasks, instruction overrides, structured input answers (`bundles.ts`, `types.ts`).

**Working v3 interpretation:** **Execution intent** = **flattened plan** + **overlays**, then **zipped** into **execution package** against chosen workflow.

### E.3 Send / freeze

**Proven from code:** Snapshot stores `lineItems` summary, `generatedPlan`, `executionPackage`, `workflowTemplateId`, etc.

**Working v3 interpretation:** One **immutable** contractor + system record of **what was proposed** and **what would run** if activated on that version.

### E.4 Sign / activate

**Proven from code:** Sign then activate; package required (`activate-job-from-quote-version.ts`).

**Working v3 interpretation:** Signature = customer authorization of **frozen** scope bind; activation = **instantiation**.

### E.5 Packets/tasks → nodes / FlowSpec

**Proven from code:** `composeExecutionPackage` maps each plan task to a **package node** (by `targetNodeId`/name); inserts **WORKFLOW** tasks from snapshot per node; applies ordering overrides (`composer.ts`).

**Working v3 interpretation:** **Default placement** from packet lines; **reroute** if node missing (v2 warns/errors) — v3 may tighten trade templates to reduce silent reroute.

### E.6 Runtime truth

**Proven from code:** **TaskExecution** outcomes on **effective** task ids; **RuntimeTask** ids participate after merge (`04`).

**Working v3 interpretation:** **Truth** = append-only executions + derived actionability; **runtime tasks** carry **sold work** instances.

### E.7 Holds, detours, loopbacks

**Proven from code:** Holds block **start** only (`07`); detours block completion / subgraph (`05`/`07`).

**Working v3 interpretation:** Operational reality layer **on top of** frozen scope, not a substitute for change orders when scope truly changes.

### E.8 Actuals → learning

**Proven from code:** `CostEvent` and learning tables exist; not on every hot path.

**Working v3 interpretation:** **Close the loop** after execution truth is stable: attribute **variance** to **packet**, **line**, **task definition**, **node** — **Unclear / needs canon decision** for attribution model.

---

## Contradiction watchlist

- **Job without single status** (**Proven**) vs dashboards wanting one badge — v3 UX derivation rules must be explicit (`06-job-progression-status-logic.md`).
- **InspectionCheckpoint** parallel to FlowSpec — v3 needs one story (`10-open-canon-questions.md`).

---

## See also

- `07-task-packet-node-relationship.md`  
- `06-flowspec-role.md`  
- `08-time-cost-learning-foundation.md`
