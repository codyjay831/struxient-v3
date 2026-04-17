# Struxient v3 — Core primitives

**Canon:** Definitions below are **normative vocabulary** for v3. v2 names (`BundleTemplate`, `QuoteLineItem`, `RuntimeTask`, etc.) are **historical implementation references** unless stated.

For each primitive: **what it is** · **what it owns** · **what it does not own** · **must not collapse into**

---

## Quote line item

**Canon:** A **versioned quote row** representing **one sold line** on a proposal: **commercial** presentation (description, quantity, pricing, proposal grouping) and, for manifest scope lines, **which scope was selected** — **either** a **pinned catalog packet revision** **or** a **quote-local packet** (**XOR** where the line type requires packet-backed scope), plus **tier** when tiering applies.

**Owns:** **Customer-facing line copy** (within policy), **commercial numbers**, **attachment** to that **pinned scope** (library revision **or** quote-local packet) + tier for executable lines, **execution mode** (e.g. generates manifest work vs non-executing line).

**Does not own:** **Process graph**, **gate logic**, **runtime execution state**, **task definition** bodies, or **field truth**.

**Must not collapse into:** A **scope packet** (reuse catalog), a **node**, or a **runtime task instance**.

**Rationale from v2 evidence:** `QuoteLineItem` carries pricing + `bundleKey`/tier/`resolvedBundleId` + `executionMode`.

---

## Scope packet

**Canon:** A **reusable catalog template** for a **unit of trade scope** at a **tier** (e.g. MICRO / STANDARD / FULL): contains **packet task lines**, **inspection checkpoint definitions** as authored, and **metadata** for catalog display. **v2 equivalent concept:** `BundleTemplate`.

**Owns:** **Default composition of work** for that SKU tier, **default node placement per packet task line**, **checkpoint definitions** attached to the packet as authored.

**Does not own:** **Per-job outcomes**, **per-quote commercial price**, **frozen plan rows** for a specific customer, or **mutable runtime state**.

**Must not collapse into:** A **line item** (instance), a **workflow**, or a **single task definition**.

**Rationale from v2 evidence:** `BundleTemplate` with JSON task lines resolved to `BundleTaskDefinition[]`.

---

## Quote-local packet (QuoteLocalPacket)

**Canon:** A **project-specific copy** of scope structure used when a quote requires task-level modifications (add, remove, reorder tasks) to a library packet, or when AI drafts entirely new scope from text/voice/documents. Created as a **deep copy** of a `ScopePacketRevision` on fork, or as a **new draft** by AI.

**Owns:** **Project-specific task composition**, **local metadata** (instructions, labor hints, evidence requirements) for that quote only.

**Does not own:** **Global library status** — a `QuoteLocalPacket` is **not** reusable by other quotes until explicitly **promoted** to the global library through admin review.

**Must not collapse into:** A **ScopePacketRevision** (which is curated global library truth). The `QuoteLineItem` switches its reference from the library revision to the `QuoteLocalPacket` when a fork occurs.

**Promotion:** An estimator may request **"Promote to Global Library"**; this creates a new `ScopePacket` in `draft` status pending admin review and publish. The original `QuoteLocalPacket` remains unchanged on its quote.

---

## Task definition

**Canon:** A **tenant-scoped library record** for **reusable work intelligence**: name, instructions, default labor hints, evidence expectations, and **structured input field templates** (with timing semantics: quote vs activation vs execution). **Placement is not owned here.**

**Owns:** **Meaning** of a reusable piece of work and **field schema** for capturing data about that work.

**Does not own:** **Which node** the work runs on (that lives on the **packet task line** when using the library).

**Must not collapse into:** A **packet**, a **line item**, or a **runtime task instance**.

**Rationale from v2 evidence:** `TaskDefinition` + `TaskDefinitionInputTemplate`; LIBRARY packet lines reference `definitionId` while **placement stays on the line** (`packet-line-resolver`).

---

## Packet task line

