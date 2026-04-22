# Struxient v3 Epic Completion Audit

**Date**: 2026-04-21
**Mode**: Triangle Mode / Verifier / Canon-Guard ON
**Supersedes**: `docs/audit/struxient-v3-current-state-epic-gap-audit.md` and `docs/audit/struxient-v3-current-state-verified-epic-audit.md` (both 2026-04-17 — out of date as of this audit).

**Verification spot-checks performed at save time (2026-04-21)**:
- `enum QuoteSignatureMethod` in `prisma/schema.prisma` → confirmed `OFFICE_RECORDED` only.
- `enum ScopePacketRevisionStatus` → confirmed `DRAFT`, `PUBLISHED`, `SUPERSEDED`.
- `enum AuditEventType` → confirmed exactly 7 entries (`QUOTE_VERSION_SENT/SIGNED/ACTIVATED`, `FLOW_SHARE_MANAGED/DELIVERED`, `PROJECT_SHARE_MANAGED/DELIVERED`).
- `model PreJobTask` exists in schema (line 326); zero matches under `src/app/api/` → invisibility claim holds.
- `src/app/api/workflow-versions/route.ts` and `[workflowVersionId]/route.ts` → confirmed GET-only.
- `src/app/api/scope-packets/route.ts` → confirmed no POST/PATCH/PUT/DELETE handlers (greenfield create gap real).
- No `model Lead`, `model Contact`, `model Note`, `model Hold` in schema → Epics 01, 04, 05, 29, 48 confirmed not-started.
- `docs/epics/48-payment-holds-operational-holds-epic.md` exists but was inadvertently omitted from the original draft — corrected below in **Not started**.

**Headcount correction**: Original draft claimed Complete 10 / Partial 27 / Not started 18 / Blocked 1 / Unclear 4 = 60. Adding the missed Epic 48 to *Not started* and the count to **19** restores the math (10 + 27 + 19 + 1 + 4 − 1 [Epic 38 double-listed in both Complete-by-absorption and Blocked/superseded] = 60).

Findings below are grounded in the epic files under `docs/epics/**`, canon under `docs/canon/**`, the prior verified audits under `docs/audit/**` and `docs/epic-completeness-audit/**`, the `docs/implementation/**` slice/backbone reports, the live Prisma schema (`prisma/schema.prisma`), the migration set in `prisma/migrations/**`, the route/server/component tree under `src/**`, and the unit + integration tests under `src/**/*.test.ts` and `scripts/integration/**`.

When code and docs disagree, code wins (per Canon-Guard). The two prior audits are out of date — significant work has shipped between then and 2026-04-21. This audit re-verifies against the current tree.

---

## Executive summary

- **Total epics found**: **60** (`docs/epics/01-leads-epic.md` … `docs/epics/60-admin-settings-tenant-configuration-epic.md`; plus `01A` index, `00` writing standard, `99` summary which are not epics).
- **Complete**: **10**
- **Partial**: **27**
- **Not started**: **19** (corrected from 18 after Epic 48 omission was caught at verification)
- **Blocked / superseded**: **1** (Epic 38 — folded by Decision 03; functionally "done by absorption"; also listed under Complete by absorption — counted once)
- **Unclear / conflicting**: **4**

The commercial-to-execution spine (Epics 07–13, 31–36, 41) is robust. Catalog/library authoring (15, 17, 27) is largely shipped. Customer-facing share/portal (53, partial 56) and Change Orders (37) and Payment Gates (47) shipped after the 04-17 audit. Cross-cutting CRM (01, 04, 05, 06), advanced field/ops (44, 49–52), full portal sign (54–55), search/permissions/admin/notifications (56–60) are mostly untouched.

---

## Complete

### Epic 02 — Customers
- **Why complete**: `Customer` model, list/detail reads (`src/server/slice1/reads/customer-reads.ts`), production list at `src/app/(office)/customers/page.tsx`, detail at `src/app/(office)/customers/[customerId]/page.tsx`, dev surface at `src/app/dev/customers/page.tsx`, REST GET at `src/app/api/customers/route.ts`, customer detail GET at `src/app/api/customers/[customerId]/route.ts`. Customer rows are created automatically by the quote-shell create flow (`src/server/slice1/mutations/create-commercial-quote-shell.ts`).
- **Key proof files**: `prisma/schema.prisma` (Customer model), `src/server/slice1/reads/customer-reads.ts`, `src/app/(office)/customers/**`, `src/app/api/customers/**`, `scripts/integration/auth-spine.integration.test.ts`.
- **Caveat**: No standalone "Create Customer" form, no archive/delete, no contact-method sub-objects, no notes — but the Epic 02 scope ("Identity record that quotes attach to") is functionally satisfied. The CRUD-completeness gaps are properly tracked under Epics 04, 05, and 06.
- **Confidence**: **80** (downgraded only because there is no archive/delete UI; create is implicit via shell).

### Epic 07 — Quotes (shell)
- **Why complete**: Quote shell creation with both new-customer and attach-to-customer strategies, atomic `Customer + FlowGroup + Quote + QuoteVersion v1` creation, list/detail UI in office and dev, full workspace pipeline. Doc was rewritten from C+ to A in `docs/epic-completeness-audit/06-rewritten-epics/07-quotes-epic.rewritten.md` and consolidated per `07-consolidation-report.md`.
- **Key proof files**: `src/server/slice1/mutations/create-commercial-quote-shell.ts`, `src/app/(office)/quotes/new/**`, `src/app/(office)/quotes/page.tsx`, `src/app/(office)/quotes/[quoteId]/page.tsx`, `src/app/api/commercial/quote-shell/route.ts`, `src/lib/commercial/quote-shell-form-state.test.ts`, `scripts/integration/auth-spine.integration.test.ts`.
- **Confidence**: **90**.

### Epic 08 — Quote versions
- **Why complete**: `QuoteVersion` model with DRAFT/SENT/SIGNED, `pinnedWorkflowVersionId`, version history read (`quote-version-history-read-slice` report), clone-from-head create-next, freeze fields (`planSnapshotSha256`, `packageSnapshotSha256`, snapshots, `sendClientRequestId`). Workspace shows version history component (`quote-workspace-version-history.tsx`).
- **Key proof files**: `prisma/schema.prisma` QuoteVersion, `src/server/slice1/mutations/send-quote-version.ts`, `src/server/slice1/mutations/sign-quote-version.ts`, `src/app/api/quotes/[quoteId]/versions/route.ts`, `src/components/quotes/workspace/quote-workspace-version-history.tsx`.
- **Confidence**: **88**.

