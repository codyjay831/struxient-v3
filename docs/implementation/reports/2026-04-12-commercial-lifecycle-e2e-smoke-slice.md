# After-action report: commercial lifecycle end-to-end integration smoke

## 1. Objective

Add **one** authenticated, **HTTP-first** regression that proves the core commercial → execution spine works together:

**create shell → pin workflow → MANIFEST line → compose preview → send → sign → activate → lifecycle + workspace + flow read truth.**

No Playwright, no mocks of server behavior, no new business logic.

## 2. Scope completed

### Seed / fixture

- **`prisma/seed.js`**: `fixture.json` now includes **`seedPublishedWorkflowVersionId`** (tenant A published `WorkflowVersion` from seed) and **`seedPublishedScopePacketRevisionId`** (tenant A published catalog `ScopePacketRevision` used by manifest lines).
- **`scripts/integration/auth-spine-helpers.ts`**: `SmokeFixture` documents optional `seedPublished*` fields.

### Integration test

- **`scripts/integration/auth-spine.integration.test.ts`**: new **`it(..., 120_000)`** case **`office: shell → pin → manifest line → compose → send → sign → activate → lifecycle + workspace show flow`** using existing **`cookieOffice`** (real credentials session).
- Steps (all real routes, `office_mutate` or `read` as today):
  1. `POST /api/commercial/quote-shell` (`new_customer_new_flow_group` body)
  2. `PATCH /api/quote-versions/:id` — `pinnedWorkflowVersionId` from fixture
  3. `POST /api/quote-versions/:id/line-items` — one **MANIFEST** line with `scopePacketRevisionId` from fixture (empty shell otherwise cannot compose/send)
  4. `POST …/compose-preview` — expect **no blocking errors**; read **`stalenessToken`**
  5. `POST …/send` — `clientStalenessToken` + unique **`sendClientRequestId`**
  6. `POST …/sign` — same quote version id (sole `SENT` row)
  7. `POST …/activate`
  8. `GET …/lifecycle` — **`flow.id`** and **`activation.id`** align with activate response
  9. `GET /api/quotes/:quoteId/workspace` — version row **`hasActivation`**, **`routeHints.flowExecutionGet`** present
  10. `GET /api/flows/:flowId` — **200** (execution read for returned flow id)

If fixture lacks the new keys, the test **throws** with an explicit **re-seed** message (no silent skip).

## 3. Files changed (by purpose)

| Purpose | File |
|--------|------|
| Fixture output | `prisma/seed.js` |
| Fixture type | `scripts/integration/auth-spine-helpers.ts` |
| Smoke test | `scripts/integration/auth-spine.integration.test.ts` |
| Harness comment | `scripts/integration/auth-spine.integration.test.ts` (prereq note) |
| Report | `docs/implementation/reports/2026-04-12-commercial-lifecycle-e2e-smoke-slice.md` |

## 4. Smoke design decisions applied

| Decision | Rationale |
|----------|-----------|
| **API-only** | Truth is in protected routes; matches existing harness. |
| **Real session** | Uses `signInCredentialsSession` office cookie (not dev bypass as primary). |
| **One MANIFEST line** | Empty commercial shell has no scope lines; send requires non-empty compose; fixture exposes tenant-stable revision id instead of hard-coding cuids. |
| **120s test timeout** | Chain is several round-trips; avoids flaky timeout on slow CI. |
| **Throw if fixture incomplete** | Forces `npm run db:seed` after pulling seed changes — avoids false green. |

## 5. Behavioral impact

- After seed, **`npm run test:integration`** can validate the full chain when Next + DB are available.
- No production runtime behavior change.

## 6. Validation performed

- `npm run build` — success.
- **`npm run test:integration`** — not executed in this environment (no long-lived Next + DB here). Run locally after `db:seed` + `npm run dev`.

## 7. Known gaps / follow-ups

- **Not covered**: field worker task execution, skeleton paths, negative cases, multi-version sign target ordering (single-version quote only).
- **fixture.json** is gitignored — CI must run seed before tests (already required for fixture existence).
- No assertion on **work-feed HTML** — only `GET /api/flows/:id` as execution-surface proof.

## 8. Risks / caveats

- Seed/catalog/workflow shape drift could break compose/send while leaving earlier steps green — assertions on compose errors + send status mitigate.
- Parallel test runs share DB: unique customer/FG names avoid collision; `sendClientRequestId` is unique per run.

## 9. Recommended next step

Optional **second smoke** for “create next draft on quote that already has SENT head” or **field_worker** runtime start after this chain (separate slice). Alternatively wire **CI job** to run `db:seed` + `test:integration` on merge.

---

### Appendix: Lifecycle chain covered

`quote-shell` → `PATCH` pin → `POST` line-items → `POST` compose-preview → `POST` send → `POST` sign → `POST` activate → `GET` lifecycle → `GET` workspace → `GET` flow execution.

### Appendix: Still not covered

Browser UI, e-sign, autoActivateOnSign rollback, task start/complete, tenant B boundaries (covered elsewhere).