**Canon:** One **row inside a scope packet** (embedded meaning **or** reference to a **task definition**) **plus** **default node placement** (`target node` identity in the process template) **plus** optional **packet-local overrides** (name, instructions, estimates, evidence, metadata).

**Owns:** **Placement intent** for this packet’s copy of the work, **merging** definition + overrides when library-backed.

**Does not own:** The **process template graph** globally, **commercial pricing**, or **execution outcomes**.

**Must not collapse into:** A **task definition** alone (placement would be wrong) or a **runtime instance**.

**Rationale from v2 evidence:** EMBEDDED vs LIBRARY `PacketTaskLine` union; resolver merges definition + packet overrides.

---

## Node

**Canon:** A **stage-like container** in the **published process template**: holds **skeleton tasks**, obeys a **completion rule**, and connects to other nodes via **gates** and **outcomes**.

**Owns:** **Structural ordering and branching** for that stage; **which skeleton tasks** exist for every job using that template.

**Does not own:** **SKU catalog**, **sold price**, or **customer-specific scope** (that arrives via **packets** on **line items**).

**Must not collapse into:** A **scope packet** or a **quote line item**.

**Rationale from v2 evidence:** `Node` in workflow; `composeExecutionPackage` builds per-node task lists.

---

## FlowSpec

**Canon:** The **contract + engine** for **immutable published process snapshots** (workflow version), **runtime flow** bound to that version, **derived actionability and completion**, **gates**, **detours**, and **append-only task execution truth**. In v3 rhetoric: **FlowSpec = process skeleton + execution physics**, not **scope catalog**.

**Owns:** **Topology**, **routing**, **skeleton tasks**, **completion and progression rules**, **execution truth tables** (conceptually).

**Does not own:** **Reusable trade SKUs**, **proposal pricing**, or **quote freeze content** (those live in **quote/snapshot** domain).

**Must not collapse into:** **Catalog** or **CRM**.

**Rationale from v2 evidence:** Published `WorkflowVersion.snapshot`; `Flow` pins version; `derived.ts` / engine.

---

## Execution package

**Canon:** The **frozen, node-aligned artifact** produced at **send** that records **how sold scope (and manual plan additions) maps onto the chosen process template’s nodes**, together with **integrity context** (which workflow version the package was composed against). **v2 equivalent:** `ExecutionPackageV1`.

**Owns:** **Launch contract** for activation: **which package tasks** exist **on which nodes**, their **source classification** (sold scope vs skeleton vs manual plan), and **compose-time validation messages**.

**Does not own:** **Commercial line pricing** as authoritative (that remains **line items**); **post-send operational** state (holds, detours).

**Must not collapse into:** The **catalog scope packet** (template) or the **live flow**.

**Rationale from v2 evidence:** `composeExecutionPackage`; activation requires package on packaged path.

---

## Pre-job task (PreJobTask)

**Canon:** An **operational work item** anchored to a **FlowGroup** that represents work performed **before** a signed quote is activated — site surveys, utility checks, feasibility reviews, photo requests, scope clarification. Uses the same task primitives as runtime execution (photos, evidence, structured inputs) but is **not** part of the activated `Job` execution graph.

**Owns:** **Pre-quote operational evidence** (photos, measurements, structured data), **scheduling reference**, **completion status**.

**Does not own:** **Contracted execution truth** (that belongs to `RuntimeTaskInstance` after activation). **Commercial pricing** (that belongs to the quote).

**Must not collapse into:** A **RuntimeTaskInstance** (which requires an activated Job) or a **Lead** activity (leads are person-centric, pre-job tasks are site-centric).

**Lifecycle:** Created on a `FlowGroup` before or during quoting. Completed evidence feeds the Quote Editor. After activation, `PreJobTask` stays on the `FlowGroup` as historical evidence — it is **not** migrated into the `Job`.

---

## Runtime task instance

**Canon:** A **flow-scoped executable unit** materialized for **manifest work** from **sold scope** or **manual plan lines** (and similar injection paths), **attached to a specific node**, participating in **worker-facing work lists** and **TaskExecution** truth when started/completed. **v2 equivalent:** `RuntimeTask` row + effective snapshot merge.

