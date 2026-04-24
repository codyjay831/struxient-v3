# PreJobTask — Schema decision pack

**Status:** Planning / schema boundary lock (not application code).  
**Authority:** `docs/canon/02-core-primitives.md` (Pre-job task), `docs/canon/03-quote-to-execution-canon.md`, `docs/canon/04-task-identity-and-behavior.md`, epics **03 FlowGroup**, **39 Workstation**, **33 Activation**, **34 Job anchor**, **01 Leads** (post-integration).  
**Companion:** `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md` (**normative Prisma-shaped planning** for `PreJobTask`; merge with `docs/schema-slice-1-codepack/03-prisma-schema-draft-v0.md` — v0 alone is not the full planned Slice 1 graph).

---

## Decision

**PreJobTask** is a **dedicated first-class relational model**. It is **not** a `RuntimeTaskInstance` subtype, a generic mega-`WorkItem`, a fake early `Job`, or a packet line masquerading as field work.

---

## Product boundary (anti–junk-drawer)

**Normative with canon (`02`, `04`):** Use `PreJobTask` only for **real human operational actions** on the **FlowGroup** (site/project) before activation. **Do not** create PreJobTasks for **missing customer phone**, **incomplete profile**, **job-card field gaps**, or **generic office readiness** — express those as **readiness / completeness on the owning record** (and policies), not as tasks.

**Light use is allowed:** The primitive may remain **narrow and infrequent**; that is **not** a signal to remove it.

---

## Current evidence

- Canon defines **Pre-job task** as FlowGroup-anchored **human operational** work **before** activation; it **does not** enter the activated execution graph (`02-core-primitives.md`).
- Slice 1 schema planning today has **no** edges from quote domain to `Flow` / `Job` / `RuntimeTask` (`04-slice-1-relations-and-invariants.md`). PreJobTask **extends** the pre-activation world without violating that boundary.
- **Work Station / Epic 39 — honest split:** **Queryable rows** with stable identity are required for discovery (`global-work-feed-reads`, quote workspace, office `/work`). **Merged-row PRE_JOB badges, node column, and Start parity** with runtime/skeleton are **target vision**; **current** implementation is **read-only pre-job visibility** in a **separate** section (see `docs/epics/39-work-station-actionable-work-feed-epic.md` §9b).

---

## Ownership and anchor

| Question | **Decision** |
|----------|--------------|
| What owns it? | **`FlowGroup`** is the **required parent** (`flowGroupId`). Every `PreJobTask` belongs to exactly one project/site anchor. |
| `tenantId` | **Required** on the row for tenant-scoped queries and RLS. Must equal `FlowGroup.tenantId` (enforce in app or DB check). |
| Optional quote linkage | **`quoteVersionId` optional, nullable.** Use when the task was created or is clearly **for** a specific draft/sent version (traceability, UI “site evidence for this quote”). **Not required** to exist before a quote exists. |
| Lead linkage | **No `leadId` on PreJobTask.** Leads are person-centric; pre-job work is site-centric. Lead → conversion → FlowGroup is the path. |

---

## Lifecycle: when it can exist

| Phase | Allowed? | Notes |
|-------|----------|--------|
| Before any `Quote` on the FlowGroup | **Yes** | Primary case: survey scheduled right after lead conversion / FlowGroup create. |
| After `Quote` exists, **draft** version | **Yes** | Optional `quoteVersionId` for context. |
| After **sent** quote version | **Yes** | Still pre-activation; evidence may complete while customer reviews proposal. |
| After **activation** | **History only** | Rows **remain** on FlowGroup; **no migration** into Job/Flow/RuntimeTask. **No auto-conversion** to `RuntimeTaskInstance` unless a **future** canon decision introduces an explicit, audited carry-forward (out of scope here). |

---

## What it must never be mistaken for

- **Not** contracted **runtime execution** (no `flowId`, no `runtimeTaskId`, no participation in FlowSpec completion rules).
- **Not** a **Job** (Job is post–sign/activation business anchor per epic 34 / decision 04).
- **Not** a **ScopePacket** or **PacketTaskLine** (catalog / quote scope are separate layers).
- **Not** a **Lead** activity row (optional `Activity` on Lead is separate; measurements belong on site).

---

## Readiness and send

- **May** influence **product readiness** (e.g. “site survey required before send” as a **policy gate** implemented in send/compose service).  
- **Must not** implement that gate by **pretending** the survey is a runtime task or by writing into `generatedPlanSnapshot` as manifest work.  
- Slice 1 **strict scope** may omit send-blocking on survey until product enables it; schema still supports the gate later.