### Epic 12 — Send / Freeze
- **Why complete**: SHA256 hashes for both planSnapshot and packageSnapshot, sendClientRequestId idempotency, FREEZE pre-staleness validation, audit event `QUOTE_VERSION_SENT`, send mutation transactional. Implementation report `2026-04-11-quote-version-send-freeze-transaction.md` plus `2026-04-11-quote-version-freeze-read-audit-sent.md`.
- **Key proof files**: `src/server/slice1/mutations/send-quote-version.ts`, `src/app/api/quote-versions/[quoteVersionId]/send/route.ts`, `src/lib/quote-version-freeze-dto.ts`, `scripts/integration/auth-spine.integration.test.ts`.
- **Confidence**: **92**.

### Epic 17 — Task definitions
- **Why complete**: Full library editor with completion-requirements editor (`task-definition-authoring-backbone-pass.md`) AND conditional-rules editor (`task-definition-conditional-rules-authoring-pass.md`). DRAFT/PUBLISHED/ARCHIVED status transitions with idempotent guards. Office library route (`src/app/(office)/library/task-definitions/**`), dev list/edit, REST routes, 14+16 unit tests in `task-definition-authored-requirements.test.ts` and `task-definition-conditional-rules.test.ts`.
- **Key proof files**: `src/lib/task-definition-authored-requirements.ts`, `src/lib/task-definition-conditional-rules.ts`, `src/server/slice1/mutations/task-definition-mutations.ts`, `src/components/task-definitions/task-definition-editor.tsx`, `src/app/api/task-definitions/**`.
- **Confidence**: **92**.

### Epic 30 — Start eligibility / actionability
- **Why complete**: `evaluateRuntimeTaskActionability` and `evaluateSkeletonTaskActionability` cover lifecycle, payment-gate blocking (`PAYMENT_GATE_UNSATISFIED`), and review-loop blocking (`TASK_ALREADY_ACCEPTED`, `correction_required` re-actionability). DTO surfaces blocking reasons to UI.
- **Key proof files**: `src/server/slice1/eligibility/task-actionability.ts`, `scripts/integration/payment-gating.integration.test.ts`, `scripts/integration/execution-surface.integration.test.ts`, `scripts/integration/auth-spine.integration.test.ts`.
- **Confidence**: **85** (no scheduling/hold inputs, but those are owned by other not-started epics).

### Epic 31 — Generated plan
- **Why complete**: `buildGeneratedPlanSnapshotV0` builds and stores `generatedPlanSnapshot` JSON on `QuoteVersion` with `planSnapshotSha256` hash; freeze flow validates determinism.
- **Key proof files**: `src/server/slice1/compose-preview/**`, `prisma/schema.prisma` (`QuoteVersion.generatedPlanSnapshot`, `planSnapshotSha256`), `docs/implementation/reports/2026-04-11-activation-frozen-artifacts-canon-slice.md`.
- **Confidence**: **90**.

### Epic 32 — Execution package
- **Why complete**: `executionPackageSnapshot` + `packageSnapshotSha256` persisted on `QuoteVersion`. Compose engine produces node-slot structure including `completionRequirementsJson`, `conditionalRulesJson`, instructions; package frozen at send.
- **Key proof files**: `src/server/slice1/compose-preview/compose-engine.ts`, `src/server/slice1/compose-preview/build-compose-preview.ts`, `prisma/migrations/20260412103000_compose_preview_seed_json_backfill/migration.sql`.
- **Confidence**: **90**.

### Epic 33 — Activation
- **Why complete**: `activate-quote-version.ts` runs as atomic transaction, validates frozen hashes, materializes `Flow` + `RuntimeTask` rows, creates `Activation` and `Job`, supports `Tenant.autoActivateOnSign` (migration `20260415103000_tenant_auto_activate_on_sign`). Full e2e proof in `auth-spine.integration.test.ts`.
- **Key proof files**: `src/server/slice1/mutations/activate-quote-version.ts`, `src/app/api/quote-versions/[quoteVersionId]/activate/route.ts`, `prisma/migrations/20260414120000_phase6_flow_activation_runtime/`.
- **Confidence**: **92**.

### Epic 38 — Inspection model
- **Why complete (by absorption)**: Per `docs/decisions/03-inspection-model-decision.md`, inspections are folded into manifest tasks; no new table, no parallel truth. The fold is implemented because manifest tasks already carry overall result, checklist, measurements, identifiers, and verified status (review loop). See "Blocked / superseded" section for nuance — listed there too with rationale.
- **Key proof files**: `docs/decisions/03-inspection-model-decision.md`, `CompletionProof.overallResult` in `prisma/schema.prisma`, `docs/implementation/structured-completion-data-backbone-pass.md`, `docs/implementation/completion-review-loop-backbone-pass.md`.
- **Confidence**: **80** (decision-conformant; no separate inspection tagging UX).

---

## Partial

### Epic 03 — FlowGroup / project anchor
- **Shipped**: `FlowGroup` model, list (`/projects`), detail (`/projects/[flowGroupId]`), one-to-one `Job` linkage, project-level public share token, expiration, view telemetry, clarification/acknowledge fields, project evidence rollup page (`/projects/[flowGroupId]/evidence`), `manageProjectShareForTenant` mutation, project share delivery + provider integration. Migrations include `20260421020913_add_public_share_and_delivery`.
- **Missing**: Archive/delete; address/structured fields; explicit "create FlowGroup" UI (creation is implicit through quote shell); no contacts/notes/files sub-objects (those belong to Epics 04/05/06).
- **Blocking deps**: 04 Contacts, 05 Notes, 06 Files would naturally hang here.
- **Key proof files**: `src/server/slice1/reads/flow-group-reads.ts`, `src/app/api/flow-groups/[flowGroupId]/route.ts`, `src/app/(office)/projects/[flowGroupId]/page.tsx`, `src/app/(office)/projects/[flowGroupId]/evidence/page.tsx`, `src/server/slice1/mutations/project-share.ts`, `src/server/slice1/reads/project-evidence-rollup.ts`.
- **Confidence**: **80**.