**Owns:** **Instance identity** on the flow, **instance-level** instructions/metadata/evidence flags as materialized, **provenance** back to **line/packet** where applicable.

**Does not own:** **Gate routing semantics** (must not drive **gate** evaluation incorrectly); **published graph editing**.

**Must not collapse into:** **Skeleton task** (workflow spec) or **task definition** (library).

**Rationale from v2 evidence:** Activation creates **RuntimeTask** for **BUNDLE/MANUAL** package tasks; effective snapshot merges for UX; routing isolation for runtime overlay.

---

## Hold

**Canon:** An **operational overlay** that blocks **starting** work (or specific starts per scope rules) **without mutating** process or quote truth.

**Owns:** **Pause policy** (permit, weather, RFI, payment, etc.) **at start boundary**.

**Does not own:** **Completed execution facts** or **immutable quote freeze** (releasing a hold does not rewrite the quote).

**Must not collapse into:** **Detour** (correction topology) or **change order** (scope delta).

**Rationale from v2 evidence:** `Hold` + `evaluateFlowSpecTaskStartEligibility` composition.

---

## Detour / loopback

**Canon:** A **runtime correction construct** that **temporarily obstructs** progression (blocking or non-blocking) and anchors **resume** behavior **without editing** the **published** process snapshot.

**Owns:** **Correction loop semantics** as implemented by the engine (blocking sets, completion rules interaction).

**Does not own:** **Sold scope** definition; **commercial truth**.

**Must not collapse into:** **Scope packet** edits or **informal status** fields.

**Rationale from v2 evidence:** `DetourRecord` + `computeBlockedNodes` / `computeFlowComplete` interaction.

**Canon boundary:** Static **DETOUR node kind** vs dynamic **DetourRecord** — both exist in v2; v3 **uses both** but **UX naming** must distinguish them (**Open question** for exact labels in `10-open-canon-decisions.md` if needed).

---

## Cost / actual event

**Canon:** An **append-only observation** of **money or cost-relevant fact** tied to job/flow/execution context as designed—not the same as **quote price** or **packet default estimate**.

**Owns:** **Actual cost signal** for analytics, margin, and optional learning.

**Does not own:** **Sold price** or **frozen estimate snapshot** authority.

**Must not collapse into:** **Line item total** or **task definition default minutes**.

**Rationale from v2 evidence:** `CostEvent` model in domain inventory.

---

## Activation

**Canon:** The **idempotent bridge** from a **signed (or policy-ready) quote version** that has a **valid freeze** to: **job anchor**, **flow** bound to **pinned process template version**, **runtime task instances** for **manifest** package tasks, **inspection checkpoints** (if retained as parallel model), and **audit records** of the bridge.

**Owns:** **Instantiation rules** and **audit** of “go live” for that quote version.

**Does not own:** Ongoing **field edits** (those use **change orders**, **runtime injection**, **detours**, **holds** per policy).

**Must not collapse into:** **Send** (freeze) or **sign** (customer consent event).

**Rationale from v2 evidence:** `activateFromExecutionPackage`, `Activation` uniqueness per quote.

---

## Quick reference: who owns what (charter questions 6–11)

| Question | Canon owner |
|----------|-------------|
| Commercial truth | **Quote line item** (per version) + **quote totals** |
| Reusable scope | **Scope packet** (catalog) |
| Reusable work intelligence | **Task definition** |
| Process structure | **FlowSpec** (**nodes**, **gates**, **skeleton tasks**) |
| Project-specific scope modifications | **QuoteLocalPacket** (quote-scoped) |
| Pre-quote operational work | **PreJobTask** (FlowGroup-scoped) |
| Runtime execution truth | **TaskExecution** / flow truth tables + **runtime task instances** as materialized scope |
| Actual time/cost observations | **Cost / actual events** + **execution timestamps** (conceptually); not quote rows |
