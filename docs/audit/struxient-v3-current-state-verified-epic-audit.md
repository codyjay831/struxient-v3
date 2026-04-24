# Struxient v3 Current State Verified Epic Audit

## 1. Executive status
**Project State:** Foundational-Functional (Slice 1). The project has a very solid commercial-to-execution spine implemented in the server layer, but the UI is primarily in "dev-only" mode and critical post-activation management (Change Orders, Payment Gating) is missing.

**Current Phase:** Transitioning from Phase 5 (Bridge: Freeze → Activation) to Phase 6 (Execution Surfaces).

**Top Completed Foundations:**
1. **Commercial Integrity Chain:** Draft → Sent (Freeze) → Signed → Activated with SHA256 integrity hashing of frozen artifacts.
2. **Trade-First Model:** Deeply relational schema centering on Quotes, Versions, and Line Items.
3. **Idempotent Activation Engine:** Deterministic materialization of `Flow` and `RuntimeTask` from frozen snapshots.
4. **Auth & Tenancy Spine:** Strict tenant isolation and capability-based authorization (OFFICE_ADMIN, FIELD_WORKER).
5. **Quote Workspace Aggregator:** High-performance read model for office navigation.

**Biggest Missing Pieces:**
1. **Production Workspace UI:** Current UI is under `src/app/dev` and lacks the production-grade theme and layout defined in epics.
2. **Change Order Engine (Epic 37):** No mechanism to modify scope post-activation.
3. **Payment Gating (Epic 47):** Money/Hold status does not yet block field actionability.
4. **Catalog/Template Editors (Epics 15, 23):** Management of packets and workflows is done via database seeds, not UI.
5. **Customer Portal (Epic 53-55):** No public-facing review/sign flow.

**Biggest Doc↔Code Drift Risks:**
1. **QuoteLocalPacket Usage:** Canon implies `QuoteLocalPacket` is the fork center, but `QuoteLineItem` can bypass it to point directly at library revisions.
2. **PreJobTask doc lag (resolved in canon 2026):** Schema and **read paths** exist (quote workspace, global work feed, office `/work`); earlier notes claiming total invisibility were **stale**. Remaining gap is **mutations / full lifecycle**, not discovery.
3. **Doc-Maturity Gap:** The implementation for core lifecycle (Epics 07, 08, 12, 13, 33) is significantly more detailed and robust than the current "thin" documentation in those files.

---

## 2. Source map used
### Canon
- `docs/canon/00-canon-index.md`
- `docs/canon/01-v3-core-thesis.md`
- `docs/canon/02-core-primitives.md`
- `docs/canon/03-quote-to-execution-canon.md`

### Epics
- `docs/epics/01A-epic-roadmap-index.md`
- `docs/epics/07-quotes-epic.md`
- `docs/epics/12-quote-send-freeze-epic.md`
- `docs/epics/33-activation-epic.md`

### Planning/Decisions
- `docs/decisions/01-scheduling-authority-decision.md`
- `docs/decisions/02-payment-hold-task-id-mapping-decision.md`
- `docs/decisions/04-job-anchor-timing-decision.md`

### Schema/Migrations
- `prisma/schema.prisma`
- `prisma/migrations/20260411120000_slice1_base_and_extension`
- `prisma/migrations/20260414120000_phase6_flow_activation_runtime`

### Server/API
- `src/server/slice1/mutations/create-commercial-quote-shell.ts`
- `src/server/slice1/mutations/send-quote-version.ts`
- `src/server/slice1/mutations/activate-quote-version.ts`
- `src/server/slice1/reads/quote-workspace-reads.ts`
- `src/server/slice1/compose-preview/compose-engine.ts`

### UI/Routes
- `src/app/dev/quotes/[quoteId]/page.tsx`
- `src/app/api/commercial/quote-shell/route.ts`

### Tests
- `scripts/integration/auth-spine.integration.test.ts` (Comprehensive lifecycle test)

---

