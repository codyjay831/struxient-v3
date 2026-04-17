# Struxient v3 — foundation synthesis (from v2 evidence + locked planning assumptions)

**Status:** Foundation extraction, not implementation canon.  
**Sources:** `docs/reverse-engineering/2026-04-10-struxient-v2/*`, `docs/v3-research/*`, selective code paths cited in those docs.  
**Labels:** **Proven from code** · **Strong inference** · **Working v3 interpretation** · **Unclear / needs canon decision**

---

## 1. Purpose of this document

Answer: **what structural DNA from v2 is still worth carrying into a trade-first, line-item-fronted, packet-driven Struxient v3**, after applying these **locked assumptions**:

1. Trade-first, not full-home-first.  
2. Not raw-task-first.  
3. Line-item-fronted, packet-driven, task-definition-supported.  
4. Whole-job workflow = **process structure**, not main reusable trade scope.  
5. Quote-selected scope determines what work exists.  
6. Reusable packet tasks carry **default node placement**.  
7. Activation populates a **stable node-based process structure** without per-job manual workflow authoring as the default.  
8. FlowSpec = **stable process skeleton / node-and-routing framework** populated from quote at activation.  
9. Market expectations (speed, reuse, approval, no double entry, mobile) are background only.  
10. AI package/quote assists exist in v2 — **evaluate**, do not treat as automatic canon.

---

## 2. What v2 is (evidence summary)

**Proven from code + strong inference (from `00-synthesis-struxient-v2-to-v3.md`, schema):**

v2 is a multi-tenant system that combines:

- **Configurable workflow graphs** (FlowSpec: published snapshots, nodes, design-time tasks, gates, detours, cross-flow dependencies).
- **Quote-driven scope** frozen at **send** into **`GeneratedJobPlanV1` + `ExecutionPackageV1`**, then **activation** into **Job + Flow + RuntimeTask manifest** (packaged path).
- **Append-only execution truth** (activations, task executions, outcomes, evidence) with **derived** actionability and completion.
- **Operational overlays**: holds, payment gates, scheduling artifacts, inspection checkpoints, change orders, costing events, optional AI on quote/catalog.

**Working v3 interpretation:** This is already closer to “trade packet + process skeleton” than to “generic task list,” but **naming and legacy bridges** obscure that.

---

## 3. Structural spine worth saving (working v3 framing)

### 3.1 Commercial and scope freeze

| v2 mechanism | Why it matters for v3 |
|--------------|------------------------|
| **Quote versioning** + **send-time immutability** | Clean boundary between negotiation and execution intent. **Proven:** `send/route.ts`, snapshot invariants in reverse-engineering doc 03. |
| **Line items** as priced rows with **catalog identity** (`bundleKey`, tier, `resolvedBundleId`) | Matches how trades sell. **Proven:** Prisma `QuoteLineItem`, `AddLineItemDialog` in task-vs-packet audit. |
| **`computeGeneratedPlan`** (line items × bundles → flat plan) | Deterministic “what work did we sell.” **Proven:** `bundles.ts`. |
| **`composeExecutionPackage`** (zipper: workflow nodes + bundle/manual tasks) | Single frozen artifact aligned to **nodes** before customer commitment completes. **Proven:** `composer.ts`. |

**Working v3 interpretation:** **Freeze = send (and maintained snapshot edits under strict rules)** remains the spine; v3 should **name** this “scope freeze + process bind,” not “PDF snapshot only.”

### 3.2 Catalog intelligence split

| Layer | v2 | v3 role |
|-------|----|---------|
| **Task definition** | `TaskDefinition` + input templates = meaning, not placement | **Reusable work intelligence** (instructions, estimates, evidence policy templates, structured fields). |
| **Packet / bundle** | `BundleTemplate` with EMBEDDED or LIBRARY **packet task lines** | **Reusable scope composition** + **default node placement** per line. |
| **Assembly** | Rule-driven generation into plan overlay | **Optional** rules engine for complex trades (solar/service upgrade); not the default mental model for every line. |

**Proven from code:** `packet-line-resolver.ts`, schema comments on `TaskDefinition`, `BundleTemplate`.

### 3.3 Activation and runtime truth

