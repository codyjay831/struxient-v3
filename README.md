# Struxient v3

Trade-first, line-item-fronted, packet-driven commercial-to-execution spine.

This README covers **local setup only**. Architectural canon, epics, and slice reports live under `docs/`.

---

## Prerequisites

- **Node.js 20+** (Next.js 15 + React 19; the repo does not pin a version, but 20 LTS is the safe baseline).
- **npm** (ships with Node).
- One of the following Postgres options:
  - **Docker Desktop** (recommended — matches the repo convention).
  - **Native PostgreSQL 16** install with admin access.

---

## 1. Install

```powershell
npm install
```

`postinstall` runs `prisma generate` against a placeholder URL, so this step does **not** require Postgres to be running.

---

## 2. Local database

The repo expects Postgres at:

| field    | value           |
| -------- | --------------- |
| host     | `localhost`     |
| port     | `5432`          |
| user     | `struxient`     |
| password | `struxient`     |
| database | `struxient_v3`  |

Both `.env` (used by the Prisma CLI for `migrate` / `db seed` / `generate`) and `.env.local` (used by the Next.js runtime) ship with this `DATABASE_URL` already wired:

```
DATABASE_URL="postgresql://struxient:struxient@localhost:5432/struxient_v3?schema=public"
```

If you change credentials, update `DATABASE_URL` in **`.env`** — `npm run db:seed` will mirror it into `.env.local` for you (set `STRUXIENT_SEED_SKIP_DATABASE_URL_MIRROR=1` to opt out).

### Option A — Docker (recommended)

Start Docker Desktop once, then create the container:

```powershell
docker run -d `
  --name struxient-pg `
  -e POSTGRES_USER=struxient `
  -e POSTGRES_PASSWORD=struxient `
  -e POSTGRES_DB=struxient_v3 `
  -p 5432:5432 `
  -v struxient-pg-data:/var/lib/postgresql/data `
  postgres:16
```

After first creation, just start it on subsequent sessions:

```powershell
docker start struxient-pg
```

Verify it's reachable:

```powershell
docker exec struxient-pg pg_isready -U struxient -d struxient_v3
```

### Option B — Native PostgreSQL 16

Install Postgres 16, then run `psql` as a superuser:

```sql
CREATE ROLE struxient WITH LOGIN PASSWORD 'struxient';
CREATE DATABASE struxient_v3 OWNER struxient;
```

### Verify connectivity (either option)

```powershell
powershell -Command "Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet"
```

Should print `True` before continuing.

---

## 3. Auth secret

Generate a secret and set it in `.env.local`:

```powershell
# Generate a value (any 32-byte base64 string works):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Then add to `.env.local`:

```
AUTH_SECRET="<paste value>"
```

Required for credentials sign-in. See `.env.example` for all optional knobs.

---

## 4. Migrations & seed

```powershell
npx prisma migrate deploy
npm run db:seed
```

`db:seed` does three things:

1. Builds the dev tenant + sample quote graph.
2. Writes `STRUXIENT_DEV_TENANT_ID`, `STRUXIENT_DEV_QUOTE_VERSION_ID`, and `STRUXIENT_DEV_USER_ID` into `.env.local`.
3. Creates seeded login users (see [Sign in](#6-sign-in) below).

Set `STRUXIENT_SEED_SKIP_DEV_ENV=1` to skip the `.env.local` write (e.g. CI).

### Optional — activated execution path

To exercise the full send → sign → activate flow against the seeded quote, run:

```powershell
npm run db:seed:activated
```

This adds `STRUXIENT_DEV_FLOW_ID` and `STRUXIENT_DEV_JOB_ID` to `.env.local`, which makes the seeded-redirect helpers (`/dev/flow`, `/dev/work-feed`) work without manually copying ids.

---

## 5. Run the app

```powershell
npm run dev
```

Open http://localhost:3000. The home page is the **internal testing hub** — it lists every reachable v3 surface grouped by lifecycle stage, with `Needs seed` badges on the surfaces that depend on `db:seed:activated`.

> Restart `npm run dev` whenever `.env.local` changes (seed scripts mention this in their output).

---

## 6. Sign in

After `npm run db:seed`, three credentials users exist in the seeded tenant. Default password is `struxient-dev` (override with `STRUXIENT_SEED_DEV_PASSWORD` before re-seeding).

| email                   | role          | use for                                   |
| ----------------------- | ------------- | ----------------------------------------- |
| `seed@example.com`      | OFFICE        | quote authoring, send, sign, activate     |
| `readonly@example.com`  | READ_ONLY     | testing capability gates                  |
| `field@example.com`     | FIELD_WORKER  | execution/work-feed surfaces              |

A fourth user `other@example.com` exists in a separate tenant for cross-tenant isolation tests.

Sign in at http://localhost:3000/dev/login (tenant id is in `.env.local` as `STRUXIENT_DEV_TENANT_ID`).

### Optional — local-only auth bypass

For pure read-flow inspection without sign-in, set in `.env.local`:

```
STRUXIENT_DEV_AUTH_BYPASS=true
```

Ignored when `NODE_ENV=production`. Tenant + user come from the seeded `STRUXIENT_DEV_TENANT_ID` / `STRUXIENT_DEV_USER_ID`.

---

## 7. Quick test path

Once signed in:

1. `/` — testing hub, pick a section.
2. `/dev/new-quote-shell` — create a quote shell; the success panel links straight into its workspace.
3. `/dev/quotes/<quoteId>` — quote workspace: revise, select workflow, send, sign, activate.
4. `/dev/flow` and `/dev/work-feed` — execution surfaces (need `db:seed:activated`).

---

## Common scripts

| script                      | purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `npm run dev`               | Next.js dev server (Turbopack)                                |
| `npm run build` / `start`   | production build + serve                                      |
| `npm run lint`              | ESLint                                                        |
| `npm run typecheck`         | `tsc --noEmit`                                                |
| `npm run prisma:validate`   | validate `prisma/schema.prisma`                               |
| `npm run prisma:format`     | format `prisma/schema.prisma`                                 |
| `npm run prisma:generate`   | regenerate the Prisma client                                  |
| `npm run db:seed`           | seed dev graph + write `.env.local` ids                       |
| `npm run db:seed:activated` | extend seed through send → sign → activate                    |
| `npm run test:unit`         | unit tests (`vitest.unit.config.ts`)                          |
| `npm run test:integration`  | integration smoke against a running app (see `.env.example`)  |
| `npm run ci:wait-for-app`   | poll `/api/auth/providers` until the dev/start server is up   |

---

## Troubleshooting

**`PrismaClientInitializationError: Can't reach database server at localhost:5432`**
Postgres isn't running. Start the container (`docker start struxient-pg`) or your native service, then re-run the seed.

**`warn The configuration property package.json#prisma is deprecated`**
Harmless on Prisma 6. The `prisma.seed` field is still the supported mechanism in Prisma 6; it will be migrated to `prisma.config.ts` when we move to Prisma 7.

**Dev page shows "Sign in at /dev/login or enable dev auth bypass"**
Either no session cookie, or `AUTH_SECRET` is missing/changed. Set `AUTH_SECRET` in `.env.local`, restart `npm run dev`, sign in again.

**`/dev/flow` and `/dev/work-feed` show instructions instead of redirecting**
You haven't run `npm run db:seed:activated` yet, or you didn't restart `npm run dev` after it wrote the new `STRUXIENT_DEV_FLOW_ID` to `.env.local`.

---

## Where to read next

- `docs/canon/` — locked product canon (do not drift).
- `docs/epics/` — feature-level epic specs.
- `docs/implementation/reports/` — slice-by-slice implementation history.
- `.env.example` — every supported env var with its purpose.
