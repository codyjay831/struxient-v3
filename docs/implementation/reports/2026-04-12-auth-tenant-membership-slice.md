# After-action report: auth + tenant membership slice (2026-04-12)

## 1. Objective

Establish a **real security boundary** for the existing quote-to-execution spine so that:

- Mutations require an **authenticated** caller.
- **Tenant access** is derived from **membership** (user ↔ tenant), not from unverified headers or env as the primary path.
- **Actor identity** for send, sign, activate, and task execution comes from the **session user**, not from trusted request-body fields.

This is explicitly **not** a full IAM product: no invites, password reset UX, SSO, or permission matrix beyond a small role shell.

## 2. Scope completed

- **Design choice (pre-coding):** The repo already modeled membership as `User.tenantId` (one tenant per user row). **Option A** was used: no separate `TenantMembership` join table. A minimal **`TenantMemberRole`** enum was added on `User` for enforcement in the API layer.
- **Authentication:** **Auth.js / `next-auth` v5 (beta)** with a **Credentials** provider, **JWT sessions**, bcrypt-verified `User.passwordHash`, and composite lookup `(tenantId, email)`.
- **Authorization:** `tryGetApiPrincipal` → `requireApiPrincipal` / `requireApiPrincipalWithCapability` with three capabilities: `read`, `office_mutate`, `field_execute`.
- **All 17 existing spine-related API route handlers** (plus **`/api/auth/[...nextauth]`**) now gate on session or **dev-only bypass**; tenant id for data access is **always** the principal’s `tenantId`.
- **Mutations** updated so send/sign/activate/runtime/skeleton take **server-supplied actor ids** (from the route layer), not body actor fields.
- **Dev ergonomics:** `/dev/login` (minimal form), seed sets default password, optional **`STRUXIENT_DEV_AUTH_BYPASS`** (non-production only, DB-verified).
- **Dev Server Components** (`/dev/quote-scope/...`, `/dev/flow/...`, `/dev/work-feed/...`) use the same principal resolution as the API.
- **Schema migration** for `passwordHash`, `role`, and `TenantMemberRole` enum.
- **Build** verified (`next build` with `AUTH_SECRET` set).

## 3. Files changed (grouped by purpose)

### Prisma / seed

- `prisma/schema.prisma` — `TenantMemberRole`, `User.passwordHash`, `User.role`.
- `prisma/migrations/20260418120000_tenant_member_role_password/migration.sql` — enum + columns.
- `prisma/seed.js` — bcrypt hash for seed user (`STRUXIENT_SEED_DEV_PASSWORD` or default `struxient-dev`).
- `prisma/seed-activated-path.ts` — mutation calls updated for new parameter shapes.

### Auth core

- `src/auth.ts` — NextAuth config (Credentials, JWT callbacks).
- `src/app/api/auth/[...nextauth]/route.ts` — route handlers export.
- `src/types/next-auth.d.ts` — session/JWT typing.
- `src/lib/auth/api-principal.ts` — principal resolution, capabilities, JSON meta helper.
- `src/components/auth-session-provider.tsx` — client `SessionProvider` wrapper.
- `src/app/layout.tsx` — wraps app with `AuthSessionProvider`.

### Tenant resolution (legacy documentation)

- `src/lib/auth/resolve-tenant-id.ts` — comments updated: **legacy**; spine uses `tryGetApiPrincipal`.
- `src/lib/api/tenant-json.ts` — **unchanged** behavior; still available for any future unauthenticated routes (none on the spine now).

### API routes (session + membership + role)

All under `src/app/api/` for: `flows`, `jobs`, `quote-versions` (scope, lifecycle, freeze, compose-preview, send, sign, activate, PATCH shell, line-items, proposal-groups), `runtime-tasks` start/complete, skeleton start/complete.

### Slice1 mutations

- `src/server/slice1/mutations/send-quote-version.ts`
- `src/server/slice1/mutations/sign-quote-version.ts`
- `src/server/slice1/mutations/activate-quote-version.ts`
- `src/server/slice1/mutations/runtime-task-execution.ts`
- `src/server/slice1/mutations/skeleton-task-execution.ts`
- `src/server/slice1/index.ts` — export cleanup (removed obsolete request body types).

### Dev UI / marketing copy

- `src/app/dev/login/*` — minimal credentials form.
- `src/app/dev/work-feed/[flowId]/*` — session cookies, no `actorUserId` in POST body; role-aware button disable.
- `src/app/dev/work-feed/page.tsx`, `src/app/dev/flow/page.tsx`, `src/app/dev/quote-scope/page.tsx` — instructions.
- `src/app/dev/flow/[flowId]/page.tsx`, `src/app/dev/quote-scope/[quoteVersionId]/page.tsx` — principal-based tenant for direct DB reads.
- `src/app/page.tsx` — auth-oriented home copy + `/dev/login` link.

### Dependencies / env template

- `package.json` / lockfile — `next-auth@5.0.0-beta.30`, `bcryptjs`, `@types/bcryptjs`.
- `.env.example` — `AUTH_SECRET`, `STRUXIENT_SEED_DEV_PASSWORD`, `STRUXIENT_DEV_AUTH_BYPASS`, clarified legacy header note.

## 4. Auth / membership decisions applied