| Step | v2 | Save for v3? |
|------|----|--------------|
| Idempotent **Activation** | Unique per quote; replays safe | **Save directly** (concept). |
| **Flow** pinned to **WorkflowVersion** | Immutable snapshot | **Save directly** as process skeleton binding. |
| **RuntimeTask** for **BUNDLE + MANUAL** only | Quote scope manifest | **Save but redesign** naming and evidence handoff consistency. |
| **WORKFLOW** tasks stay in snapshot only | Structural steps, not duplicated as RuntimeTask | **Save concept** as “skeleton tasks vs scope tasks.” |

**Proven from code:** `activation-from-package.ts`, `activate-job-from-quote-version.ts`.

### 3.4 Process mechanics (FlowSpec)

| Mechanism | v2 evidence | v3 role |
|-----------|-------------|---------|
| **Nodes**, **gates**, **completion rules** | Schema + `derived.ts` | **Process skeleton** — how work flows, not what was sold. |
| **DetourRecord** | Correction without mutating published graph | **Save directly** (pattern). |
| **Holds** + payment | Start-blocking overlays; never mutate graph truth | **Save but redesign** payment linkage (drop JobTask string bridge per preserve matrix). |
| **Effective snapshot merge** | Runtime tasks visible but routing-isolated | **Save but redesign** — keep invariant explicit in APIs/docs. |

---

## 4. What v2 got right enough to save (Section B — condensed)

Each item: **what it is** · **where in v2** · **why save** · **v3 role** · **preserve vs redesign**

1. **Line item ↔ bundle/packet** — Quote rows point at catalog bundles; plan expands from there. **Locations:** `QuoteLineItem`, `bundles.ts`, quote UI. **Save:** aligns with trade selling. **v3:** **Primary** commercial attachment. **Redesign:** clearer naming (packet vs bundle) and optional line types (labor-only, fee) without breaking scope model.

2. **Task definitions as reusable meaning** — `TaskDefinition` + LIBRARY lines. **Save:** separates content from placement. **v3:** **Secondary** library inside packets. **Redesign:** stronger contract for what copies vs references at freeze.

3. **Execution package / freeze** — `ExecutionPackageV1` at send. **Save:** launch integrity. **v3:** **Primary** technical freeze alongside customer-facing proposal. **Redesign:** storage shape (avoid only-JSON blob if maintainability matters).

4. **Activation → runtime execution** — Job + Flow + RuntimeTasks. **Save:** single hot path. **v3:** **Primary** bridge. **Redesign:** unify task identity story; eliminate JobTask dependency for any gating.

5. **FlowSpec as structural process** — Nodes, gates, completion, detours. **Save:** field-service realism. **v3:** **Reposition** as skeleton (see `06-flowspec-role.md`). **Preserve** invariants; **redesign** authoring default (trade template, not per-job graph editing).

6. **Detours / loopbacks** — `DetourRecord` + derivation. **Save:** corrections without republish. **Preserve** pattern; **redesign** UX terms (static DETOUR nodes vs dynamic detour records — doc 05).

7. **Node-based organization** — Tasks belong to nodes; phase gating inside nodes. **Save:** crew mental model. **v3:** **Primary** execution grouping.

8. **Cost events / append-only actuals** — `CostEvent`. **Save:** observation layer for learning. **v3:** **Secondary** early; **redesign** tie to accounting. **LearningSuggestion** — post-MVP per matrix unless canon says otherwise.

9. **AI-assisted authoring** — Ordering assistant, structured-input AI drafts, catalog package AI draft. **v2:** routes/libs in doc 10. **v3:** **Optional** accelerators; **never** truth until human/commit rules say so. **Evaluate** per trade workflow, not global MVP.

---

## 5. Right concept, wrong shape in v2 (Section C — condensed)

