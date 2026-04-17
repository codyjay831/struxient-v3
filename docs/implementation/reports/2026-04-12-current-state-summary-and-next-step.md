# Current state summary and next step

**Date:** 2026-04-12  
**Author:** Engineering (automated read + synthesis pass)  
**Scope:** Everything actually built in the repo vs. canon / epics / roadmap  
**Purpose:** Honest assessment of what is done, what is missing, where drift exists, and the single best next implementation move.

---

## 1. Purpose

This document reconstructs the current Struxient v3 implementation state by cross-referencing:

- **Canon** (`docs/canon/00–10`)
- **Decision pack** (`docs/decisions/01–05`)
- **Planning** (`docs/planning/01–03`)
- **Epics** (07–13, 29–36, 39, 41, 47–48, etc.)
- **Roadmap** (`docs/implementation-roadmap/01–08`)
- **Implementation reports** (19 after-action reports, all 2026-04-11)
- **Actual code** (Prisma schema, 7 migrations, 17 API route files, `src/server/slice1/`, DTOs, dev pages, seed scripts)

Reports are treated as source of truth for what is present; code was spot-checked against them.

---

## 2. Current implemented state (one paragraph)

The repo contains a **working quote-to-execution spine** from draft through activated field execution, covering roadmap Phases 0–8 in shell form. A seeded tenant can create a draft quote version with catalog and quote-local manifest lines, run compose preview, send (freezing plan + package with SHA-256 integrity), sign (creating an idempotent Job per FlowGroup + QuoteSignature), activate (creating Flow + RuntimeTask rows from the frozen package while skipping skeleton slots), then start and complete both runtime and skeleton tasks through tenant-scoped POST APIs. A centralized actionability module evaluates start/complete eligibility (activation-only MVP) and surfaces `canStart` / `canComplete` with reason codes on `GET /api/flows/[flowId]` and `GET /api/jobs/[jobId]`. A dev work-feed page (`/dev/work-feed`) lets a developer click Start/Complete in the browser and see the feed update.

---

## 3. Completed capability areas

### 3.1 Schema foundation
**Status: done.**
23 Prisma models. Slice 1 base + extension (PreJobTask, QuoteLocalPacket/Item) merged. 7 migrations covering base schema, compose preview backfill, Phase 5 (Job/Sign), Phase 6 (Flow/Activation/RuntimeTask), auto-activate flag, Phase 7 (TaskExecution), and skeleton partial unique index. CHECK constraints enforce line-item XOR scope pin and positive quantity. `AuditEvent` model exists with `QUOTE_VERSION_SENT`, `QUOTE_VERSION_SIGNED`, `QUOTE_VERSION_ACTIVATED` event types.

### 3.2 Tenant boundary (dev-grade)
**Status: functional stub, not production auth.**
`resolveTenantIdForRequest` resolves from `STRUXIENT_DEV_TENANT_ID` env, or `x-struxient-tenant-id` header (blocked in production unless `STRUXIENT_ALLOW_TENANT_HEADER=true`). No session, JWT, user login, or membership check. Every API route calls `requireTenantJson`. Server Components use `resolveTenantIdFromServerEnv` (env-only).

### 3.3 Quote draft authoring
**Status: done for spine.**
- Line-item CRUD (POST/PATCH/DELETE) with XOR scope pin enforcement, tenant-safe revision and local-packet lookups, and draft-only guard.
- Proposal group rename (PATCH).
- Pinned workflow version set/clear (PATCH on quote version) with published + tenant validation and staleness bump.
- Compose staleness token bumped on line/group/pin mutations.
- Invariant assertions (`src/server/slice1/invariants/`) for scope, pre-job, local-packet, line-item, and version-draft rules.

**Not done:** Full CRUD for Quote shell, Customer, FlowGroup, User, catalog (ScopePacket/Revision), or WorkflowTemplate/Version — all are seed-only. No list/search APIs for any entity. No structured input answers, tier resolution, or assembly support. No proposal-group create/delete/reorder. No line-item archive/restore. No quote-local packet CRUD API (model exists, seed creates one, but no route).