| Decision | Rationale |
|----------|-----------|
| **Membership = `User.tenantId`** | Already canonical in schema; avoids a large migration and duplicate truth. Multi-tenant-per-user can be a later `UserTenant` table if product requires it. |
| **Credentials + JWT** | Smallest production-compatible App Router path without new infrastructure; no separate session table in this slice. |
| **Login requires `tenantId` + `email` + `password`** | Emails are unique per tenant, not globally; disambiguation is explicit. |
| **Roles: `OFFICE_ADMIN`, `FIELD_WORKER`, `READ_ONLY`** | Mapped to `office_mutate` (draft/send/sign/activate/lines/pin/compose-preview POST), `field_execute` (runtime/skeleton execution POST), `read` (all GET spine routes). |
| **Dev bypass** | `STRUXIENT_DEV_AUTH_BYPASS=true` only when `NODE_ENV !== 'production'`, and only after verifying `STRUXIENT_DEV_USER_ID` exists in `STRUXIENT_DEV_TENANT_ID`. |
| **Production default** | Bypass **disabled**; unauthenticated API calls return **401** `AUTHENTICATION_REQUIRED`. |
| **Wrong-tenant / missing resource** | Existing pattern preserved: queries scoped by principal `tenantId` → **404** `NOT_FOUND` where applicable (no cross-tenant id leak). |

## 5. Behavioral impact

- **Breaking for API clients:** Spine routes **no longer** accept `x-struxient-tenant-id` / `STRUXIENT_DEV_TENANT_ID` as the tenant selector. Clients must send **session cookies** (browser) or use **dev bypass** (local scripts only).
- **Breaking request bodies:** Removed **trusted** fields: `sentByUserId`, `recordedByUserId`, `activatedByUserId`, `actorUserId` on task routes. Optional **`notes`** remains on execution POSTs.
- **Response meta:** `meta.tenantResolution` replaced with `meta.auth.source` values `session` \| `dev_bypass`.
- **Seed:** New users get `passwordHash`; re-seed or migrate existing DBs with `prisma migrate deploy` then seed as needed.
- **READ_ONLY users:** Can use read APIs and dev read pages; execution buttons in work-feed are disabled (API would return **403** `INSUFFICIENT_ROLE`).

## 6. Validation performed

- `npx prisma validate` — pass.
- `npm run build` — pass (with `AUTH_SECRET` set in the shell; project `.env.local` may also supply it).
- **Not run in this environment:** `prisma migrate deploy` against a live Postgres instance; `curl` smoke with real DB — operator should run migrate + seed locally.

### Suggested local smoke

1. `npx prisma migrate dev` (or `deploy`) — applies `20260418120000_tenant_member_role_password`.
2. `npm run db:seed` — creates tenant/user with password `struxient-dev` unless overridden.
3. Set `AUTH_SECRET` in `.env.local`, restart `npm run dev`.
4. Open `/dev/login`, sign in with tenant id from `.env.local`, `seed@example.com`, password.
5. `GET /api/quote-versions/<id>/scope` with browser (same origin) or cookie jar — **200**.
6. Optional: `STRUXIENT_DEV_AUTH_BYPASS=true` + tenant/user ids — API works without cookies **only in non-production**.

## 7. Known gaps / follow-ups

- **No password change / reset / invite** flows.
- **No org switcher** — one session ↔ one `(userId, tenantId)` from login.
- **JWT role staleness** — role changes in DB do not update until re-login (JWT session).
- **`requireTenantJson` / header path** — still in codebase for **legacy** use; **no spine route** uses it anymore.
- **Tests** — still no automated integration tests for auth or tenant isolation.
- **Customer portal / external API keys** — out of scope.
- **Multi-tenant users** — would need a membership join model and login UX change.

## 8. Risks / caveats

- **Credentials in production** require TLS, strong `AUTH_SECRET`, and eventually rate limiting / account lockout (not implemented).
- **Dev bypass** is powerful; it is **impossible by default in production** but must stay **documented** so it is never copied into prod envs by mistake.
- **NextAuth beta** — pin version consciously; watch for stable v5 release notes.

## 9. Recommended next step

1. Run **migration + re-seed** in every environment that uses the spine.
2. Add a **minimal integration smoke** (e.g. sign-in + one GET + one POST) so auth regressions are caught.
3. **Entity CRUD** for Quote / Customer / FlowGroup / User (post-auth), so new data is created through authenticated APIs rather than seed-only.

---

### Appendix: routes now protected (summary)

| Capability | Routes |
|------------|--------|
| `read` | `GET` …/scope, lifecycle, freeze, flows, jobs |
| `office_mutate` | `POST` compose-preview, send, sign, activate; `PATCH` quote version pin; line-items POST/PATCH/DELETE; proposal-group PATCH |
| `field_execute` | `POST` runtime-tasks start/complete; skeleton start/complete |

**Auth route:** `GET/POST /api/auth/[...nextauth]`.

### Appendix: actor fields

| Field | Status |
|-------|--------|
| `sentByUserId` (body) | **Removed** — use session user id in `sendQuoteVersionForTenant` params |
| `recordedByUserId` (body) | **Removed** |
| `activatedByUserId` (body) | **Removed** |
| `actorUserId` (body) on tasks | **Removed** — optional `notes` only |

Internal DTOs may still **return** `actorUserId` on execution responses (historical audit shape).

### Appendix: dev escape hatch

- **`STRUXIENT_DEV_AUTH_BYPASS=true`** — only when **`NODE_ENV !== 'production'`**, plus **`STRUXIENT_DEV_TENANT_ID`** and **`STRUXIENT_DEV_USER_ID`**, validated against the database.
