# After-action: CI integration smoke wiring (2026-04-12)

## 1. Objective

Wire **Struxient v3** so the existing **Vitest integration smoke suite** (`npm run test:integration`) runs automatically in **CI** against:

- a **real PostgreSQL** instance (service container),
- a **real production-mode Next.js** server (`next build` → `next start`),
- the **real Auth.js credentials** path (no `STRUXIENT_DEV_AUTH_BYPASS`),
- **deterministic setup order**: migrate → seed (writes `scripts/integration/fixture.json`) → build → start → readiness poll → tests.

## 2. Scope completed

- Added **GitHub Actions** workflow **`.github/workflows/integration-smoke.yml`** (single job, no matrix).
- Added **`scripts/ci/wait-for-http.mjs`**: polls `GET /api/auth/providers` until HTTP 2xx (configurable URL / attempts / interval).
- Added **`npm run ci:wait-for-app`** as a thin wrapper (workflow calls `node` directly; script is reusable locally).
- Documented the CI path briefly in **`.env.example`** (cross-link to workflow + wait script).
- **Did not** change auth, Prisma schema, integration test assertions, or introduce dev-auth bypass for CI.

## 3. Files changed (by purpose)

| Purpose | File |
|--------|------|
| CI orchestration | `.github/workflows/integration-smoke.yml` |
| Readiness wait (not sleep-only) | `scripts/ci/wait-for-http.mjs` |
| npm script surface | `package.json` (`ci:wait-for-app`) |
| Env / operator hints | `.env.example` |
| This report | `docs/implementation/reports/2026-04-12-ci-integration-smoke-wiring-slice.md` |

## 4. CI / setup decisions

| Decision | Choice |
|----------|--------|
| **CI provider** | **GitHub Actions** — no project-owned workflow existed previously; this is the smallest standard addition for merge validation on GitHub. |
| **Postgres** | **`postgres:16-alpine`** as a **job service** with **`pg_isready`** health checks; `DATABASE_URL` uses `127.0.0.1:5432` from the job container to the mapped service port. |
| **Schema + data** | `npx prisma migrate deploy` then `npm run db:seed` (Prisma seed = `node prisma/seed.js`), matching local operator order. |
| **Seed side effects** | `STRUXIENT_SEED_SKIP_DEV_ENV=1` and `STRUXIENT_SEED_SKIP_DATABASE_URL_MIRROR=1` so CI does not write `.env.local` or mirror DB URL into it; fixture JSON is still produced by seed as required by integration helpers. |
| **App startup** | `nohup npm run start -- --port 3000` in background, **`NODE_ENV=production`** for that step only (install/build stay outside forced production env to avoid skipping devDependencies). |
| **Readiness** | **`node scripts/ci/wait-for-http.mjs`** — polls **`INTEGRATION_BASE_URL`-aligned default** `http://127.0.0.1:3000/api/auth/providers` until success or **~2 min** timeout (60 × 2s). Short initial `sleep 2` only covers process spawn, not readiness. |
| **Auth URL honesty** | **`AUTH_URL`** and **`NEXTAUTH_URL`** set to `http://127.0.0.1:3000` alongside **`INTEGRATION_BASE_URL`** so server-side Auth.js URL inference matches where tests call the app. |
| **Secrets** | **`AUTH_SECRET`** is a **fixed CI-only string** (32+ characters). It is **not** a production secret; it exists only to satisfy Auth.js in ephemeral runners. |

## 5. Behavioral impact

- **On GitHub**: pushes/PRs to **`main`** or **`master`** run the integration smoke job automatically.
- **Locally**: unchanged default developer flow; optional `npm run ci:wait-for-app` after `next start` mirrors CI readiness behavior.
- **Tests**: unchanged semantics — still hit the running server with real credential sign-in as implemented in `scripts/integration/auth-spine.integration.test.ts` and helpers.

## 6. Validation performed

- Verified **`next start --help`** for this repo’s Next.js version (port/hostname flags).
- **Not** run end-to-end on this machine: a full CI-equivalent pass requires a reachable Postgres matching `DATABASE_URL` and a successful `migrate deploy` + seed + build + start + Vitest run. That is expected to execute on the first GitHub Actions run after merge.

**Suggested local parity check** (when Docker Postgres is available):

1. Export the same env vars as the workflow (or use `.env` with a local DB).
2. `npm ci` → `npx prisma migrate deploy` → `npm run db:seed` → `npm run build`.
3. `NODE_ENV=production npm run start` (another terminal).
4. `npm run ci:wait-for-app` → `npm run test:integration`.

## 7. Known gaps / follow-ups

- **No `act` / self-hosted runner validation** in this slice — report is explicit that first green is **post-push** to GitHub unless a maintainer runs the manual parity steps above.
- **Branch filters** are only `main` and **`master`**; if the default branch differs, extend `on.push.branches` / `pull_request` as needed.
- **Workflow does not cache Prisma** beyond npm cache — acceptable for smoke; optimize later if job time hurts.
- **Log capture on failure** prints tail of `/tmp/next-start.log`; does not upload artifacts (could add `actions/upload-artifact` later).

## 8. Risks / caveats

- **Runner variance**: rare flakes if Postgres health passes but first connections still race; mitigate by re-running job or increasing `WAIT_MAX_ATTEMPTS` if observed.
- **AUTH_SECRET in YAML**: acceptable for disposable CI; **never** reuse this value in real deployments.
- **Single job** means build + server + tests share one runner — intentional for smoke cost/simplicity.

## 9. Recommended next step

After the first Actions run: if green, treat **`integration-smoke`** as a **required status check** for the default branch in GitHub branch protection. If red, use the printed Next log tail + Vitest output to distinguish **migrate/seed/build/start** failures from **test** failures.

## References (existing smoke documentation)

- Auth integration smoke suite narrative: `docs/implementation/reports/2026-04-12-auth-integration-smoke-suite.md`
- Commercial lifecycle e2e smoke slice: `docs/implementation/reports/2026-04-12-commercial-lifecycle-e2e-smoke-slice.md`

## Intentionally out of scope

- Browser E2E, load/perf testing, multi-OS matrices, deployment automation, field-runtime smoke expansion, and redesign of Vitest layout or test scripts beyond the minimal `ci:wait-for-app` helper.