### 3.4 Compose preview
**Status: done for MANIFEST + SOLD_SCOPE.**
Deterministic plan-task-id and package-task-id generation from `(quoteVersionId, lineItemId, scopePin, quantityIndex, targetNodeKey)` with `scopeSource` tag. MANIFEST lines expand catalog + local packet task lines. SOLD_SCOPE lines emit `COMMERCIAL_SOLD` plan rows + package slots with a default-node-placement warning. Staleness echo. Errors block, warnings surfaced.

**Not done:** Warning acknowledgment flow in send (`acknowledgedWarningCodes`). Exclude toggles, manual-row overrides, assembly expansion (epic 31 deferred features). Line-level `targetNodeKey` override for SOLD_SCOPE.

### 3.5 Send / freeze
**Status: done.**
Atomic `draft → sent` with `sendQuoteVersionForTenant`: recomputes compose, builds `generatedPlanSnapshot.v0` + `executionPackageSnapshot.v0`, SHA-256 hashes, staleness guard, idempotent `sendClientRequestId`, actor validation. `AuditEvent` written (first success only). `GET …/freeze` returns frozen JSON + hashes for SENT/SIGNED versions. Compose errors block send; empty plan/package blocked.

**Not done:** Async send for very large quotes. Customer notification / email on send (epic 12). Warning-acknowledgment checkboxes before send. PDF / proposal payload generation.

### 3.6 Sign + job shell
**Status: done.**
`sent → signed` with `signQuoteVersionForTenant`: idempotent Job per FlowGroup (`Job.flowGroupId` unique), QuoteSignature, `AuditEvent`. Optional `Tenant.autoActivateOnSign` (same-transaction activation with rollback on failure). `GET /api/jobs/[jobId]` returns flow group, flows with activation and runtime tasks including execution projection + actionability.

**Not done:** Portal / e-sign (O16). Job status management (sold/in_progress/on_hold/complete/cancelled). Void-after-sign. `createJobOnSign` as configurable flag (currently always creates job on sign; `autoActivateOnSign` flag for chaining activation). Job number generation is not exposed.

### 3.7 Activation + runtime materialization
**Status: done with hardening.**
`activateQuoteVersionForTenant`: frozen plan hash verification, plan↔package slot alignment, package hash verification, workflow pin consistency, idempotent Activation per version, Flow creation, RuntimeTask rows for manifest slots (WORKFLOW/skeleton slots skipped with `skippedSkeletonSlotCount`). `AuditEvent` on activation. `ensureActivationForSignedQuoteVersion` alias for sign integration.

**Not done:** Change orders / reactivation. PM-injected runtime tasks (epic 35). Multi-flow (O2). Compensating procedures for failed activation.

### 3.8 Task execution (runtime + skeleton)
**Status: done for MVP.**
- **Runtime:** `startRuntimeTaskForTenant` / `completeRuntimeTaskForTenant` — append-only STARTED/COMPLETED, unique `(runtimeTaskId, eventType)`, idempotent replay, activation gate, actor validation.
- **Skeleton:** `startSkeletonTaskForTenant` / `completeSkeletonTaskForTenant` — same pattern, partial unique `(flowId, skeletonTaskId, eventType)` where `taskKind = SKELETON`, snapshot validation.
- Both use centralized actionability evaluator.

**Not done:** Outcomes, evidence/photo gates (epic 42), cancel/fail events, multi-cycle (pause/resume), QC second sign-off, time tracking, notes beyond optional string on event.

### 3.9 Flow execution read + work items
**Status: done.**
`getFlowExecutionReadModel` + `toFlowExecutionApiDto`: skeleton tasks parsed from workflow snapshot with SKELETON TaskExecution projection, runtime tasks with RUNTIME execution summary, merged `workItems` interleaved per node (skeleton then runtime), `workflowNodeOrder` from snapshot. Per-item `actionability` with reason codes.