| Good concept | What went wrong in v2 | v3 reinterpretation |
|--------------|----------------------|------------------------|
| **Separate “meaning” from “placement”** | Overloaded word **task** everywhere | Four names in UX/API: **task definition**, **packet task line**, **skeleton task**, **runtime task instance**. |
| **Reusable scope** | **Bundle / packet / package** naming drift | One user-facing term (**scope packet** or **trade packet**), one frozen artifact (**execution bind** or keep **execution package**). |
| **Quote-first scope** | Workflow track still feels “primary” in some flows | **Working v3:** workflow track = **process template** chosen once per quote version; **scope** still comes from **line items**. |
| **Single progress story** | Dual `computeFlowspecJobProgress` vs `computeLegacyJobProgress` | One progress derivation keyed by **execution mode**; legacy path = historical only. |
| **Scheduling as truth** | Eligibility **defers** scheduling; blocks exist separately | Pick: calendar **enforces start** OR **explicit non-authoritative intent** — no silent middle. |
| **Payment gating** | JobTask name bridge | **Stable ids only** (RuntimeTask / snapshot task id + PaymentGate), no string match. |
| **Inspection** | Parallel `InspectionCheckpoint` vs FlowSpec | **Unclear / needs canon decision:** fold, link explicitly, or first-class parallel with clear rules. |

---

## 6. Contradictions between docs and code (explicit)

- **Comments vs bridges:** Some files assert “single execution system” while **`legacy-payment-bridge.ts`** and **`JobTask`** still participate. **Working v3:** treat **observed activation + eligibility** as authoritative; comments are aspirational until bridges are gone (`12-preserve-redesign-drop-matrix.md` contradiction note).

- **Auto job on sign vs activation:** `autoCreateJobOnSignature` and sales-flow routing vs explicit activation API — **Unclear / needs canon decision** for v3 sequencing (doc 03 checklist).

---

## 7. End-to-end picture (one paragraph)

**Working v3 interpretation:** Trades build **quotes** from **reusable scope packets** attached to **line items**; each packet line carries **default node placement** and optionally references **task definitions** for shared meaning. The office selects a **process template** (workflow) that supplies **node skeleton, gates, and structural tasks**. At **send**, the system **freezes** commercial lines plus a **generated plan** and **execution package** that merges **sold scope** into that skeleton. At **sign/activate**, the system creates **Flow** bound to a pinned **workflow version** and materializes **manifest work** as **runtime tasks** on the right nodes, while **skeleton tasks** remain in the bound snapshot. **Holds**, **payment**, and **structured-input readiness** gate **start**; **detours** model corrections; **scheduling** and **actuals** attach as overlays with explicit authority rules. **AI** proposes packets/lines/inputs but does not define truth until committed.

*(Expanded in `02-end-to-end-structure.md`.)*

---

## 8. Direct foundation verdict

### 1. What is the strongest structural spine worth saving from v2?

**The quote freeze → execution package → activation → FlowSpec truth pipeline:** versioned quote, **line-item-driven scope expansion**, deterministic **plan + package** composition at send, idempotent activation into **pinned workflow + runtime manifest**, with **append-only execution events** and **derived** actionability.

### 2. What was the biggest source of confusion in v2?

**Collapsed vocabulary:** one word **task** for catalog definitions, workflow spec tasks, plan rows, package slots, runtime rows, and legacy job tasks — amplified by **legacy bridges** (payment/progress) that behave differently depending on job age/path.

### 3. What should v3 clearly center on?

**Line items + reusable scope packets** as the **customer-facing and commercial spine**, **task definitions** as **embedded reusable intelligence**, and **FlowSpec** as the **process skeleton** that packets **populate at activation** — not as the main catalog of trade scope.

### 4. What should v3 clearly stop centering on?

**Raw task lists** and **per-job workflow authoring** as the default way trades define work; **full-home-generic** builder assumptions that obscure **packet + line** selling; any **string-keyed** legacy bridges for money or progress.

### 5. What is the most likely end-to-end structure for trade-first Struxient v3, based on current evidence?

A **line-item-fronted quote** backed by a **packet catalog** (with **library task definitions** inside packets), a **template-bound process graph** (nodes/gates/detours) selected once per quote version, a **send-time freeze** of **scope + process bind**, and **activation** that **instantiates runtime work on nodes** while keeping **structural skeleton tasks** in the immutable snapshot — with **holds/detours** for operations, **explicit** scheduling authority, and **cost/actual** observations feeding **optional** learning later.

---

## Cross-links

- `02-end-to-end-structure.md`  
- `03-object-boundaries.md`  
- `04-save-redesign-drop-foundation-matrix.md`  
- `05-trade-first-foundation.md`  
- `06-flowspec-role.md`  
- `07-task-packet-node-relationship.md`  
- `08-time-cost-learning-foundation.md`  
- `09-v2-foundation-evidence-map.md`  
- `10-open-canon-questions.md`
