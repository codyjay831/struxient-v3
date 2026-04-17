# After-action: first office quote workspace UI pass — 2026-04-12

## 1. Objective

Turn **`/dev/quotes/[quoteId]`** from a flat stack of helper panels into a **single coherent office workspace surface**: clearer hierarchy, workflow-oriented grouping, compact status presentation, and **demoted** raw JSON — without changing **server reads**, **API routes**, or **client mutation behavior** inside the existing workspace panels.

## 2. Scope completed

- **Page structure** (`page.tsx`): office-oriented **header** (title, short purpose copy, nav), then ordered regions: **shell summary** → **head readiness** (unchanged component) → **numbered office workflow** (five steps) → **execution bridge** → **version history table** → **collapsible API & debug**.
- **New presentational server components** (Tailwind only; no new data fetches):
  - **`QuoteWorkspaceShellSummary`**: quote number + internal id, **head version** with **status badge**, customer / flow group as definition lists with **list + API** links (`/dev/customers`, `/dev/flow-groups`, JSON detail routes).
  - **`QuoteWorkspacePipelineStep`**: step number + title + optional hint wrapping each existing action panel.
  - **`QuoteWorkspaceVersionStatusBadge`**: compact pill for **`DRAFT` / `SENT` / `SIGNED`** (Prisma enum).
  - **`QuoteWorkspaceVersionHistory`**: **table** layout (version, status badge, flags summary, **Open scope** primary link, **API** disclosure per row with full id + lifecycle/freeze JSON links).
- **No changes** to `QuoteWorkspaceActions`, pin, compose/send, sign, activate, head readiness, or execution bridge **logic** or **fetch URLs** — capability gating remains **`office_mutate`** where it already was.

## 3. Files changed (grouped by purpose)

| Purpose | Files |
|--------|--------|
| Workspace layout & composition | `src/app/dev/quotes/[quoteId]/page.tsx` |
| Shell / context summary | `src/app/dev/quotes/[quoteId]/quote-workspace-shell-summary.tsx` |
| Workflow step chrome | `src/app/dev/quotes/[quoteId]/quote-workspace-pipeline-step.tsx` |
| Status badge | `src/app/dev/quotes/[quoteId]/quote-workspace-version-status-badge.tsx` |
| Version history table | `src/app/dev/quotes/[quoteId]/quote-workspace-version-history.tsx` |
| Report | `docs/implementation/reports/2026-04-12-quote-workspace-office-ui-pass.md` |

## 4. UI / usability decisions applied

| Topic | Decision |
|--------|-----------|
| **Single surface** | All lifecycle affordances stay on **one** route; max width increased slightly (`max-w-4xl`) for table readability. |
| **Information hierarchy** | **Shell first** (what quote, who, which flow group, head status), then **readiness** (honest checklist unchanged), then **workflow** with **explicit step order** matching office mental model. |
| **Workflow vs toolbox** | Steps **1–5** label **draft clone → pin → compose/send → sign → activate**; each reuses the **same** child panel as before. |
| **Raw JSON** | Top-of-page **Workspace / Versions JSON** links removed from default view; moved to **`details` → API & debug** at the bottom. Per-version JSON only inside row **API** disclosure. |
| **Primary navigation** | Version table promotes **Open scope**; lifecycle/freeze remain secondary. |
| **Customer / flow group** | Prefer **dev list** links for human browsing; **API detail** as secondary underlined text (not the only affordance). |

## 5. Behavioral impact

- **Auth / capabilities**: unchanged — panels still enforce **`canOfficeMutate`** the same way; read-only users get the same server-derived copy and disabled controls.
- **Data truth**: still **`getQuoteWorkspaceForTenant`** + existing derive helpers + lifecycle read for execution bridge; no new client caches or optimistic state.
- **URLs**: all mutation and GET targets inside child components are **unchanged**.

## 6. Validation performed

- **`npm run build`** — completed successfully (compile, lint, typecheck as part of Next build).

## 7. Known gaps / follow-ups

- **Individual panels** (pin, compose, sign, activate) still contain **route-oriented copy** (`POST …`, `office_mutate` in monospace) — appropriate for honesty but still somewhat **dev-flavored**; a later pass could tighten copy without touching fetch code.
- **No shadcn** in repo — styling is **Tailwind-only**; if the project adopts `components/ui` later, cards/badges could be swapped for shared primitives.
- **Version table** `details` in a cell can grow tall on small screens — acceptable for this slice; responsive **card stack** could follow if needed.
- **Quote list** (`/dev/quotes`) and other dev surfaces were **not** redesigned (explicitly out of scope).

## 8. Risks / caveats

- **Layout-only refactor** risk is low; regression risk is mostly **visual** (spacing, link discovery). Functional risk minimal because mutation components were not edited.
- **Route vs shell quote id** warning remains only if ids ever diverge (defensive).

## 9. Recommended next step

- **Light copy pass** inside each workspace panel: shorter office labels, route names moved into a shared **“Technical”** `<details>` per panel — keeps canon while further reducing helper tone.
- **Quote list page** alignment: same shell vocabulary (quote number, head status badge) for parity when picking a quote.

## What remains intentionally out of scope

- Full quote **editor**, line-item UI, compare/diff, customer portal, field dashboards, analytics, global navigation shell, and redesign of non-workspace dev routes.
