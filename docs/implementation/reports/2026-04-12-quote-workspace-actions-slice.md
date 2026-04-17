# After-action report: quote workspace actions (minimal) — 2026-04-12

## 1. Objective

Make the **dev quote workspace** minimally **operational** for office users by wiring **one meaningful commercial action**—**create next draft version**—without new mutation APIs, full editor UI, or weakening auth.

## 2. Scope completed

- **`QuoteWorkspaceActions`** client block on **`/dev/quotes/[quoteId]`**:
  - When **`principalHasCapability(…, "office_mutate")`** (i.e. `OFFICE_ADMIN`): button **`POST /api/quotes/:quoteId/versions`** (existing route + `createNextQuoteVersionForTenant`), then **`router.refresh()`** so the server workspace shows new history.
  - Otherwise: copy-only explanation pointing to office login / raw POST (read-capable users still get **GET** workspace).
- **Latest-version read affordances** tightened: explicit **lifecycle** / **freeze** JSON links for the head row; **send/sign/activate** called out as **POST with body** (no fake one-click — avoids hiding lifecycle requirements).
- **Integration smoke:** **READ_ONLY** **`GET …/workspace` → 200** and **`POST …/versions` → 403** (`office_mutate` boundary).

## 3. Files changed (grouped by purpose)

| Purpose | Files |
|--------|--------|
| Workspace UI actions | `src/app/dev/quotes/[quoteId]/quote-workspace-actions.tsx` |
| Workspace page wiring | `src/app/dev/quotes/[quoteId]/page.tsx` |
| Integration | `scripts/integration/auth-spine.integration.test.ts` |
| This report | `docs/implementation/reports/2026-04-12-quote-workspace-actions-slice.md` |

## 4. Workspace action decisions applied

| Action | Implementation | Capability |
|--------|----------------|------------|
| **Create next draft version** | Reuse **`POST /api/quotes/[quoteId]/versions`** | **`office_mutate`** (unchanged server rule) |
| **Scope / lifecycle / freeze** | **GET** links only (existing routes) | **`read`** (browser navigation) |
| **Send / sign / activate** | **Not** wired as blind buttons | Remain **`office_mutate`** + request bodies per existing APIs |

**No new** workspace POST route, **no** workspace DTO mutation fields, **no** duplicate clone logic.

## 5. Behavioral impact

- Office users on **`/dev/quotes/[id]`** can clone the head version in one click and see the list refresh.
- Read-only users still see workspace context but cannot trigger clone from the UI (server would still **403** if they tried).

## 6. Validation performed

- `npm run build` — after changes.

## 7. Known gaps / follow-ups

- **No** compose-preview / send / sign / activate buttons (would need forms, idempotency keys, staleness tokens).
- **No** production product UI—dev workspace only.
- **No** optimistic concurrency UI on clone conflicts (**409** shown as message text only).

## 8. Risks / caveats

- **Double-submit** can still race (**409**); UI does not auto-retry.
- **Success message** is minimal; full validation is “refresh + inspect versions”.

## 9. Recommended next step

- **Small compose-preview + send** dev panel gated on **DRAFT** + staleness (reuses existing routes), or **product** workspace page consuming the same patterns.
