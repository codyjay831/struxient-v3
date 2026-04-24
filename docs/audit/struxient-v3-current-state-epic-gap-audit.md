# Struxient v3 — Current State Epic & Gap Audit (2026-04-17)

## Section 1 — Executive status

### Overall State
Struxient v3 is in a strong **Foundational Slice (Slice 1)** state. The project has successfully established the core "trade-first" relational foundation, moving beyond the "raw-task-first" confusion of v2. The complete commercial lifecycle—from quote shell creation to activation-driven runtime task instantiation—is functionally implemented in the database and server-side logic.

### Current Phase
The project is transitioning from **Phase 5 (Bridge: Freeze → Activation)** into **Phase 6 (Execution surfaces)**. The commercial engine is robust; the execution engine is structurally sound but lacks a polished, production-ready UI for field operators.

### Top 5 Completed Foundations
1. **Commercial Lifecycle Spine**: Atomically handles Draft → Sent (Freeze) → Signed → Activated with cryptographic hash integrity for frozen artifacts (`src/server/slice1/mutations/`).
2. **Trade-First Primitive Model**: Solid `Customer` → `FlowGroup` → `Quote` → `QuoteVersion` → `ProposalGroup` → `LineItem` hierarchy (`prisma/schema.prisma`).
3. **Idempotent Activation Engine**: Deterministically populates `Flow` and `RuntimeTask` rows from frozen `executionPackageSnapshot` blobs, avoiding "dual-progress" math (`src/server/slice1/mutations/activate-quote-version.ts`).
4. **Tenant-Bound Auth Spine**: Strict role-based (OFFICE_ADMIN, FIELD_WORKER) and tenant-isolated access control integrated into all routes (`src/lib/auth/api-principal.ts`).
5. **Quote Workspace Read Model**: High-performance aggregation of shell data, version history, and head line items into a single navigation DTO (`src/server/slice1/reads/quote-workspace-reads.ts`).

### Top 5 Biggest Missing Pieces
1. **Production Office Workspace**: Most "Office" UI currently lives in `src/app/dev/` and lacks a cohesive, production-styled layout for daily estimator use.
2. **AI-Assisted Authoring (Epics 21, 22)**: While the `QuoteLocalPacket` model exists to support it, the actual AI drafting logic and UI integration are absent from `src/server/slice1`.
3. **Template/Catalog Editors (Epics 15, 23)**: Catalog management currently relies on seeding; no visual editor exists for `ScopePacket` revisions or `WorkflowTemplate` node/gate structures.
4. **Payment Gating & Holds (Epics 47, 48)**: Basic models exist, but the "payment-hold-task-id-mapping" (Decision 02) and active gate enforcement during field execution are thin.
5. **Customer Portal (Epics 53-55)**: No code found for the public-facing customer signature or review environment.

### Top 5 Doc↔Code Drift Risks
1. **QuoteLocalPacket vs LineItem**: Canon (Doc 03) emphasizes `QuoteLocalPacket` as the fork center for local work, but code (`prisma/schema.prisma`) allows `QuoteLineItem` to point directly to `ScopePacketRevision` OR `QuoteLocalPacket`. Implementation favors direct line-item control.
2. **Thin Documentation for Strong Code**: Epics 07 (Quote Shell), 08 (Versions), and 33/34 (Activation/Job) are graded poorly in the audit scorecard (C+/B-) but have very mature implementations in `src/server/slice1/mutations`. The docs need to catch up to the "ground truth" of the code.
3. **PreJobTask Visibility**: `PreJobTask` model exists and is well-structured on `FlowGroup`, but it is currently invisible in the `QuoteWorkspaceDto` and has no dedicated dev UI.
4. **FlowSpec Naming**: Docs call the process skeleton `FlowSpec`; code uses `WorkflowTemplate` / `WorkflowVersion` / `Flow`.
5. **Scheduling Authority**: Decision 01 (Non-authoritative scheduling) is reflected in the lack of an engine, but the UI placeholders for "dates" on `PreJobTask` and `RuntimeTask` suggest a risk of users expecting enforcement.