### 3.10 Central actionability / eligibility (epic 30 shell)
**Status: MVP shell done.**
`evaluateRuntimeTaskActionability` / `evaluateSkeletonTaskActionability` in `src/server/slice1/eligibility/task-actionability.ts`. Schema-versioned (`TASK_ACTIONABILITY_SCHEMA_VERSION = 1`). Mutations and read DTOs both use the evaluator. Start reasons: `FLOW_NOT_ACTIVATED`, `TASK_ALREADY_COMPLETED`, `TASK_ALREADY_STARTED`. Complete reasons: `FLOW_NOT_ACTIVATED`, `TASK_NOT_STARTED`, `TASK_ALREADY_COMPLETED`.

**Not done:** `HOLD_ACTIVE`, `PAYMENT_GATE_UNMET`, `NODE_NOT_READY`, `DETOUR_BLOCKS`, `STRUCTURED_INPUT_MISSING` — these require Hold, PaymentGate, DetourRecord, CompletionRule, StructuredInputAnswer models that do not exist in the schema. Admin `force_start`. Scheduling (explicitly excluded per `decisions/01`).

### 3.11 Dev tooling + UI
**Status: adequate for spine validation.**
- Seed: `prisma/seed.js` (draft with catalog + local lines, SOLD_SCOPE, PreJobTask, invariant checks, writes `.env.local`).
- Activated-path: `prisma/seed-activated-path.ts` (`db:seed:activated` — send → sign → activate, writes flow/job/user ids).
- Dev pages: `/dev/quote-scope`, `/dev/flow`, `/dev/work-feed` (client-side start/complete with actionability).
- Home page: full API index with links.
- `STRUXIENT_DEV_TENANT_ID`, `STRUXIENT_DEV_QUOTE_VERSION_ID`, `STRUXIENT_DEV_FLOW_ID`, `STRUXIENT_DEV_JOB_ID`, `STRUXIENT_DEV_USER_ID` in `.env.local`.

### 3.12 Audit
**Status: partial.**
`AuditEvent` rows written on send, sign, activate (3 event types). No read API. No audit trail for draft mutations, line edits, or task execution events. No viewer/admin UI.

---

## 4. Important gaps / unfinished areas

### 4.1 Core system gaps (things that must exist for production)

| Gap | Severity | Notes |
|-----|----------|-------|
| **Real authentication + authorization** | **Critical** | No user login, no session/JWT, no RBAC, no membership check. Tenant id is an env var or an unverified header. Any caller with the tenant id can sign, activate, and start tasks. This is the single largest gap between "working spine" and "shippable product." |
| **Entity CRUD beyond lines** | **High** | No API for creating/editing Quote, Customer, FlowGroup, User, ScopePacket, WorkflowTemplate, or WorkflowVersion. All are seed-created. The system cannot be used outside a single seeded dataset. |
| **Holds / payment gates (eligibility composition)** | **High** | The actionability evaluator shell exists but cannot evaluate holds or payment because `Hold`, `PaymentGate`, `PaymentGateTarget`, `DetourRecord` models do not exist. Real field MVP needs at least holds to block work. |
| **Node readiness / completion rules** | **Medium** | Eligibility does not consider node ordering or completion gates from the workflow snapshot. All tasks are startable if activated, even if their node should not be open yet. |
| **Audit read API + expansion** | **Medium** | 3 event types written, no read. Draft mutations, task executions, and line edits produce no audit rows. Canon says audit is important; the write-only state is a liability for support and compliance. |
| **Change orders (epic 37)** | **Medium** | No CO flow. Once activated, runtime is immutable (no supersede, no void-and-reactivate). |