---

## Assignment and scheduling (Slice 1 vs later)

| Capability | Slice 1 schema | Notes |
|------------|----------------|--------|
| Assignee | **`assignedToUserId`** optional | FK `User`, same tenant. |
| Due / window | **`dueAt`**, optional **`scheduledStartAt` / `scheduledEndAt`** | Simple timestamps suffice for first build. |
| `ScheduleBlock` FK | **Deferred** | Epic 45/46 integration can add `scheduleBlockId` later without breaking PreJobTask identity. |

---

## Recommended status enum (schema planning)

Align product copy with engine rules; values are **planning-level**:

| Status | Meaning |
|--------|---------|
| `OPEN` | Created, not yet actionable. |
| `READY` | Eligible to start (policy satisfied). |
| `IN_PROGRESS` | Work started. |
| `BLOCKED` | External blocker (access, weather, customer no-show). |
| `DONE` | Completed successfully. |
| `CANCELLED` | Voided / superseded. |

**Open question (product):** Whether `READY` is computed vs stored. Schema can store **authoritative** status with server transitions.

---

## Recommended field categories (not final Prisma)

| Category | Fields (indicative) |
|----------|---------------------|
| Identity | `id`, `tenantId` |
| Parent | `flowGroupId` (required) |
| Optional quote context | `quoteVersionId` (nullable) |
| Classification | `taskType` (enum or string registry: `SITE_SURVEY`, `UTILITY_CHECK`, `AHJ_CHECK`, `INTAKE_CLARIFICATION`, `PHOTO_REQUEST`, …) |
| Source | `sourceType` (e.g. `MANUAL`, `LEAD_CONVERSION`, `IMPORT`) |
| Presentation | `title`, `description` |
| Ownership / execution | `assignedToUserId`, `createdById` |
| Schedule | `dueAt`, `scheduledStartAt`, `scheduledEndAt` |
| Lifecycle | `status`, `startedAt`, `completedAt`, `cancelledAt`, `cancelReason` |
| Lineage | `createdAt`, `updatedAt` |
| Completion | `completionNotes` (optional); evidence via **File** / future `PreJobTaskAttachment` (defer normalized attachment table if Slice 1 uses polymorphic `File.parentType/parentId`). |

---

## Invariants (hard)

1. **`flowGroupId` required**; `tenantId` must match FlowGroup’s tenant.  
2. If **`quoteVersionId` set**, then `QuoteVersion` must belong to a `Quote` whose `flowGroupId` equals this task’s `flowGroupId` (same site).  
3. **No FK** from PreJobTask to `Job`, `Flow`, or `RuntimeTaskInstance`.  
4. **Never** counted as activated runtime history; **never** appears in freeze JSON as a `packageTask` / `runtime` manifest row.  
5. **No automatic promotion** to runtime task on activation.

---

## What not to do (drift traps)

1. **Generic mega `WorkItem`** with `kind = PRE_JOB | RUNTIME | …` — **forbidden** for v3; layers must stay separable.  
2. **`isPreJob` flag on `RuntimeTaskInstance`** — **forbidden**.  
3. **Creating a `Job`** to schedule a survey — **forbidden** (epic 34).  
4. **Storing survey evidence only in unstructured Lead notes** when the data must drive quote authoring — use PreJobTask + file/structured child (when added).  
5. **Implicit carry-forward** of PreJobTask into activation — **forbidden** without explicit future canon + migration rules.  
6. **Using `PreJobTask` as a dumping ground for record completeness** — **forbidden**; use **readiness** on the **Customer**, **QuoteVersion**, or other owning record (see canon `02`).

---

## Deferred / open (explicit)

| Topic | Stance |
|-------|--------|
| Shared base table with RuntimeTask | **Deferred.** Prefer **separate** `PreJobTask` table for Slice 1 clarity; revisit only if Work Station queries force a unified view (then use a **read model** or union query, not a polluted single table). |
| Normalized `PreJobTaskStructuredAnswer` | **Defer** to Slice 2+ unless send-gating requires it. |
| Payment / hold interaction | Out of scope for PreJobTask in this pack. |

---

## Recommendation

Implement **PreJobTask** as its own table, **FlowGroup**-anchored, **optional `quoteVersionId`**, with **status + assignee + simple schedule timestamps**. Keep **all** runtime execution in post-activation models only.