---

## Section 2 — Source map used

### Canon (Normative)
- `docs/canon/00-canon-index.md` (The "One-Paragraph Model")
- `docs/canon/01-v3-core-thesis.md` (Trade-first logic)
- `docs/canon/02-core-primitives.md` (Object ownership)
- `docs/canon/03-quote-to-execution-canon.md` (The Freeze gate)

### Epics (Product Contracts)
- `docs/epics/01A-epic-roadmap-index.md` (Dependency order)
- `docs/epics/07-quotes-epic.md` (Quotes shell)
- `docs/epics/12-quote-send-freeze-epic.md` (Freeze semantics)
- `docs/epics/33-activation-epic.md` (Activation flow)
- `docs/epic-completeness-audit/01-epic-completeness-scorecard.md` (Self-audit results)

### Schema / Migrations
- `prisma/schema.prisma` (Slice 1 + Extensions)
- `prisma/migrations/20260411120000_slice1_base_and_extension` (Core tables)
- `prisma/migrations/20260414120000_phase6_flow_activation_runtime` (Execution bridge)

### APIs / Server Mutations
- `src/server/slice1/mutations/create-commercial-quote-shell.ts`
- `src/server/slice1/mutations/send-quote-version.ts` (Freeze logic)
- `src/server/slice1/mutations/activate-quote-version.ts` (Activation logic)
- `src/server/slice1/reads/quote-workspace-reads.ts` (Aggregation)

### UI / Workspace
- `src/app/dev/quotes/[quoteId]/page.tsx` (Dev workspace shell)
- `src/app/dev/quotes/[quoteId]/quote-workspace-compose-send-panel.tsx`
- `src/app/dev/quotes/[quoteId]/quote-workspace-activate-signed.tsx`

### Tests
- `scripts/integration/auth-spine.integration.test.ts` (Full e2e lifecycle test)

---

## Section 3 — Epic inventory

| Epic # | Doc Name | Purpose | Status | Evidence (Code) | Gaps / Drift | Confidence |
|---|---|---|---|---|---|---|
| 01 | Leads | CRM Intake | **Schema only** | `Lead` + `Quote.leadId` in `prisma/schema.prisma` (minimal MVP shape; **no** app CRUD) | **Prior audit row was wrong:** there was **no** Lead in Prisma until migration `20260424120000_add_lead_mvp_and_quote_lead_id`. Reads/mutations/UI/convert still absent | High |
| 02 | Customers | Identity | **Mostly Complete** | `Customer` model; `customer-reads.ts` | Solid CRUD | High |
| 03 | FlowGroup | Project Anchor | **Complete** | `FlowGroup` model; `flow-group-reads.ts` | Central anchor for Jobs/Quotes | High |
| 07 | Quotes (shell) | Commercial Entry | **Mostly Complete** | `create-commercial-quote-shell.ts` | Code far exceeds Doc Grade (C+) | High |
| 08 | Quote Versions| Lifecycle | **Complete** | `create-next-quote-version.ts` | Full DRAFT/SENT/SIGNED state chain | High |
| 09 | Line Items | Commercial Scope| **Mostly Complete** | `quote-line-item-mutations.ts` | Full support for MANIFEST vs SOLD | High |
| 12 | Send / Freeze | Integrity | **Complete** | `send-quote-version.ts`; `freeze-snapshots.ts` | Cryptographic freeze blobs working | High |
| 13 | Signatures | Acceptance | **Mostly Complete** | `sign-quote-version.ts`; `QuoteSignature` model | Office-recorded signatures only | High |
| 15 | Scope Packets | Catalog | **Mostly Complete** | `ScopePacket` / `ScopePacketRevision` models | Editor UI missing; seeding only | High |
| 23 | Process Templates| Skeleton | **Mostly Complete** | `WorkflowTemplate` / `WorkflowVersion` models | Editor UI missing; seeding only | High |
| 31 | Generated Plan | Freeze Artifact | **Complete** | `buildGeneratedPlanSnapshotV0` | Stored as JSON in QuoteVersion | High |
| 33 | Activation | Materialization | **Complete** | `activate-quote-version.ts` | Full Flow/RuntimeTask population | High |
| 34 | Job Anchor | Execution Link | **Mostly Complete** | `Job` / `Activation` models; `job-shell.ts` | Structural bridge works | High |
| 35 | Runtime Tasks | Manifest Work | **Mostly Complete** | `RuntimeTask` / `TaskExecution` models | CRUD and status tracking working | High |
| 39 | Work Feed | Field Entrance | **Partial** | `src/app/dev/work-feed/` | Dev UI exists; needs production layout | High |
| 47 | Payment Gates | Gating | **Partial** | `prisma` enums; `Decision 02` | Logic exists; enforcement thin | Medium |

