# After-action report: Next.js App Router + tenant-bound quote scope read

**Date:** 2026-04-11  
**Depends on:** slice-1 schema, service invariants, `getQuoteVersionScopeReadModel`

---

## 1. Objective

Wire **Next.js App Router** with **Prisma** on the server, expose the first **HTTP read path** for quote-version scope behind an explicit **tenant resolution** contract (no fake “global” auth), and keep responses on a **stable DTO** (no raw Prisma leakage).

---

## 2. Scope completed

- **Next.js 15** + **React 19** + **Tailwind 3** (dark-first: `class="dark"` on `<html>`, zinc palette).
- **`next.config.ts`**: `serverExternalPackages: ["@prisma/client"]` for correct server bundling.
- **Tenant resolution** (`src/lib/auth/resolve-tenant-id.ts`):
  - **API routes:** `STRUXIENT_DEV_TENANT_ID` **or** `x-struxient-tenant-id` in non-production; in production, header allowed only if `STRUXIENT_ALLOW_TENANT_HEADER=true` (explicit escape hatch).
  - **Server Components (dev page):** `STRUXIENT_DEV_TENANT_ID` only (headers not used — avoids encouraging header-based identity in RSC).
- **GET** ` /api/quote-versions/[quoteVersionId]/scope` — JSON `{ data, meta }` or structured `{ error }` with **401 / 403 / 404 / 422**.
- **Dev UI:** `/dev/quote-scope/[quoteVersionId]` renders DTO JSON; helper page at `/dev/quote-scope`.
- **DTO mapper** `src/lib/quote-version-scope-dto.ts` — `toQuoteVersionScopeApiDto` trims nested relations to a stable API shape.
- **Seed ergonomics:** `prisma/seed.js` logs `STRUXIENT_DEV_TENANT_ID` and example `quoteVersionId` after success.
- **Tooling:** `npm run dev`, `build`, `start`, `lint`; `.gitignore` includes `.next/`, `out/`.

---

## 3. Files changed (grouped)

| Area | Paths |
|------|--------|
| Next / TS | `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `postcss.config.mjs`, `tailwind.config.ts`, `eslint.config.mjs` |
| App | `src/app/layout.tsx`, `globals.css`, `page.tsx`, `dev/quote-scope/**`, `api/quote-versions/[quoteVersionId]/scope/route.ts` |
| Lib | `src/lib/auth/resolve-tenant-id.ts`, `src/lib/quote-version-scope-dto.ts` |
| Package | `package.json`, `package-lock.json`, `.gitignore`, `.env.example` |
| Seed | `prisma/seed.js` |
| Report | `docs/implementation/reports/2026-04-11-nextjs-quote-scope-read-wireup.md` |

---

## 4. Canon / safety decisions

- **Tenant never inferred from URL alone** — version id is not a capability; lookup always filters `quote.tenantId`.
- **Production defaults deny header-based tenant** unless explicit env opt-in (reduces “id guessing” in prod).
- **422** for `InvariantViolationError` on read (data corruption / partial graph), not silent success.
- **Snapshots** still excluded from this read (unchanged from slice-1 read contract).

---

## 5. Validation performed

| Command | Result |
|---------|--------|
| `npm run build` | **Passed** (compile, typecheck, lint as part of Next build) |

**Not run:** `npm run dev` long-running smoke (optional local).

---

## 6. Known gaps / follow-ups

1. **Real staff auth** — replace env/header with session → `tenantId` (+ membership roles).
2. **Rate limiting / API auth** — protect `/api/*` when exposed publicly.
3. **Remove or gate `/dev/*`** in production (middleware, env, or deploy config).
4. **Mutation routes** — draft/sent guards + reuse slice-1 `assert*` on writes.
5. **`npm run typecheck`** still runs plain `tsc --noEmit`; may drift from Next’s type roots — prefer `next build` for CI or align `tsconfig` with `.next/types`.

---

## 7. Risks / caveats

| Risk | Note |
|------|------|
| **Dev tenant in .env** | Same machine compromise = wrong tenant if env points at prod — use local DB only for dev. |
| **`STRUXIENT_ALLOW_TENANT_HEADER`** | Dangerous in production; documented as explicit escape hatch only. |
| **Seed re-run** | Creates duplicate tenant/quote if run twice on same DB — seed is smoke, not idempotent migration. |

---

## 8. Recommended next step

Add **middleware or env guard** to **404 all `/dev/*`** when `NODE_ENV=production`, then implement **first draft mutation** (e.g. add `ProposalGroup`) with `QuoteVersion.status === DRAFT` assertion and tenant-scoped transaction.
