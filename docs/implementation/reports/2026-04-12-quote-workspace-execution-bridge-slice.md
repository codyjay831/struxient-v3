# After-action report: quote workspace execution bridge (flow / work-feed)

## 1. Objective

After activation, the dev quote workspace should **not dead-end**: surface a **thin, explicit** bridge to existing **read** APIs and **dev** execution pages (`/dev/flow/[flowId]`, `/dev/work-feed/[flowId]`) using data the tenant already owns — **no** new runtime semantics, **no** task controls in workspace, **no** embedded full flow execution payloads.

## 2. Scope completed

### Target rule (documented + unit-tested)

- **`deriveNewestActivatedExecutionEntryTarget`**: from `versions` **newest-first**, take the **first** row with `hasActivation === true` → **highest `versionNumber`** among activated versions (same explicit pattern as sign/activate slices).

### Server read (cheap summary)

- On `/dev/quotes/[quoteId]`, when a target exists, one extra **`getQuoteVersionLifecycleReadModel`** for that `quoteVersionId` (same tenant as workspace). Fields used for display/links only: `activation` id + `activatedAt`, `flow` id + `runtimeTaskCount`, `job` id (prefer `job.id` from flow group, fallback `flow.jobId`).

### UI

- **`QuoteWorkspaceExecutionBridge`** (RSC, no client JS):  
  - **None** state when no history row has `hasActivation`.  
  - **Linked** state: short bullet summary + links to `GET …/lifecycle`, `GET /api/flows/:flowId`, `GET /api/jobs/:jobId`, **Dev flow**, **Work feed**, scope dev, workspace JSON. Flow/work-feed/job links omitted when ids are absent.

### Route hints

- `QuoteWorkspaceRouteHints`: **`flowExecutionGet`**, **`jobShellGet`** (existing API path templates).

### Verification

- Workspace integration assertion extended for new hints.
- Unit tests for execution-entry derivation (3 cases).

**Not added:** workspace JSON DTO shape unchanged; no new public API routes.

## 3. Files changed (by purpose)

| Purpose | File |
|--------|------|
| Derivation + tests | `src/lib/workspace/derive-workspace-execution-entry-target.ts`, `.test.ts` |
| Bridge UI (RSC) | `src/app/dev/quotes/[quoteId]/quote-workspace-execution-bridge.tsx` |
| Page + lifecycle read | `src/app/dev/quotes/[quoteId]/page.tsx` |
| Route hints | `src/server/slice1/reads/quote-workspace-reads.ts` |
| Smoke | `scripts/integration/auth-spine.integration.test.ts` |
| Report | `docs/implementation/reports/2026-04-12-quote-workspace-execution-bridge-slice.md` |

## 4. Execution-entry decisions applied

| Decision | Rationale |
|----------|-----------|
| **Newest activated version** | Matches user recommendation; avoids head-only when newer draft exists without activation. |
| **Lifecycle read for summary** | Reuses established tenant-scoped read; includes flow/job pointers without calling `getFlowExecutionReadModel` (heavier) on workspace page. |
| **Links only** | Task start/complete remain on work-feed / runtime APIs, not duplicated here. |
| **Hints = API templates** | Dev URLs are obvious in the panel; hints stay aligned with protected JSON routes. |

## 5. Behavioral impact

- Dev workspace shows **Execution entry** after activate panel; users can jump to **work feed** or **flow execution** dev pages when `flowId` exists.
- `GET /api/quotes/:quoteId/workspace` clients receive new `routeHints` keys for flow/job reads.

## 6. Validation performed

- `npm run test:unit` — **17** tests pass.
- `npm run build` — success.
- `test:integration` — not run in this pass.

## 7. Known gaps / follow-ups

- **No** merged “work items” list on workspace (separate read product).
- **No** deep link to individual `runtimeTaskId` (would need list read + selection UX).
- If history `hasActivation` is true but lifecycle lacks `flow` (inconsistent data), panel still links lifecycle/scope for investigation.

## 8. Risks / caveats

- **One extra Prisma read** per workspace page load when any version is activated — bounded and tenant-scoped.
- **Stale history vs lifecycle**: rare mismatch; lifecycle is authoritative for ids shown.

## 9. Recommended next step

**E2E smoke:** office path quote → send → sign → activate → assert workspace bridge shows `flowId` and `GET /api/flows/:id` returns **200** (seeded path), or document manual QA checklist.

**Product next:** optional “copy flow id” / “open work feed in new tab” polish without adding task execution to workspace.

---

### Appendix: Reused routes / pages

| Surface | Path |
|--------|------|
| Lifecycle JSON | `GET /api/quote-versions/:quoteVersionId/lifecycle` |
| Flow execution JSON | `GET /api/flows/:flowId` |
| Job shell JSON | `GET /api/jobs/:jobId` |
| Dev flow | `/dev/flow/[flowId]` |
| Dev work feed | `/dev/work-feed/[flowId]` |

### Appendix: Intentionally missing

Runtime task POST controls, job management, scheduling, field-worker views, embedded `toFlowExecutionApiDto` payload on workspace.