## 3. Epic inventory
| Epic / File | Purpose | Status | Verified Doc Evidence | Verified Code Evidence | Gaps / Drift | Confidence |
|---|---|---|---|---|---|---|
| 01-leads | CRM Intake | **Not started (app)** | Reference-grade epic spec | **`Lead` model + `Quote.leadId` in Prisma** (migration `20260424120000_add_lead_mvp_and_quote_lead_id`); **no** lead reads/mutations/routes/UI yet | Intake today remains **Customer → FlowGroup → quote shell**; conversion-first lead app layer still to build | High |
| 02-customers | Identity | **Complete** | Solid CRUD doc | `Customer` model; `customer-reads.ts` | None | High |
| 03-flowgroup | Anchor | **Complete** | Structural anchor doc | `FlowGroup` model; `flow-group-reads.ts` | Central anchor for all work | High |
| 07-quotes | Shell | **Mostly Complete** | Graded C+ in scorecard | `create-commercial-quote-shell.ts` | Code is better than doc | High |
| 08-quote-versions | Versions | **Complete** | Lifecycle doc | `create-next-quote-version.ts` | DRAFT/SENT/SIGNED wired | High |
| 09-quote-line-items | Scope | **Complete** | Commercial fields | `quote-line-item-mutations.ts` | MANIFEST vs SOLD supported | High |
| 12-quote-send-freeze | Integrity | **Complete** | Freeze semantics doc | `send-quote-version.ts` | SHA256 hashing operational | High |
| 13-signatures | Acceptance | **Mostly Complete** | Signature method doc | `sign-quote-version.ts` | Office sign only; portal missing | High |
| 15-scope-packets | Catalog | **Partial** | Authoring surface doc | `ScopePacket` / `Revision` model | Editor UI missing; seeding only | High |
| 23-process-templates | Skeleton | **Partial** | Graph skeleton doc | `WorkflowTemplate` / `Version` model | Editor UI missing; seeding only | High |
| 31-generated-plan | Artifact | **Complete** | Snapshot artifact doc | `buildGeneratedPlanSnapshotV0` | Stored as JSON in QuoteVersion | High |
| 33-activation | Materialization | **Complete** | Materialization doc | `activate-quote-version.ts` | Deterministic population working | High |
| 34-job-anchor | Execution | **Complete** | Execution anchor doc | `Job` model; `job-shell.ts` | Activation links Job to Flow | High |
| 35-runtime-tasks | Instances | **Mostly Complete** | Manifest work doc | `RuntimeTask` model | CRUD/Status tracked in DB | High |
| 39-work-station | Work Feed | **Partial** | Actionable feed doc | `src/app/dev/work-feed/` | Dev UI only; needs prod layout | High |
| 47-payment-gates | Gating | **Not Started** | Gating logic doc | `prisma` enums only | No enforcement engine found | High |

---

## 4. Capability-by-capability audit
### Auth / Tenancy / Capability
- **Design:** Tenant-isolated roles (OFFICE, FIELD, READ_ONLY).
- **Code Status:** **Complete**. `api-principal.ts` enforces tenant isolation and `office_mutate` vs `field_execute` capabilities.
- **Missing:** Role assignment UI.
- **Confidence:** High.

### Quote Shell Creation
- **Design:** Create Customer + FlowGroup + Quote + Version 1 in one transaction.
- **Code Status:** **Complete**. `create-commercial-quote-shell.ts` handles complex strategies (new vs attach).
- **Confidence:** High.

### Quote Versioning
- **Design:** Immutable SENT/SIGNED versions; head version cloning for next draft.
- **Code Status:** **Complete**. `create-next-quote-version.ts` clones head correctly.
- **Confidence:** High.

### Scope / Line-Item Foundation
- **Design:** Line items can be `MANIFEST` (packet-backed) or `SOLD_SCOPE` (commercial direct).
- **Code Status:** **Complete**. `compose-engine.ts` correctly expands quantity and validates `targetNodeKey`.
- **Confidence:** High.

### Packet Model / Task Definition
- **Design:** Library-backed packets with task definitions.
- **Code Status:** **Partial**. Schema and models are solid, but UI editors and AI drafting (Epics 21, 22) are absent.
- **Confidence:** High.

### PreJobTask
- **Design:** **Human operational** site work on `FlowGroup` before activation; **not** record-readiness junk drawer (see `docs/canon/02-core-primitives.md`).
- **Code Status:** **Partial.** **Schema** + **read-only** visibility: `getQuoteWorkspaceForTenant` (`preJobTasks`), `getGlobalWorkFeedReadModelForTenant` / `GET /api/work-feed`, office `src/app/(office)/work/page.tsx` + quote workspace UI. **No** application CRUD mutations or `TaskExecution` linkage yet.
- **Confidence:** High.

### Compose Preview
- **Design:** Non-persisted preview of plan/package expansion.
- **Code Status:** **Complete**. `build-compose-preview.ts` used in dev workspace to show errors/warnings.
- **Confidence:** High.