---

## Section 4 — Capability-by-capability implementation audit

### Auth / Tenancy
- **Design**: Tenant-isolated multi-role (OFFICE, FIELD, READ_ONLY).
- **Status**: **Complete**. Principal resolution is baked into mutations.
- **Missing**: Tenant-level settings (Epic 60) and UI for invite/management.
- **Confidence**: High.

### Quote Shell & Versioning
- **Design**: Immutable versions; Draft → Sent → Signed.
- **Status**: **Complete**. Handled via robust atomic transactions.
- **Missing**: Advanced version comparison UI.
- **Confidence**: High.

### Scope / Line-Item / Packet Model
- **Design**: Line items sell packets; Packets are library-backed.
- **Status**: **Mostly Complete**. Support for MANIFEST (expansion) and SOLD (direct) modes is in the code.
- **Drift**: Code allows `QuoteLocalPacket` as a peer to `ScopePacketRevision`, diverging slightly from the "fork-first" rhetoric in early docs.
- **Confidence**: High.

### Compose / Send / Freeze
- **Design**: Capture commercial truth in immutable JSON artifacts.
- **Status**: **Complete**. SHA256 hashing and staleness token logic are fully implemented.
- **Confidence**: High.

### Activation & Flow Runtime
- **Design**: Signed quote versions instantiate `Flow` and `RuntimeTask` on `WorkflowVersion` nodes.
- **Status**: **Complete**. Activation creates all necessary execution bindings.
- **Missing**: "Change Order" mutation path (Epic 37).
- **Confidence**: High.

### Workspace / Office UI
- **Design**: Integrated navigation from shell to execution.
- **Status**: **Partial**. Most logic exists in `quote-workspace-reads.ts`, but UI is currently in "Dev/Developer" mode (`src/app/dev/`).
- **Confidence**: High.

### Integration Test Coverage
- **Design**: Smoke test the "Auth Spine" and Lifecycle.
- **Status**: **Complete**. `auth-spine.integration.test.ts` proves the entire chain works.
- **Confidence**: High.

---

## Section 5 — Code reality vs canon

| Canon Says | Code Does | Risk | Recommended Disposition |
|---|---|---|---|
| `QuoteLocalPacket` is the primary for local mods (Canon 03/05). | `QuoteLineItem` can point directly to local or library packets. | Confusion on where "authoring" truth lives. | **Canon wins**: UI should hide this choice and force local-forking. |
| FlowSpec is the process skeleton. | Tables are `WorkflowTemplate` / `WorkflowVersion`. | Minor naming drift; "FlowSpec" is a better product name. | **Docs win**: Update code comments to use "FlowSpec" terminology. |
| Job activation creates "manifest work" on "nodes". | `RuntimeTask` links to `nodeId` and `lineItemId`. | None. This is a very clean implementation. | **Code wins**: The code has defined the "nodeId" mapping well. |
| AI drafts catalog content before human commit. | No AI logic found in server-side mutations. | User expects AI assistance that isn't built. | **Unresolved**: Needs human priority decision on AI timing. |