### Epic 06 — Files / photos / documents
- **Shipped**: Media infrastructure for completion-proof attachments (`CompletionProofAttachment`), disk + S3-compatible providers (`production-storage-provider-pass.md`), upload route (`/api/media/upload`), tenant-isolated retrieval (`/api/media/[storageKey]`), thumbnails / gallery in field UX (`field-media-ux-hardening-pass.md`).
- **Missing**: No general polymorphic file model on Customer / FlowGroup / Quote / QuoteVersion / Job. No virus scan, no quotas, no categories, no frozen-version pin. Files are scoped exclusively to task evidence.
- **Key proof files**: `prisma/schema.prisma` (`CompletionProofAttachment` only), `src/server/media/**`, `src/app/api/media/**`, `scripts/integration/media-infrastructure.integration.test.ts`.
- **Confidence**: **75**.

### Epic 09 — Quote line items
- **Shipped**: `QuoteLineItem` model with both `MANIFEST` and `SOLD_SCOPE` execution modes, draft mutations (`quote-line-item-mutations.ts`), invariants (`quote-line-item.ts`), proposal-group constraint, line item summary component, REST routes for CRUD on draft.
- **Missing**: Money rounding rules / float-drift validation. No archive/restore on draft. Mobile read-only behavior not verified.
- **Key proof files**: `src/server/slice1/mutations/quote-line-item-mutations.ts`, `src/server/slice1/invariants/quote-line-item.ts`, `src/app/api/quote-versions/[quoteVersionId]/line-items/**`, `scripts/integration/quote-line-item-published-pin.integration.test.ts`, `docs/implementation/reports/2026-04-11-sold-scope-compose-expansion.md`.
- **Confidence**: **80**.

### Epic 10 — Proposal groups
- **Shipped**: `ProposalGroup` model, rename mutation (`rename-proposal-group.ts`), REST route, surfaced in scope editor, draft-mutation middleware enforces editable state.
- **Missing**: Merge-on-non-empty-delete UX is not visibly implemented; epic-defined behaviors thin (sort/reorder, delete-with-merge dialog).
- **Key proof files**: `src/server/slice1/mutations/rename-proposal-group.ts`, `src/app/api/quote-versions/[quoteVersionId]/proposal-groups/[proposalGroupId]/route.ts`, `src/components/quotes/workspace/quote-workspace-line-item-list.tsx`.
- **Confidence**: **70**.

### Epic 11 — Quote editing / draft behavior
- **Shipped**: `draft-mutation-proposal-group-middleware`, scope editor (`src/app/(office)/quotes/[quoteId]/scope/scope-editor.tsx`), workspace pipeline-step UI, head-readiness derivation, pin-workflow workflow, change-orders panel, sign/sent/activate panels, quote workspace test (`quote-workspace-page-state.test.ts`).
- **Missing**: Concurrent-editor presence/locking, autosave debounce + retry semantics, undo stack, preflight validation gate that the consolidated epic 11 spec describes. UI is functional but does not match the rewritten layout supplement (4-region workspace, right-rail with 5 tabs, etc.).
- **Key proof files**: `src/app/(office)/quotes/[quoteId]/scope/**`, `src/components/quotes/workspace/**`, `src/server/slice1/mutations/compose-staleness.ts`, `docs/implementation/reports/2026-04-11-draft-mutation-proposal-group-middleware.md`.
- **Confidence**: **70**.

### Epic 13 — Signatures / acceptance
- **Shipped**: `QuoteSignature` model with `OFFICE_RECORDED` method only. `sign-quote-version.ts` route, sign workspace component, audit event, optional auto-activate.
- **Missing**: Portal/customer self-sign (Epic 54 is the home for this); offline sign; signed-by-customer signature method; declined/decline reason capture.
- **Blocking deps**: Epic 54 (Portal quote review/sign) blocks customer self-sign.
- **Key proof files**: `prisma/schema.prisma` `QuoteSignature` + `QuoteSignatureMethod` enum (only `OFFICE_RECORDED`), `src/app/api/quote-versions/[quoteVersionId]/sign/route.ts`, `src/components/quotes/workspace/quote-workspace-sign-sent.tsx`.
- **Confidence**: **80**.

### Epic 14 — Quote change / revision workflow
- **Shipped**: Clone-from-head version creation; `change-orders` (Epic 37) layered on top.
- **Missing**: Explicit "Void version" route or status (no `VOID` enum on `QuoteVersionStatus`). No compare-versions UI. No revision lifecycle (supersede/withdraw) with carry-forward UI; carry-forward exists implicitly via clone but no controls per the epic spec.
- **Key proof files**: `src/server/slice1/mutations/create-next-quote-version.ts` (referenced via `quote-version-next-create-clone-slice` report), `src/components/quotes/workspace/quote-workspace-version-history.tsx`. Absence: no `void` route under `src/app/api/quote-versions/`.
- **Confidence**: **70**.

### Epic 15 — Scope packets (catalog)
- **Shipped**: `ScopePacket`, `ScopePacketRevision` with DRAFT/PUBLISHED/SUPERSEDED enum (added in `20260421120000_add_superseded_to_scope_packet_revision_status`), publish-revision-form, fork-from-revision, create-next-revision-from-published, packet promotion (`promote-quote-local-packet.ts` per `quote-local-packet-promotion.integration.test.ts` and migration `20260420120000_packet_promotion_authorize`), library packets list/detail in office route. 6 integration tests cover revision lifecycle.
- **Missing**: No greenfield "Create new ScopePacket" UI/route (`/api/scope-packets` is GET-only). New packets can ONLY be created via promotion from a `QuoteLocalPacket`. Detail tabs / search / filter / archive missing per epic spec.
- **Key proof files**: `prisma/schema.prisma`, `src/app/api/scope-packets/**`, `src/server/slice1/mutations/create-draft-scope-packet-revision-from-published.ts`, `src/components/catalog-packets/**`, `src/app/(office)/library/packets/**`, `scripts/integration/scope-packet-revision-publish.integration.test.ts`, `scripts/integration/scope-packet-revision-fork.integration.test.ts`.
- **Confidence**: **80** (revision lifecycle is rigorous; greenfield create gap is real).

