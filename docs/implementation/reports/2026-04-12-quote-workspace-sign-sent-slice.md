# After-action report: quote workspace sign (SENT → SIGNED)

## 1. Objective

Add a **minimal dev-workspace** path so an **office** user can run **customer acceptance sign** (office-recorded MVP) using the existing **`POST /api/quote-versions/:id/sign`** route, with **explicit** choice of which version is signable, **no** new sign business logic, and **server refresh** after success.

## 2. Scope completed

- **Sign target rule** (documented + unit-tested): from workspace `versions` ordered **newest-first** (same as API workspace/history), take the **first** row with `status === "SENT"`. That is the **highest `versionNumber`** among `SENT` rows. If the head is `DRAFT` and an older row is `SENT`, the UI targets the **SENT** row, not the draft head.
- Pure helper: `deriveNewestSentSignTarget` in `src/lib/workspace/derive-workspace-sent-sign-target.ts` + Vitest coverage.
- Client panel: `QuoteWorkspaceSignSent` — explains target, links lifecycle/freeze for that id, `POST` sign with empty JSON body, `router.refresh()` on success; surfaces `SIGN_ROLLED_BACK_AUTO_ACTIVATE_FAILED` copy when returned.
- Page wiring: `/dev/quotes/[quoteId]` computes `sentSignTarget` and renders the panel **after** compose/send (draft actions first, then sent lifecycle step).
- **`QuoteWorkspaceRouteHints`**: added `quoteVersionSignPost` static hint.
- **Integration**: unauthenticated sign **401**; **READ_ONLY** sign **403** `INSUFFICIENT_ROLE`; workspace JSON asserts `routeHints.quoteVersionSignPost` contains `/sign`.

## 3. Files changed (by purpose)

| Purpose | File |
|--------|------|
| Sign target derivation | `src/lib/workspace/derive-workspace-sent-sign-target.ts` |
| Unit tests | `src/lib/workspace/derive-workspace-sent-sign-target.test.ts` |
| Workspace UI | `src/app/dev/quotes/[quoteId]/quote-workspace-sign-sent.tsx` |
| Page | `src/app/dev/quotes/[quoteId]/page.tsx` |
| Route hints | `src/server/slice1/reads/quote-workspace-reads.ts` |
| Smoke | `scripts/integration/auth-spine.integration.test.ts` |
| Report | `docs/implementation/reports/2026-04-12-quote-workspace-sign-sent-slice.md` |

**Unchanged:** `POST …/sign` handler, `signQuoteVersionForTenant` mutation, auth capability model.

## 4. Sign-action decisions applied

| Decision | Rationale |
|----------|-----------|
| **Not “head only”** | Head may be `DRAFT` while a prior version is `SENT`; sign must attach to the **SENT** row per server rules. |
| **First `SENT` in newest-first list** | Matches “newest SENT” in normal data; multiple `SENT` is an anomaly — rule is deterministic (first match). |
| **Reuse `POST /api/quote-versions/:id/sign`** | `office_mutate`; `recordedByUserId` from session in route (unchanged). |
| **Empty POST body** | Route does not require a body; no invented form fields. |
| **No portal / e-sign** | Copy states office-recorded MVP; no customer UI. |

## 5. Behavioral impact

- Dev quote workspace shows a **Sign (SENT → SIGNED)** section when history contains a `SENT` version; otherwise explains why sign is not offered.
- After successful sign, **RSC refresh** updates readiness, version list, and compose/sign panels from server truth.

## 6. Validation performed

- `npm run test:unit` — **10** tests (readiness + sign-target).
- `npm run build` — success.
- `test:integration` — not run in this pass.

## 7. Known gaps / follow-ups

- **No** happy-path integration for sign **200** (would require a `SENT` fixture row and flow-group job prerequisites).
- **No** workspace control for **activate** (next lifecycle bottleneck).
- **No** choice UI when business wants to sign a **non-newest** `SENT` (should not occur in normal invariants).

## 8. Risks / caveats

- **`autoActivateOnSign`**: tenant flag can roll back sign; UI mentions the error code pattern; operators must read nested `activation` error in JSON.
- **Idempotent replay**: server may return 200 with `idempotentReplay: true` if already signed — UI still refreshes.

## 9. Recommended next step

**Workspace-level activate** (or deep link + minimal POST) for **SIGNED** versions without activation, reusing `POST /api/quote-versions/:id/activate` with explicit target rule and the same honesty pattern as sign.

---

### Appendix: Route reused

`POST /api/quote-versions/[quoteVersionId]/sign` — capability **`office_mutate`**.

### Appendix: Intentionally missing

Contract signing, customer portal, lifecycle timeline UI, job/runtime execution from this panel, signing a version that is not `SENT` (server rejects with `QUOTE_VERSION_NOT_SENT`).