---

## Section 6 — “What is actually usable today?”

Verified via `scripts/integration/auth-spine.integration.test.ts` and `src/app/dev/`:

1. **Create Quote Shell**: POST `/api/commercial/quote-shell` creates Customer, FlowGroup, Quote, and Version 1.
2. **Open Workspace**: GET `/api/quotes/[id]/workspace` returns a comprehensive read model.
3. **Pin Workflow**: PATCH `/api/quote-versions/[id]` to select a process skeleton.
4. **Author Scope**: Create line items linked to library packets.
5. **Compose Preview**: POST `/api/quote-versions/[id]/compose-preview` to generate the plan and package.
6. **Freeze/Send**: POST `/api/quote-versions/[id]/send` stores immutable snapshots and SHA256 hashes.
7. **Sign**: POST `/api/quote-versions/[id]/sign` records the office-accepted signature.
8. **Activate**: POST `/api/quote-versions/[id]/activate` creates the Job, Flow, and RuntimeTasks.
9. **Task Execution**: POST `/api/runtime-tasks/[id]/start` and `/complete` record field progress.
10. **Work Feed**: Dev UI lists actionable tasks for field workers.

---

## Section 7 — Missing epic list

### Foundational Blockers
- **Epic 15/23 (Editor UI)**: Cannot manage catalog/templates without database seeding.
- **Epic 37 (Change Orders)**: Cannot modify scope once activated.

### Core Business Flow Incomplete
- **Epic 47/48 (Payment Gating)**: Payment status does not yet block task "Actionability."
- **Epic 18 (Structured Inputs)**: Template definitions exist, but no intake engine.
- **Epic 53-55 (Customer Portal)**: Customer cannot sign their own quotes.

### UI / Workspace Incomplete
- **Phase 6 (Production Workspace)**: Move `src/app/dev` functionality into a themed office app.
- **Mobile Field App**: Dev feed is desktop-first; needs responsive hardening.

### Testing / Hardening
- **Concurrent Editing (Epic 11)**: No locking/collision detection in quote editor.
- **Rounding/Money (Epic 09)**: Line item math needs rigorous validation against float drift.

---

## Section 8 — Recommended next execution order

1. **Epic 15/23 (Catalog Editors)**: Unlock the ability to create new trades/processes without code.
2. **Phase 6 (Production Office Shell)**: Elevate the "Dev Workspace" into a production UI to prove user value.
3. **Epic 47/48 (Payment Gating)**: Implement the "Decision 02" link between money and field actionability.
4. **Epic 37 (Change Orders)**: Support post-activation deltas—critical for long-running construction jobs.
5. **Epic 53 (Portal Shell)**: Start the customer-facing path for signature self-service.

---

## Section 9 — Open questions that need human decision

1. **AI Integration**: Should AI drafting (Epic 21/22) be built into the core mutation layer, or stay as a client-side "suggestion" that submits standard `QuoteLocalPacket` mutations?
2. **Scheduling Enforced?**: Do we want to build a real scheduling engine, or keep the current "dates-as-labels" approach for the MVP?
3. **Portal Depth**: Should the customer portal (Epic 53) support full task visibility (Field-to-Customer) or just the commercial Review-and-Sign flow?

---

## Section 10 — Final verdict

- **Project state**: **Foundational-Complete (Slice 1 functional)**. The relational bridge from Quote to Execution is working.
- **Most likely next epic**: **Epic 15 (Scope Packet Editor)** or **Phase 6 (Production Workspace Shell)**.
- **Biggest drift risk**: The **Doc-vs-Code gap in complexity**. The code is more mature than the docs for Epics 07, 08, 12, 13, and 33.
- **Biggest false sense of completion risk**: The "Activation" flow works in tests, but without **Change Orders** and **Payment Gating**, it will fail in real production scenarios where jobs drift or homeowners don't pay.

---
*Audit performed by: Cursor Agent*
*Reference: `scripts/integration/auth-spine.integration.test.ts`*