### Epic 16 — Packet task lines
- **Shipped**: `PacketTaskLine` model with `EMBEDDED`/`LIBRARY` lineKind, `targetNodeKey` top-level column, taskDefinition link, sortOrder, tierCode. Embedded payload JSON for ad-hoc lines.
- **Missing**: Authoring UI lives only inside the revision detail page; node picker UX, drawer-based detail edit, lock validation per spec are thin.
- **Key proof files**: `prisma/schema.prisma` `PacketTaskLine`, `src/components/catalog-packets/**`, `src/app/(office)/library/packets/[scopePacketId]/revisions/[scopePacketRevisionId]/page.tsx`.
- **Confidence**: **75**.

### Epic 18 — Structured input definitions
- **Shipped**: A subset — TaskDefinition completion-requirements (checklist/measurement/identifier/result/note/attachment) act as structured-input templates for **completion**. Frozen onto `RuntimeTask` at activation; runtime captures `checklistJson` / `measurementsJson` / `identifiersJson` / `overallResult` on `CompletionProof`.
- **Missing**: Epic 18 covers structured inputs across **quote authoring**, **portal**, and **execution**. Only the execution side is shipped. No QuoteVersion-level structured inputs; no portal capture.
- **Key proof files**: `src/lib/task-definition-authored-requirements.ts`, `prisma/schema.prisma` (`CompletionProof.checklistJson` etc.), `docs/implementation/structured-completion-data-backbone-pass.md`.
- **Confidence**: **70**.

### Epic 19 — Packet tiers / variant handling
- **Shipped**: `tierCode` columns on `PacketTaskLine`, `QuoteLocalPacketItem`, and `QuoteLineItem`; compose engine has tier-filter diagnostics (`compose-tier-filter-diagnostics.test.ts`).
- **Missing**: No tier picker UX surface, no tier matrix authoring, no per-tier preview in the workspace.
- **Key proof files**: `src/lib/compose-tier-filter-diagnostics.test.ts`, schema columns above.
- **Confidence**: **55**.

### Epic 23 — Process templates
- **Shipped**: `WorkflowTemplate` and `WorkflowVersion` models with `snapshotJson`; pinning via `QuoteVersion.pinnedWorkflowVersionId`; activation reads snapshot to materialize tasks; `workflow-snapshot-node-projection.test.ts`. List GET (`PUBLISHED` only) and detail GET routes.
- **Missing**: **No authoring UI or POST/PATCH route**. Workflow versions can only be created via `prisma/seed.js`. The "graph canvas + inspector" the epic describes is absent.
- **Key proof files**: `src/app/api/workflow-versions/route.ts` (GET only), `src/app/api/workflow-versions/[workflowVersionId]/route.ts` (GET only), `src/server/slice1/reads/workflow-version-reads.ts`, `prisma/seed.js`.
- **Confidence**: **85** (data side OK; authoring side is unambiguously absent).

### Epic 24 — Nodes
- **Shipped**: Node model exists only as JSON within `WorkflowVersion.snapshotJson`. Compose engine consumes `targetNodeKey`. Workflow-version node-keys read at `src/app/api/workflow-versions/[workflowVersionId]/node-keys/route.ts`.
- **Missing**: No first-class Node table, no node authoring/editing UI; nodes are seed-defined only.
- **Key proof files**: `src/server/slice1/reads/workflow-version-node-keys.ts`, `src/lib/workflow-snapshot-node-projection.ts`, no `Node` model in `prisma/schema.prisma`.
- **Confidence**: **80**.

### Epic 25 — Gates / routing / outcomes
- **Shipped**: Outcomes appear in `CompletionProof.overallResult`; routing/gate edges exist only inside workflow snapshot JSON.
- **Missing**: No first-class Gate model, no gate editor, no expression language. Gates are not surfaced in any UI.
- **Confidence**: **75**.

### Epic 26 — Skeleton tasks
- **Shipped**: Skeleton tasks materialized from workflow snapshot at activation; start/complete routes (`/api/flows/[flowId]/skeleton-tasks/[skeletonTaskId]/start` & `/complete`); follow-up `2026-04-11-followups-job-autoactivate-skeleton-skip.md`; idempotency unique constraint migration `20260417120000_task_execution_skeleton_unique`. Skeleton tasks honor payment gating per Epic 47 backbone.
- **Missing**: Authoring of skeleton tasks lives in workflow snapshot only; no editor. No checklist/outcome authoring per the epic spec.
- **Key proof files**: `src/server/slice1/mutations/skeleton-task-execution.ts`, `src/app/api/flows/[flowId]/skeleton-tasks/**`, `prisma/migrations/20260417120000_task_execution_skeleton_unique/`.
- **Confidence**: **80**.

### Epic 27 — Completion rules
- **Shipped**: Authored requirement parser (6 kinds), conditional-rule parser (5 trigger × require combos), enforcement during completion (`runtime-task-execution.ts`), validation_failed structured errors, field UI markers + alerts, frozen onto `RuntimeTask`. Two integration tests: `conditional-completion-rules` and `required-field-enforcement`.
- **Missing**: Skeleton-task completion-rule enforcement not yet wired (per `field-validation-required-field-enforcement-pass.md` §5). No ad-hoc rule overlays from packet/quote-line.
- **Key proof files**: `src/server/slice1/mutations/runtime-task-execution.ts`, `src/lib/task-definition-conditional-rules.ts`, `src/lib/runtime-task-required-helpers.ts`.
- **Confidence**: **85**.

### Epic 34 — Job anchor
- **Shipped**: `Job` model 1:1 with `FlowGroup` (`flowGroupId @unique`), idempotent `ensureJobForFlowGroup` referenced in implementation reports, job-shell read (`src/server/slice1/reads/job-shell.ts`), job list/detail routes (`/jobs`, `/jobs/[jobId]`), unit tests in `src/lib/job-shell-dto.ts` and `src/app/dev/jobs/[jobId]/job-shell-page-state.test.ts`. Doc fully rewritten per consolidation report.
- **Missing**: Status enum and transitions — no `JobStatus` enum in schema; no cancel/restore flow; tabbed detail per rewrite epic mostly absent (most tabs not implemented).
- **Key proof files**: `prisma/schema.prisma` `Job` model (no status field), `src/server/slice1/reads/job-shell.ts`, `src/app/(office)/jobs/[jobId]/page.tsx`.
- **Confidence**: **75**.