### 4.2 Safety / integrity gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| **Tenant isolation is unverified** | **Critical** | Tenant boundary relies on query filters and `requireTenantJson`. No RLS. A bug in a query could leak cross-tenant data. No integration test suite verifies isolation. |
| **No test suite** | **High** | Zero automated tests in the repo. No unit tests for mutations, compose engine, actionability, or invariants. No integration tests. The seed scripts serve as smoke tests only. |
| **Frozen blob integrity is forward-only** | **Low** | Plan and package snapshots are JSON blobs on the row. No migration plan for schema-versioned blob evolution. Canon notes O12 as open. |

### 4.3 Canon alignment gaps

| Area | Status | Notes |
|------|--------|-------|
| **`planTaskId` determinism** | **Aligned** | Composite key matches `planning/01` spec. |
| **Skeleton not duplicated as runtime** | **Aligned** | `skippedSkeletonSlotCount` correctly skips WORKFLOW source slots. |
| **Task identity — no bare `taskId`** | **Aligned** | API uses `runtimeTaskId` + `skeletonTaskId` consistently. |
| **Scheduling non-authoritative** | **Aligned** | Not evaluated in eligibility per `decisions/01`. |
| **Payment gate targeting** | **Not yet applicable** | PaymentGate/Target models do not exist; when added, must use explicit skeleton/runtime ids per `decisions/02`. |
| **Inspection → manifest fold** | **Aligned** | No parallel inspection truth per `decisions/03`. |
| **PreJobTask stays off execution graph** | **Aligned** | PreJobTask on FlowGroup, not in RuntimeTask or TaskExecution. |
| **QuoteLocalPacket fork rule** | **Partially aligned** | QuoteLocalPacket model exists with `originType` enum, but no fork-on-edit API (no quote-local CRUD at all). |
| **`executionMode` naming** | **Minor drift** | Schema uses `MANIFEST` and `SOLD_SCOPE`. Canon/epics reference `GENERATES_TASKS`, `ARTIFACT_ONLY`, `NO_EXECUTION` in some places (v2 naming). Implementation settled on `MANIFEST` / `SOLD_SCOPE`, which is defensible but should be explicitly noted as v3-final vocabulary. |
| **Proposal payload / customer snapshot** | **Missing** | Epic 08 specifies `customerSnapshot` and `proposalThemeId` on QuoteVersion. Neither exists in schema. Not blocking for spine but matters for send UX. |

### 4.4 Optional polish / UX gaps (explicitly lower priority)

- Full quote editor UI (epic 11) — desktop layout, autosave, preflight modal
- Customer portal (epics 53–55)
- PDF / proposal generation (epic 12)
- Notifications / email (epic 56)
- Schedule blocks + planning UX (epics 45–46)
- Mobile field app (epic 43)
- AI assistance (epics 21–22)
- Learning / actuals feedback (epic 52)
- Reporting / dashboards

---

## 5. Risks / drift concerns

1. **Auth debt compounds.** Every new mutation and read API added without auth increases the surface area that must be retrofitted. The dev-header pattern is not a partial solution — it is zero auth. The longer this grows, the harder the retrofit.

2. **No tests means no regression confidence.** The spine has meaningful business logic (compose determinism, freeze integrity, activation idempotency, actionability evaluation). All of it is verified only by manual seed + dev-page clicking. One mutation refactor could silently break freeze integrity with no signal.

3. **Entity CRUD gap blocks realistic usage.** The system can only operate on its own seed data. Without Quote/Customer/FlowGroup/User creation APIs, no second scenario can be tested, and no production onboarding is possible.

4. **Eligibility shell is honest but shallow.** The actionability module is correctly structured but currently only checks activation status. Real field use requires at least hold-based blocking before a crew can trust the "Start" button. Shipping the work feed without holds risks training users to ignore eligibility signals.

5. **`executionMode` vocabulary should be canonized.** The code uses `MANIFEST` / `SOLD_SCOPE`; some epics/foundation docs still reference v2 names. A short canon addendum or decision footnote would prevent future confusion.

6. **`package.json` description is stale.** Says "docs + Prisma schema (application code TBD)" — the repo is a working Next.js application.

---

## 6. Recommended next implementation step

