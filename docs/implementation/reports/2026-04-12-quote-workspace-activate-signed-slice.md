# After-action report: quote workspace activate (SIGNED → Flow)

## 1. Objective

Add a **minimal dev-workspace** path so an **office** user can run **activation** (frozen snapshots → Flow + runtime tasks) using the existing **`POST /api/quote-versions/:id/activate`** route, with an **explicit** version target derived from history (not head-only), **no** new activation business logic, and **server refresh** after success.

## 2. Scope completed

- **Activate target rule** (documented + unit-tested): from `versions` **newest-first**, take the **first** row where `status === "SIGNED"` and `hasActivation === false`. That is the **highest `versionNumber`** among signed rows that still need activation. If the head is `DRAFT` or `SENT` but an older row is `SIGNED` without activation, that older row can still be the candidate when it appears first in the ordered list before any newer signed-without-activation row — in practice the user’s “newest signed without activation” invariant is exactly this `find` on newest-first order.
- Pure helper: `deriveNewestSignedWithoutActivationTarget` in `src/lib/workspace/derive-workspace-signed-activate-target.ts` (+ `hasFrozenArtifacts` on the DTO for honest UI copy).
- Client panel: `QuoteWorkspaceActivateSigned` — target explanation, lifecycle/freeze links, `POST` with empty body, `router.refresh()` on success; surfaces API error codes from existing failure mapper.
- Page wiring: `/dev/quotes/[quoteId]` maps `ws.versions` into the derive input and renders the panel **after** sign.
- **`QuoteWorkspaceRouteHints`**: `quoteVersionActivatePost`.
- **Integration**: unauthenticated activate **401**; **READ_ONLY** activate **403** `INSUFFICIENT_ROLE`; workspace JSON asserts `routeHints.quoteVersionActivatePost` contains `/activate`.

## 3. Files changed (by purpose)

| Purpose | File |
|--------|------|
| Derivation + tests | `src/lib/workspace/derive-workspace-signed-activate-target.ts`, `.test.ts` |
| Workspace UI | `src/app/dev/quotes/[quoteId]/quote-workspace-activate-signed.tsx` |
| Page | `src/app/dev/quotes/[quoteId]/page.tsx` |
| Route hints | `src/server/slice1/reads/quote-workspace-reads.ts` |
| Smoke | `scripts/integration/auth-spine.integration.test.ts` |
| Report | `docs/implementation/reports/2026-04-12-quote-workspace-activate-signed-slice.md` |

**Unchanged:** `POST …/activate` handler, `activateQuoteVersionForTenant` / in-transaction logic, auth capabilities.

## 4. Activate-action decisions applied

| Decision | Rationale |
|----------|-----------|
| **Not head-only** | Head may be draft/sent while an older version is `SIGNED` without `Activation`. |
| **First `SIGNED` ∧ ¬hasActivation` in newest-first list** | Matches user spec; deterministic if multiple anomalies exist. |
| **Reuse `POST /api/quote-versions/:id/activate`** | `office_mutate`; `activatedByUserId` from session in route. |
| **Honest prerequisites** | Copy states frozen snapshot / job / server invariant requirements; `hasFrozenArtifacts` from history is a **hint** only — server can still return `MISSING_FREEZE`, `JOB_MISSING`, hash/snapshot errors. |
| **No runtime UI** | No task start/complete, no flow dashboard. |

## 5. Behavioral impact

- Dev workspace shows **Activate (SIGNED → Flow / runtime)** when a matching history row exists; otherwise explains absence.
- Successful activate triggers **RSC refresh** for readiness and version list.

## 6. Validation performed

- `npm run test:unit` — all tests pass (readiness + sign-target + activate-target).
- `npm run build` — success.
- `test:integration` — not run in this pass.

## 7. Known gaps / follow-ups

- **No** happy-path integration for activate **200** (needs signed + job + valid freeze chain in seed).
- **No** workspace UI for **runtime task execution** (next operational layer after activation).

## 8. Risks / caveats

- **History `hasActivation` / `hasFrozenArtifacts`** can be briefly stale until refresh; server is authoritative on activate.
- **Idempotent replay**: server may return success with `idempotentReplay: true` if activation already exists — UI still refreshes.

## 9. Recommended next step

**Minimal runtime read + field/office execution entry** from workspace (deep links to existing task APIs or a thin “open work feed” link scoped to `flowId`), without building a full dashboard.

---

### Appendix: Route reused

`POST /api/quote-versions/[quoteVersionId]/activate` — capability **`office_mutate`**.

### Appendix: Intentionally missing

Runtime task lists, skeleton completion UI, job editor, lifecycle timeline, choosing a non-newest signed row when two lack activation (first in list wins).