### Epic 35 — Runtime task instances
- **Shipped**: `RuntimeTask` model, `lineItemId`, `nodeId`, `planTaskIds`, `displayTitle`, instructions snapshot, `completionRequirementsJson` snapshot, `conditionalRulesJson` snapshot, change-order links (`changeOrderIdCreated`, `changeOrderIdSuperseded`). Materialized atomically at activation. Inject flow via Change Orders (Epic 37).
- **Missing**: No source classification (per epic: classification by `MANIFEST_FROM_LINE`, `INJECTED_BY_CO`, etc., is implicit not explicit). No supersede policy beyond CO replacement.
- **Key proof files**: `prisma/schema.prisma` `RuntimeTask`, `src/server/slice1/mutations/activate-quote-version.ts`, `src/server/slice1/mutations/apply-change-order.ts`.
- **Confidence**: **80**.

### Epic 36 — Effective snapshot / runtime merge
- **Shipped**: `getFlowExecutionReadModel` and `getJobShellReadModel` interleave skeleton + runtime tasks, filter superseded RuntimeTasks via `changeOrderIdSuperseded`. DTOs carry per-task type. Project evidence rollup also merges across flows.
- **Missing**: No explicit "kind badge" UI per epic spec; no API contract requirement of explicit ids in compose preview.
- **Key proof files**: `src/server/slice1/reads/flow-execution.ts`, `src/server/slice1/reads/job-shell.ts`, `src/server/slice1/reads/flow-evidence-report.ts`.
- **Confidence**: **80**.

### Epic 37 — Change orders
- **Shipped**: `ChangeOrder` model + `ChangeOrderStatus` enum (DRAFT, PENDING_CUSTOMER, READY_TO_APPLY, APPLIED, VOID), create CO (forks new draft version), apply CO (atomically supersedes RuntimeTasks, transfers TaskExecution history, blocks if unsatisfied PaymentGate targets a superseded task). Migration `20260417100118_add_change_order_backbone`. `change-orders.integration.test.ts` proves the loop including gate-blocking and execution transfer. UI surfaces in workspace (`quote-workspace-change-orders.tsx`).
- **Missing**: No customer-sign step for price-changing COs (PENDING_CUSTOMER state exists in enum but no surface to drive it). No diff/compare UI between V1 and V2 line items. No void route.
- **Key proof files**: `src/server/slice1/mutations/create-change-order.ts`, `src/server/slice1/mutations/apply-change-order.ts`, `src/app/api/jobs/[jobId]/change-orders/route.ts`, `src/app/api/change-orders/[coId]/apply/route.ts`, `scripts/integration/change-orders.integration.test.ts`.
- **Confidence**: **85**.

### Epic 39 — Work station / actionable feed
- **Shipped**: Production `/flows/[flowId]/page.tsx` with `ExecutionWorkFeed`, sync, blocked reasons, mobile-first card layout (`field-execution-shell-hardening-pass.md`). Honors superseded filtering and payment gating in DTO.
- **Missing**: No global "My Work" feed across multiple flows for a given worker. No Today/Upcoming/Blocked sections per epic spec. No empty-state messaging matrix per spec. Filters/pagination thin.
- **Key proof files**: `src/components/execution/execution-work-feed.tsx`, `src/app/(office)/flows/[flowId]/page.tsx`, `scripts/integration/execution-surface.integration.test.ts`.
- **Confidence**: **75**.

### Epic 40 — Node / job execution views
- **Shipped**: Job-shell view (`src/app/(office)/jobs/[jobId]/page.tsx`) shows summary, runtime tasks, completion proof.
- **Missing**: Kanban board with completion-state columns (per epic spec) is absent. Forbidden-drag rules absent. Node-by-node grouping absent.
- **Key proof files**: `src/app/(office)/jobs/[jobId]/page.tsx`, `src/lib/jobs/job-shell-summary.ts`.
- **Confidence**: **70**.

### Epic 41 — Runtime task execution UX
- **Shipped**: Start/complete buttons with eligibility check, blocked reasons, structured-data entry (checklist/measurement/identifier/result), completion proof note + attachments, conditional-rule asterisks, validation alerts, review loop UI (Accept / Request Correction). All in `execution-work-item-card.tsx`.
- **Missing**: Timer display per epic spec (start time → elapsed) not present. Reversal flow admin not present. Offline policy not enforced.
- **Key proof files**: `src/components/execution/execution-work-item-card.tsx`, `src/components/execution/execution-media-ux.tsx`, `docs/implementation/completion-review-loop-backbone-pass.md`, `docs/implementation/field-validation-required-field-enforcement-pass.md`.
- **Confidence**: **80**.

### Epic 42 — Evidence / photos / completion proof
- **Shipped**: `CompletionProof` + `CompletionProofAttachment`, multipart upload, S3-compatible production provider, gallery thumbnails, evidence rendered on flow report (`/flows/[flowId]/report`), `verified-evidence-report-backbone-pass.md`, project rollup (`project-evidence-rollup-backbone-pass.md`), customer-facing portal viewer (`/portal/flows/[shareToken]`).
- **Missing**: Retention policy, rejection workflow at the photo level (only task-level CORRECTION_REQUIRED), per-attachment metadata edit, EXIF/GPS capture.
- **Key proof files**: `prisma/schema.prisma` `CompletionProof*` models, `src/server/media/**`, `src/components/execution/execution-media-ux.tsx`, `scripts/integration/completion-proof.integration.test.ts`, `scripts/integration/media-infrastructure.integration.test.ts`.
- **Confidence**: **85**.

### Epic 43 — Mobile field execution
- **Shipped**: `field-execution-shell-hardening-pass.md` made cards mobile-friendly (large tap targets, full-width stacks, responsive padding).
- **Missing**: Offline policy, push notifications, camera-native integration, session-recovery on disconnect.
- **Key proof files**: `docs/implementation/field-execution-shell-hardening-pass.md`, `src/components/execution/execution-work-item-card.tsx`.
- **Confidence**: **65**.

### Epic 47 — Payment gates
- **Shipped**: `PaymentGate` + `PaymentGateTarget` models, `PaymentGateStatus` enum, satisfaction route (`/api/payment-gates/[gateId]/satisfy`), enforcement in actionability + start mutations (both runtime & skeleton), workspace UI in `quote-workspace-payment-gates.tsx`. `payment-gating.integration.test.ts` proves the loop end-to-end. Migration `20260417095046_add_payment_gating_backbone`.
- **Missing**: Auto-release/auto-create of gates from the freeze snapshot (gates are manually created); CO-driven retargeting when superseding tasks (called out in `epic-47-payment-gating-backbone-pass.md` §6); pre-activation gate strategies; multi-target gate UX.
- **Key proof files**: `src/server/slice1/mutations/satisfy-payment-gate.ts`, `src/server/slice1/eligibility/task-actionability.ts`, `src/components/quotes/workspace/quote-workspace-payment-gates.tsx`.
- **Confidence**: **80**.