### **Implement real authentication and tenant membership**

Add session-based or JWT-based user authentication with tenant membership verification. At minimum:

1. **User login** — email/password or provider-based (NextAuth / custom).
2. **Session → user → tenant resolution** replacing the env-var / header pattern.
3. **Membership check** — verify the authenticated user belongs to the tenant before every mutation and read.
4. **Actor validation** — `actorUserId` on task execution, send, sign, and activate should come from the session, not from a request body field that any caller can forge.
5. **RBAC stub** — at minimum, distinguish "can send" / "can sign" / "can activate" / "can start task" from "can read."

This does **not** need to be a full permissions engine. It needs to be real enough that:
- A route cannot be called without a logged-in user.
- A user cannot operate on a tenant they do not belong to.
- `actorUserId` is derived from the session, not trusted from the client.

---

## 7. Why this is the best next step

1. **Every existing mutation trusts caller-provided identity.** `actorUserId` on start/complete, `sentByUserId` on send, `recordedByUserId` on sign — all come from the request body. This is not "will need auth later"; it is "cannot ship without auth." The gap is structural, not cosmetic.

2. **Auth is a cross-cutting concern that gets harder to retrofit.** Every new mutation, route, or page added without auth adds to the retrofit surface. Doing it now, while the route count is ~17 and the mutation count is ~10, is dramatically cheaper than doing it at 50+.

3. **Entity CRUD (the second-best option) would multiply the unauth'd surface.** Adding Customer/FlowGroup/Quote creation APIs without auth means more routes that trust unverified callers, making the eventual auth retrofit larger and riskier.

4. **Testing (third-best option) is more valuable after auth exists.** Integration tests for tenant isolation are meaningless if tenant resolution is "whatever the env var says." Auth defines the actual security boundary that tests should verify.

5. **The spine is stable enough to support this investment.** The quote-to-execution flow works end-to-end. No new business logic is blocked on auth. This is a foundation hardening step, not a detour.

---

## 8. What should explicitly wait

| Item | Why it should wait |
|------|--------------------|
| **Holds / payment gates schema** | Eligibility shell is correctly stubbed. Adding Hold/PaymentGate models is meaningful work but is product-dependent ("do first customers need payment gating?"). Auth is a universal prerequisite; holds are customer-specific. |
| **Entity CRUD (Quote, Customer, FlowGroup)** | Should come immediately after auth so new routes are born auth'd. |
| **Change orders / void** | Requires stable activation + potentially multi-version semantics. Spine is not broken without it yet. |
| **Node readiness / completion rules** | Needs richer workflow snapshot semantics (gates, dependencies). Not blocking field MVP if holds exist. |
| **Quote editor UI** | Frontend investment. Backend spine is ready. Wait until auth + CRUD exist. |
| **Test suite** | High priority but most valuable after auth defines the real security surface. Can start with compose/freeze unit tests in parallel if capacity allows. |
| **Portal, notifications, PDF** | Product-surface features. Not blocking spine integrity. |

---

## Appendix: file inventory summary

| Area | Count | Key paths |
|------|-------|-----------|
| Prisma models | 23 | `prisma/schema.prisma` |
| Migrations | 7 | `prisma/migrations/` |
| API route files | 17 | `src/app/api/` |
| Slice1 mutations | 9 | `src/server/slice1/mutations/` |
| Slice1 reads | 6 | `src/server/slice1/reads/` |
| Compose-preview | 7 | `src/server/slice1/compose-preview/` |
| Eligibility | 1 | `src/server/slice1/eligibility/` |
| Invariants | 7 | `src/server/slice1/invariants/` |
| DTO mappers | 5 | `src/lib/` |
| Dev pages | 7 | `src/app/dev/` |
| Implementation reports | 19 | `docs/implementation/reports/` |
| Canon docs | 11 | `docs/canon/` |
| Decision docs | 5 | `docs/decisions/` |
| Epic docs | ~60 | `docs/epics/` |
