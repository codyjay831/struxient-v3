# After-action report: quote workspace head-draft workflow pin action

## 1. Objective

Let **office** users fix the **pinned workflow** prerequisite from **dev quote workspace** context without raw `curl`/Postman, by reusing the existing **draft-only** pin mutation. After success, the workspace **refreshes from server truth** so head readiness and compose/send panels reflect the updated pin.

## 2. Scope completed

- **`QuoteVersionHistoryItemDto`** now includes **`pinnedWorkflowVersionId: string | null`** (same DB column already selected for `hasPinnedWorkflow` — no extra query, no forked pin truth).
- New client block **`QuoteWorkspacePinWorkflow`** on `/dev/quotes/[quoteId]`:
  - Shown only when head exists and **`status === "DRAFT"`**; otherwise explains pin is unavailable here.
  - **Set pin:** text field + `PATCH` with string (trimmed).
  - **Clear pin:** `PATCH` with `pinnedWorkflowVersionId: null` (disabled when already clear).
  - Explicit copy: **no workflow-version picker**; ids must be tenant **PUBLISHED** `workflowVersion` rows (server enforces).
- **`router.refresh()`** after successful PATCH so RSC reloads workspace + readiness.
- Integration: **`READ_ONLY` cannot `PATCH /api/quote-versions/:id` for pin** (403, `INSUFFICIENT_ROLE`).
- History integration assertion extended with **`pinnedWorkflowVersionId`** null on new shell.

## 3. Files changed (by purpose)

| Purpose | File |
|--------|------|
| DTO + mapper (expose pin id) | `src/server/slice1/reads/quote-version-history-reads.ts` |
| Dev pin UI | `src/app/dev/quotes/[quoteId]/quote-workspace-pin-workflow.tsx` |
| Page wiring | `src/app/dev/quotes/[quoteId]/page.tsx` |
| Auth smoke | `scripts/integration/auth-spine.integration.test.ts` |
| Report | `docs/implementation/reports/2026-04-12-quote-workspace-pin-workflow-slice.md` |

**Reused backend:** `PATCH /api/quote-versions/[quoteVersionId]` → `setPinnedWorkflowVersionForTenant` (unchanged).

## 4. Workflow-pin action decisions applied

| Decision | Rationale |
|----------|-----------|
| **Target = head only when `DRAFT`** | Matches `assertQuoteVersionDraft` / QV-4; avoids ambiguous “which version?”. |
| **Reuse `PATCH …/quote-versions/:id`** | Single mutation path; no workspace-scoped duplicate API. |
| **`office_mutate`** | Same gate as route; UI hides actions for read-only with explanatory copy. |
| **Manual id entry** | No small, canon workflow-version **list** read in repo; honest dev/office stopgap until discovery exists. |
| **Expose `pinnedWorkflowVersionId` on history DTO** | Read path already loads the column; exposing it prevents a second fetch and keeps readiness + UI aligned with one JSON source (`GET workspace` / `GET …/versions`). |
| **Input sync via `useEffect`** | After `router.refresh()`, server props update; local draft field tracks server pin. |

## 5. Behavioral impact

- Office users on **dev quote workspace** can set/clear pin **for the head draft** without leaving the page.
- **`GET /api/quotes/:quoteId/workspace`** and **`GET /api/quotes/:quoteId/versions`** responses now include **`pinnedWorkflowVersionId`** on each version row (additive JSON field).
- Readiness checklist “pinned workflow” still derives from the same row; after refresh it flips **yes/no** consistently.

## 6. Validation performed

- `npm run test:unit` — passed (readiness unit tests unchanged).
- `npm run build` — passed.

Full **`test:integration`** not run in this pass (requires live server + seed).

## 7. Known gaps / follow-ups

- **No** workflow version discovery UI (list/search by template, filter `PUBLISHED`).
- **No** production (non-dev) workspace shell for pin — dev page only, per prior workspace slices.
- Invalid id / non-published id: user sees server **`PINNED_WORKFLOW_VERSION_NOT_FOUND`** / **`PINNED_WORKFLOW_VERSION_NOT_PUBLISHED`** (existing behavior).

## 8. Risks / caveats

- **Additive DTO field** may affect API clients that assume a fixed JSON shape (unlikely to break; still a contract expansion — document in changelog if you maintain one).
- Pasting a **wrong-tenant** id returns not-found style invariant — correct boundary behavior.

## 9. Recommended next step

**Small read surface:** `GET` tenant workflow versions (or “published versions for flow template X”) so the workspace can offer a **dropdown** instead of paste-only, without building full workflow CRUD.

**Next workspace bottleneck:** after pin + compose preview, **sign / activate** remain off-workspace; optional deep links from readiness to those routes’ docs or minimal POST wrappers (separate slice).

---

### Appendix: How target version is chosen

`head = ws.versions[0]` (versionNumber **desc**). **`headDraftPinTarget`** is set only when `head.status === "DRAFT"`; `quoteVersionId` and `pinnedWorkflowVersionId` come from that same row.

### Appendix: Workflow id selection

**Manual** string entry in dev UI. **Discovery:** not implemented in this slice.

### Appendix: Intentionally missing

Workflow template/version authoring, search, runtime/job integration, sign/activate buttons on this page.