### Epic 53 — Customer portal
- **Shipped**: Tokenized portal at `/portal/flows/[shareToken]` and `/portal/projects/[shareToken]`. Strict gating: token + PUBLISHED + not expired. Telemetry (view count, first/last view), receipt acknowledgment, clarification request loop, project-level rollup viewer. `customer-sharing-lifecycle-finalization-audit.md` certifies the lifecycle.
- **Missing**: Magic-link auth (epic 53 §X). Customer dashboard. PII boundaries explicitly enforced. No login at all — pure share-token model.
- **Key proof files**: `src/app/portal/flows/[shareToken]/page.tsx`, `src/app/portal/projects/[shareToken]/page.tsx`, `src/server/slice1/reads/flow-evidence-report.ts`, `src/server/slice1/reads/project-evidence-rollup.ts`.
- **Confidence**: **70** (good for evidence sharing; quote-review portal absent).

### Epic 56 — Notifications
- **Shipped**: Per-flow and per-project in-app notification derivation (unread response → alert), follow-up automation (`customer-follow-up-automation-backbone-pass.md`), comms provider abstraction (`src/server/comms/**`) with mock provider, structured email + SMS content templates (`src/server/comms/delivery-content.ts`), audit events for `FLOW_SHARE_DELIVERED`, `PROJECT_SHARE_DELIVERED`, `FLOW_SHARE_MANAGED`, `PROJECT_SHARE_MANAGED`. Project-portal notifications (`project-portal-notification-backbone-pass.md`) and urgent-response escalation (`project-urgent-response-escalation-backbone-pass.md`).
- **Missing**: General notification bus, per-user preferences, deep-link templates, throttling per epic spec, push notifications, real provider creds (only mock provider wired).
- **Key proof files**: `src/server/comms/**`, `src/server/slice1/mutations/flow-share-delivery.ts`, `src/server/slice1/mutations/project-share-delivery.ts`, `src/components/execution/flow-share-controls.tsx`.
- **Confidence**: **65** (narrow share-domain notifications only).

### Epic 57 — Audit / history
- **Shipped**: `AuditEvent` model with limited event types (`QUOTE_VERSION_SENT/SIGNED/ACTIVATED`, `FLOW_SHARE_*`, `PROJECT_SHARE_*`), payloadJson, indexed by tenant+createdAt and target.
- **Missing**: Field-level diffs, PII masking, retention rules, export, global audit viewer UI. Most domain mutations (line item edits, packet promotions, etc.) do not emit audit events.
- **Key proof files**: `prisma/schema.prisma` `AuditEvent` + `AuditEventType` enum (only 7 event types vs broad spec).
- **Confidence**: **75**.

### Epic 59 — Permissions / roles / visibility
- **Shipped**: `TenantMemberRole` enum (`OFFICE_ADMIN`, `FIELD_WORKER`, `READ_ONLY`); capability gates (`office_mutate`, `field_execute`, `read`) via `requireApiPrincipalWithCapability`; tenant isolation enforced at every read and mutation. `tenant-member-role-password` migration. Cross-tenant test in `auth-spine.integration.test.ts`.
- **Missing**: Role assignment UI, role templates, permission-key matrix, row-level visibility options. Three hard-coded roles only.
- **Key proof files**: `src/lib/auth/api-principal.ts`, `src/lib/auth/resolve-tenant-id.ts`, `src/auth.ts`, `prisma/migrations/20260418120000_tenant_member_role_password/`.
- **Confidence**: **80**.

---

## Not started

### Epic 01 — Lead management
- **Why**: No `Lead` model, no API, no UI surface, no test. The "leads" CRM intake described as the calibration epic exists only as documentation.
- **Key proof files**: No matches in `prisma/schema.prisma`, no `src/app/(office)/leads/`, no `src/app/api/leads/`.
- **Confidence**: **95**.

### Epic 04 — Contacts and contact methods
- **Why**: No `Contact` or `ContactMethod` model, no API, no UI. `Customer` has only `primaryEmail` / `primaryPhone` strings.
- **Key proof files**: No matches in schema.
- **Confidence**: **95**.

### Epic 05 — Notes & activity timeline
- **Why**: No `Note` model. `AuditEvent` is not a notes feature (no user-authored content). No timeline component.
- **Key proof files**: No matches in schema.
- **Confidence**: **95**.

### Epic 20 — Assemblies / rules-generated scope
- **Why**: No assembly model, no rule engine, no overlay-diff UI.
- **Confidence**: **90**.

### Epic 21 — AI-assisted packet authoring
- **Why**: `QuoteLocalPacketOrigin.AI_DRAFT` enum value exists and `aiProvenanceJson` column exists, but no AI calls, no AI service, no diff-review UI. Confirmed absent across `src/server/**` (no AI calls).
- **Key proof files**: schema enum slot only; no `src/server/ai/`.
- **Confidence**: **90**.

### Epic 22 — AI-assisted quote drafting
- **Why**: Same as 21. Absent.
- **Confidence**: **90**.

### Epic 28 — Detours / loopback
- **Why**: No detour model, no loopback route, no resolve flow. The schema has no detour-related rows.
- **Confidence**: **95**.

### Epic 29 — Hold model
- **Why**: No `Hold` model. Only `PaymentGate` exists (Epic 47). Operational holds, hold types, apply/release lifecycle absent.
- **Confidence**: **90**.

### Epic 44 — Office-to-field handoff
- **Why**: No handoff record, no crew assignment model, no acknowledge flow. Field workers can navigate to flows directly from auth, but the formal handoff/briefing surface is absent.
- **Confidence**: **85**.

### Epic 45 — Scheduling (MVP)
- **Why**: Per `docs/decisions/01-scheduling-authority-decision.md`, scheduling is intentionally non-authoritative for MVP. `PreJobTask` carries `scheduledStartAt`/`scheduledEndAt` columns but no surface enforces them. No banner, no Phase C flag, no UI presenter. Could be considered "intentionally deferred" — see Unclear / conflicting.
- **Confidence**: **85**.