### Send / Freeze / Hash Integrity
- **Design:** Deterministic snapshots with SHA256 hashes.
- **Code Status:** **Complete**. `send-quote-version.ts` computes and stores hashes; `activate` verifies them.
- **Confidence:** High.

### Activation / Runtime Instantiation
- **Design:** Instantiate `RuntimeTask` from frozen snapshots.
- **Code Status:** **Complete**. `activate-quote-version.ts` populates nodes accurately.
- **Confidence:** High.

### Payment Gating / Hold Model
- **Design:** Decision 02.
- **Code Status:** **Absent**. No engine found to enforce holds on field execution routes.
- **Confidence:** High.

### Workspace UI
- **Design:** Integrated lifecycle navigation.
- **Code Status:** **Partial**. Very functional dev UI under `src/app/dev/quotes/[quoteId]`, but not "production."
- **Confidence:** High.

---

## 5. Code reality vs canon
| Canon Says | Code Does | Evidence | Risk | Recommended Disposition |
|---|---|---|---|---|
| `QuoteLocalPacket` is the fork center. | `QuoteLineItem` links directly to local OR library packet. | `prisma/schema.prisma` fields. | Confused authoring ownership. | **Canon wins:** UI should force forking. |
| FlowSpec is process skeleton. | Tables named `WorkflowTemplate` / `Version`. | `prisma/schema.prisma`. | Naming confusion. | **Docs win:** Code is functional; docs provide better product naming. |
| PreJobTasks live on FlowGroup. | Model present; **read paths wired** (workspace + work feed). | `quote-workspace-reads.ts`, `global-work-feed-reads.ts`. | Lifecycle/evidence still thin. | **Optional later:** CRUD + evidence; **canon** narrows what belongs here vs readiness. |
| AI drafts local packets. | No AI logic in mutations. | `rg "AI"` in server. | False sense of AI capability. | **Unresolved:** Needs decision on AI integration layer. |

---

## 6. What is actually usable today?
**Fully Operational Flows:**
- Create quote shell (Customer + FG + Quote + V1).
- View version history and workspace read model.
- Pin workflow versions to drafts.
- Add `MANIFEST` and `SOLD_SCOPE` line items.
- Run compose preview (expansion logic).
- Perform Send/Freeze (with hash protection).
- Sign quote (Office-recorded).
- Activate execution (materialize RuntimeTasks).
- Start/Complete runtime tasks in the field (Dev UI).

---

## 7. Missing epic list
### Foundational Blockers
- **Epic 37 (Change Orders):** Critical for real-world construction where scope changes post-sign. (Confidence: High)
- **Epic 15/23 (Editor UI):** Need visual editors for catalog and workflow templates. (Confidence: High)

### Core Business Flow Incomplete
- **Epic 47/48 (Payment Gating):** Enforce money gates on field actionability. (Confidence: Medium)
- **Epic 53-55 (Customer Portal):** Required for self-service signing. (Confidence: High)

### UI/Workspace Incomplete
- **Phase 6 Production UI:** Themed layout, production routes. (Confidence: High)
- **PreJobTask lifecycle (optional):** Read visibility exists; **authoring/start/complete** and normalized evidence remain **product choice**, not a blocker for keeping the primitive narrow. (Confidence: Medium)

---

## 8. Recommended next execution order
1. **Phase 6 Production Workspace Shell:** Move dev functionality to production routes to prove user value.
2. **Epic 15/23 Catalog Editors:** Allow trade experts to define packets/workflows without DB seeding.
3. **Epic 47/48 Payment Gating:** Link field work to financial status (Decision 02).
4. **Epic 37 Change Orders:** Support the "drift" of real-world jobs.
5. **Epic 53 Portal Shell:** Enable customer self-service.

---

## 9. Open human decision points
1. **AI Integration Depth:** Does the AI live in the server mutations, or is it purely a client-side agent that "suggests" standard `QuoteLocalPacket` modifications?
2. **Portal Scope:** Does the Homeowner see the full runtime task graph, or only commercial gates and evidence?

---

## 10. Final verdict
- `Project state: Foundational-Functional (Slice 1)`
- `Most likely next epic: Phase 6 Production UI or Epic 15 Catalog Editor`
- `Biggest drift risk: Documentation is lagging behind the mature server-side implementation.`
- `Biggest false sense of completion risk: Field workers can complete tasks, but the system cannot yet stop them if the homeowner hasn't paid (missing Gating).`

---
*Verified via Triangle Mode Audit on 2026-04-17*
