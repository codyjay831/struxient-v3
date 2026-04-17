# After-action report: auth + tenant integration smoke suite (2026-04-12)

## 1. Objective

Add the **smallest durable regression safety net** around the **real** security boundary that now exists: Auth.js credentials sessions, `User.tenantId` membership, role capabilities (`read` / `office_mutate` / `field_execute`), and tenant-scoped reads/mutations—without a large test framework or fake auth shortcuts as the primary proof.

## 2. Scope completed

- **Tooling decision:** The repo had **no test runner**. **Option B:** added **Vitest** (single dev dependency alongside **dotenv** for loading `.env` / `.env.local` in tests).
- **Integration style:** HTTP `fetch` against a **running Next.js server**, using the **real** Auth.js flow:
  - `GET /api/auth/csrf`
  - `POST /api/auth/callback/credentials` with `X-Auth-Return-Redirect: 1` and form body (`csrfToken`, `email`, `password`, `tenantId`, `callbackUrl`)
  - Subsequent requests send the returned **Set-Cookie** values as a `Cookie` header.
- **No `STRUXIENT_DEV_AUTH_BYPASS` in tests** — sessions are credential-based only.
- **Seed extensions** (single tenant graph + isolation tenant):
  - Tenant A: existing seed user `seed@example.com` (OFFICE_ADMIN) plus **`readonly@example.com` (READ_ONLY)** and **`field@example.com` (FIELD_WORKER)** with the same bcrypt password as the seed user.
  - Tenant B: minimal **OtherTenant** + **`other@example.com` (OFFICE_ADMIN)** so a real second-tenant session can be obtained.
  - **`scripts/integration/fixture.json`** written by seed (gitignored) with tenant ids, quote version id, proposal group id, emails, and base password label.
- **Tests** in `scripts/integration/auth-spine.integration.test.ts` cover:
  1. Unauthenticated **401** on `GET …/scope` and `POST …/send`.
  2. Office session: **200** on `GET …/scope` with `meta.auth.source === "session"`.
  3. Office **PATCH** proposal group rename (**office_mutate**).
  4. READ_ONLY **403** on office PATCH, on `POST …/send`, and on runtime start (wrong capability).
  5. FIELD_WORKER **403** on office PATCH.
  6. FIELD_WORKER **404** on unknown runtime task id (proves capability passed, then not found).
  7. Tenant B session: **404** on tenant A scope + **404** on tenant A proposal PATCH (no cross-tenant leak/mutation).
  8. **Optional** (when `STRUXIENT_DEV_FLOW_ID` is set after `db:seed:activated` + `DATABASE_URL` for lookup): FIELD_WORKER **200** or **409** on real `POST …/runtime-tasks/{id}/start`; skeleton **start** **200**/**409** using first skeleton id from `GET /api/flows/{flowId}`.

## 3. Files changed (grouped by purpose)

| Purpose | Files |
|--------|--------|
| Seed + fixture | `prisma/seed.js` |
| Gitignore | `.gitignore` (`scripts/integration/fixture.json`) |
| Integration helpers + tests | `scripts/integration/auth-spine-helpers.ts`, `scripts/integration/auth-spine.integration.test.ts` |
| Fixture shape reference (committed) | `scripts/integration/fixture.example.json` |
| Vitest config | `vitest.integration.config.ts` |
| npm scripts + deps | `package.json`, `package-lock.json` |
| Env hints | `.env.example` |
| This report | `docs/implementation/reports/2026-04-12-auth-integration-smoke-suite.md` |

## 4. Testing / tooling decisions applied

| Decision | Rationale |
|----------|-----------|
| **Vitest** | Minimal, TypeScript-native, no UI E2E stack; one config file scoped to `scripts/integration/**/*.integration.test.ts`. |
| **External Next server** | Exercises real Route Handlers, Auth.js cookie/JWT issuance, and middleware edge behavior—closer to production than importing handlers directly. |
| **`INTEGRATION_BASE_URL`** | Defaults to `http://127.0.0.1:3000`; override when dev server uses another port/host. |
| **Fixture from seed** | Deterministic ids without duplicating business setup in tests; fails fast with a clear message if seed was not run. |
| **Prisma in `beforeAll` (optional)** | Only to resolve `runtimeTaskId` when activation exists—narrow bootstrap, not an auth bypass. |
| **dotenv in test entry** | Loads `.env` then `.env.local` so `DATABASE_URL` / `STRUXIENT_DEV_FLOW_ID` match the developer’s setup. |

## 5. Auth / tenant behaviors now covered

- **Unauthenticated rejection** on read + mutation samples.
- **Same-tenant read** with real session.
- **Office mutation** (proposal group PATCH) with office role.
- **Capability enforcement:** READ_ONLY vs office and field routes; FIELD_WORKER vs office.
- **Wrong-tenant isolation:** 404 on read and mutate for tenant B against tenant A resources (non-leak).
- **Field execution path** (when activated): real `POST …/start` for runtime + skeleton (idempotent-friendly status set).

## 6. Validation performed

- `npm run lint` — pass.
- `npm run build` — pass (with `AUTH_SECRET` / placeholder `DATABASE_URL` as in CI-style checks).
- `npm run test:integration` — **executes**; in this workspace **full pass** requires: valid Postgres, `npm run db:seed` (writes `fixture.json`), running `npm run dev`, and optionally `npm run db:seed:activated` for field/skeleton assertions. Seed against placeholder DB failed here by design; the suite is intended for local/CI with a real database.

## 7. Known gaps / follow-ups

- **Not run as part of `npm run build`** — integration tests need a live server + DB; document in CI as a separate job (migrate → seed → `next start` → `test:integration`).
- **No automated server orchestration** in-repo (e.g. `start-server-and-test`) — kept narrow; teams can add one command if desired.
- **Field/skeleton tests** are conditional on activation + env — partial coverage if only `db:seed` is used (role + tenant isolation still fully covered).
- **No negative matrix** on every spine route — deliberate smoke scope.
- **Cookie / host alignment:** sign-in host should match how developers run Next (`localhost` vs `127.0.0.1`) to avoid cookie visibility issues; `trustHost` mitigates some cases but matching `INTEGRATION_BASE_URL` to the browser/dev URL is safest.

## 8. Risks / caveats

- **Flakiness** if server is slow — timeouts set to 45s for hooks/tests.
- **Vitest major version** drift — pin in `package.json` if CI stability requires it.
- **Shared password** across fixture users in seed — acceptable for dev/smoke only.

## 9. Recommended next step

**Entity CRUD behind auth** (as per product direction): new routes should ship with the same principal/capability pattern, and the smoke suite can gain **one** representative CRUD check per new surface rather than expanding into a large matrix.

---

### Appendix: how to run locally

```text
# Terminal 1
npx prisma migrate dev
npm run db:seed
# optional for field/skeleton success cases:
npm run db:seed:activated

# Ensure AUTH_SECRET and DATABASE_URL in .env.local; start app
npm run dev

# Terminal 2 (same repo root; loads .env.local for STRUXIENT_DEV_FLOW_ID + DATABASE_URL)
npm run test:integration
```

Optional: `INTEGRATION_BASE_URL=http://localhost:3000 npm run test:integration` if the dev server uses `localhost`.