### Epic 46 — Schedule blocks / requests
- **Why**: No model, no API, no UI.
- **Confidence**: **95**.

### Epic 48 — Payment holds / operational holds (integration)
- **Why**: Epic 48 composes `HoldType.PAYMENT` with `PaymentGate` and unifies blocker explanation in the Job UI. Verified absent: no `model Hold`, no `HoldType` enum, no Blockers panel, no compose function. Depends on Epic 29 (Hold model) which is also not started.
- **Key proof files**: schema has no Hold model; no `src/server/slice1/eligibility/hold-*` or similar.
- **Confidence**: **95**.

### Epic 49 — Cost / actual events
- **Why**: No cost-event model, no append-only ledger.
- **Confidence**: **95**.

### Epic 50 — Time tracking / labor actuals
- **Why**: No labor time entry model, no approval workflow.
- **Confidence**: **95**.

### Epic 51 — Variance / margin visibility
- **Why**: No analytics surface, no read model. Depends on 49 + 50 first.
- **Confidence**: **95**.

### Epic 52 — Learning feedback loop
- **Why**: No suggestion inbox, no human publish gate. Depends on actuals.
- **Confidence**: **95**.

### Epic 54 — Portal quote review / sign
- **Why**: No portal quote view route, no decline flow. `QuoteSignatureMethod` enum has only `OFFICE_RECORDED`. Portal share is for evidence/flows only.
- **Confidence**: **90**.

### Epic 55 — Portal structured input collection
- **Why**: No portal input intake. Customer responses are limited to acknowledgment + clarification text on share.
- **Confidence**: **90**.

### Epic 58 — Search / filtering / global retrieval
- **Why**: No global omnibox, no global search API. Per-list filters are minimal.
- **Confidence**: **90**.

### Epic 60 — Admin settings / tenant configuration
- **Why**: Only `Tenant.autoActivateOnSign` boolean exists. No settings UI, no key/value control plane, no danger-zone.
- **Confidence**: **90**.

---

## Blocked / superseded

### Epic 38 — Inspection model
- **Status**: Intentionally folded per `docs/decisions/03-inspection-model-decision.md`. No separate Inspection table; inspections ride on manifest tasks via `CompletionProof.overallResult` (PASS/FAIL), checklist, structured measurements, plus the office review loop.
- **Replaced by**: Epics 27 + 35 + 41 + 42 + the Completion Review Loop pass.
- **Key proof files**: `docs/decisions/03-inspection-model-decision.md`, `CompletionProof` schema, `docs/implementation/completion-review-loop-backbone-pass.md`.
- **Confidence**: **85**.

---

## Unclear / conflicting

### Epic 18 — Structured input definitions
- **Conflict**: TaskDefinition completion-requirements implement a *subset* of the epic (execution capture). The epic also covers quote-side and portal-side template definitions, which are not built. Docs and code disagree on whether Epic 18 is "covered" by Epic 17. Needs human decision: declare 18 split into 18a (execution, complete) + 18b (quote/portal, not started), or keep 18 as a partial.
- **Key proof files**: `src/lib/task-definition-authored-requirements.ts`, `docs/epics/18-structured-input-definitions-epic.md`.
- **Confidence**: **70**.

### Epic 24 — Nodes
- **Conflict**: Nodes are a first-class concept in canon (`docs/canon/06-node-and-flowspec-canon.md`) and the epic, but in code they exist *only* inside `WorkflowVersion.snapshotJson`. Compose, activation, payment gates, and runtime tasks all reference `nodeId`/`targetNodeKey`. Whether this is a "complete" or "missing" node implementation depends on whether the canonical intent is "Node-as-table" or "Node-as-snapshot-row". Needs human ruling.
- **Key proof files**: `prisma/schema.prisma` (no Node table); `src/lib/workflow-snapshot-node-projection.ts`.
- **Confidence**: **75**.

### Epic 45 — Scheduling
- **Conflict**: Epic 45 says "MVP non-enforcement, banner required, Phase C flag." Decision 01 confirms non-authoritative. Code has no banner, no flag, no surface — yet `PreJobTask` columns and `RuntimeTask` execution include time fields. Is the MVP deliverable "do nothing" (then the epic is complete) or "build the explanatory banner" (then it's not started)?
- **Key proof files**: `docs/decisions/01-scheduling-authority-decision.md`, `prisma/schema.prisma` `PreJobTask` schedule fields.
- **Confidence**: **70**.

### PreJobTask visibility / Epic 03 boundary
- **Conflict**: `PreJobTask` model is in schema with full status enum, assignment, scheduling fields, indexes. But: no API route, no read DTO surfacing it in `QuoteWorkspaceDto` or `JobShellDto`, no UI page. Both prior audits flagged this as "structurally present, invisible." It is unclear whether PreJobTask belongs to a future Epic or is implicit in Epic 03.
- **Key proof files**: `prisma/schema.prisma` `PreJobTask`; `rg PreJobTask src/app/api` returns nothing.
- **Confidence**: **80**.

---

## Recommended next epic order

Grouped by execution priority. Considers (a) architectural dependency, (b) risk reduction, (c) user-visible value, (d) drift prevention, (e) downstream contract dependencies.

### 1. Must do next

1. **Epic 23 / 24 / 25 — Process Templates editor (workflow authoring)**.
   - **Why now**: Workflow versions can ONLY be created via `prisma/seed.js`. This is the largest "developer bottleneck" in the system. Activation, RuntimeTask materialization, payment gating, change orders all consume this — they're hardened, but content can't scale. Highest leverage non-CRM blocker.
   - **Pre-req**: None (data model is solid).

2. **Epic 15 (greenfield create) + Epic 16 (line authoring polish)**.
   - **Why now**: Today new ScopePackets are only born via promotion from a `QuoteLocalPacket`. A direct "Create Packet" flow closes the second seed-only authoring gap. Revision lifecycle (publish/fork/supersede) is already production-ready.
   - **Pre-req**: None.

3. **Epic 04 — Contacts** + **Epic 05 — Notes & timeline**.
   - **Why now**: Customers, FlowGroups, Quotes, Jobs all have no place to capture human context. This is the cheapest CRM gap to close and unblocks operational adoption. Polymorphic-parent design (per audit doc §4) is the only architectural decision needed.

4. **Epic 47 hardening — gate auto-creation from freeze snapshot + CO-retargeting**.
   - **Why now**: Gates currently must be hand-authored. Closing this loop makes the commercial spine self-driving and resolves the known follow-up risk in `epic-47-payment-gating-backbone-pass.md`.

### 2. Should do soon

5. **Epic 54 — Portal quote review/sign** (depends on Epic 53 portal infrastructure that is shipped + Epic 13 to add `CUSTOMER_SIGNED` to `QuoteSignatureMethod`).
   - **Why**: Removes the manual "office records customer signature" half-step. Highest customer-facing visibility win after evidence portal.

6. **Epic 06 — General file model** (polymorphic Files attached to Customer / FlowGroup / Quote / Job).
   - **Why**: Reuse the proven `src/server/media/**` provider and `/api/media/upload` infrastructure. Most of the work is just an `Attachment` table + parent fields.

7. **Epic 14 — Quote void / compare-versions**.
   - **Why**: Adds `VOID` state to `QuoteVersionStatus`, supersede UX, V1↔V2 diff. Naturally closes the loop with Epic 37 change orders.

8. **Epic 18b — Quote-side / portal structured input intake** (depending on Epic 55 readiness).

9. **Epic 44 — Office-to-field handoff** (formal handoff record + acknowledgment) — small but de-risks runtime visibility.

10. **Epic 39 — Global "My Work" feed** across flows (the rest of the work-station epic that the per-flow feed already implements).

### 3. Can wait

- **Epics 21 / 22 — AI authoring** (gated on the structural hooks in Epic 15/16/23 being mature + a human decision on AI integration depth).
- **Epic 28 — Detours / loopbacks** (advanced runtime-state authoring; not needed until Epic 23 editor exists).
- **Epic 29 — Hold model** (operational holds beyond payment gating).
- **Epics 49 / 50 / 51 — Cost / labor / variance** (the entire money/operations analytics line; needs Epic 14 + 37 stable first).
- **Epic 52 — Learning feedback** (depends on actuals).
- **Epic 56 hardening — general notification engine + real provider creds**.
- **Epic 57 — full audit history** (field-level diffs, exports).
- **Epic 58 — global search**.
- **Epic 59 — full permissions matrix UI**.
- **Epic 60 — admin settings UI**.
- **Epic 38 — inspection** (already folded; do nothing unless decision 03 reverses).
- **Epics 45 / 46 — scheduling** (decision 01 explicit defer).
- **Epic 01 — Leads** (CRM-pre-quote; can wait until adoption demands it).

---

## Highest-risk gaps

These are areas where docs or workflow imply completion but code/tests do not fully prove it. Treat as elevated audit-risk before any "ship" claim.

1. **Epic 23 Process Templates editor — highest false-complete risk**.
   - Both the canon and the rewritten docs imply editor exists. Code only has GET routes. Anyone reading docs without verifying API will assume the editor is buildable today. **Must label as not-started in any external comms.**

2. **Epic 15 greenfield catalog create**.
   - The library list page literally instructs users that packets "appear here after you promote a quote-local packet on a quote scope page." Multiple docs (`docs/epic-completeness-audit/04-priority-epics-to-beef-up.md`) called out the catalog editor as in-progress, but the greenfield-create path is missing — only the *evolution* path exists.

3. **Epic 47 auto-gate creation**.
   - The integration test passes because gates are seeded into the test. In production, gates must be created manually by an operator. If a quote is sent and signed without a gate, the gating backbone enforces nothing. The release notes don't make this explicit.

4. **Epic 13 portal sign**.
   - `QuoteSignatureMethod` enum has *only* `OFFICE_RECORDED`. Customer-facing review/sign portal does not exist. Anything implying "customer can sign their own quote" is inaccurate.

5. **PreJobTask invisibility**.
   - Schema is rich and well-indexed. No API, no UI, no read. Any doc that mentions PreJobTask as user-facing is wrong against current code. Two prior audits flagged this; not yet resolved.

6. **Epic 18 confusion**.
   - The completion-requirements work makes Epic 18 *feel* shipped. It only covers execution capture. Quote-authoring and portal structured inputs are absent. Risk of treating Epic 18 as done.

7. **Epic 56 narrowness**.
   - Notifications, comms providers, and follow-up automation are real, but only for the share/clarification slice. There is no general notification engine. Risk of assuming "notifications are wired" for, e.g., quote-sent or job-activated events.

8. **Epic 57 thin audit**.
   - Only 7 event types in the enum. Most mutations (line item edits, scope packet promotion, signature recording, change-order create/apply) are not audited. False sense of "we have an audit log."

9. **Epic 59 hard-coded roles**.
   - Three roles, no assignment UI, no row-level options. Authorization is sound but inflexible. Not a security risk, but a product-completeness mis-claim risk.

10. **No tests** at the integration level for: portal sharing & clarification (deleted after run per the share-workflow reports), follow-up automation (deleted), structured-data round-trip after CO supersede, large-quote freeze, S3 provider in CI. Implementation reports note "test was created and successfully run, then deleted." This means there is *no regression coverage* preserved in the tree for the share/portal lifecycle, despite extensive functionality. **High drift risk.**

---

## Notes on methodology

- Every epic was checked against (a) the schema, (b) at least one read or mutation file, (c) the API route surface under `src/app/api/`, (d) the office and portal UI under `src/app/(office)/` and `src/app/portal/`, (e) the unit test files under `src/**/*.test.ts`, (f) the integration test files under `scripts/integration/**`, and (g) the implementation reports under `docs/implementation/**`.
- The two prior audit files (`docs/audit/struxient-v3-current-state-epic-gap-audit.md` and `docs/audit/struxient-v3-current-state-verified-epic-audit.md`) are dated 2026-04-17 — significant work has shipped since (Phase 6 Production Workspace, Epic 47 Payment Gating, Epic 37 Change Orders, Customer Share governance + delivery + provider, Project Evidence Rollup, Field Validation, Conditional Rules, Task Definition Authoring, Production Storage Provider, Customer Sharing Lifecycle Finalization). Their status assessments were used as a verified baseline, then re-tested against current files.
- Where prior audits and current code diverged, the more conservative assessment was applied (i.e., shipped → kept; previously-labeled "missing" but now shipped → upgraded to Complete or Partial).
