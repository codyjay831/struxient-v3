# After-action report: quote workspace head readiness / status summary

## 1. Objective

Give the **dev quote workspace** a compact, **read-first** summary for the **head** (newest) quote version so office users see:

- lifecycle **status** and identity (v number, id prefix),
- **structural** prerequisites (pin, frozen hashes, activation, proposal group count),
- **likely next steps** and route hints without embedding scope/lifecycle/freeze payloads,
- explicit **limits** (especially: send/compose validity is not fully knowable without `compose-preview` and send-time compose).

No new lifecycle rules, no weaker tenant boundary, no full preflight or editor.

## 2. Scope completed

- Pure derivation module `deriveQuoteHeadWorkspaceReadiness` keyed off the same fields already carried on `QuoteVersionHistoryItemDto` inside `GET` workspace / versions.
- Server UI block `QuoteWorkspaceHeadReadiness` on `/dev/quotes/[quoteId]`, placed **above** the compose/send panel so users read context before acting.
- **Unit tests** (Vitest) for the derivation function; **`npm run test:unit`** script + `vitest.unit.config.ts`.
- Removed the redundant mid-page “latest version + read APIs” strip (links are folded into the readiness section).

**Not done (intentionally):** workspace JSON API shape unchanged; no new server reads; no integration HTTP test (summary is derived-only).

## 3. Files changed (by purpose)

| Purpose | File |
|--------|------|
| Pure readiness model | `src/lib/workspace/derive-quote-head-workspace-readiness.ts` |
| Unit tests | `src/lib/workspace/derive-quote-head-workspace-readiness.test.ts` |
| Dev workspace UI | `src/app/dev/quotes/[quoteId]/quote-workspace-head-readiness.tsx` |
| Page wiring + dedupe | `src/app/dev/quotes/[quoteId]/page.tsx` |
| Unit test runner | `vitest.unit.config.ts` |
| NPM script | `package.json` (`test:unit`) |
| This report | `docs/implementation/reports/2026-04-12-quote-workspace-head-readiness-slice.md` |

## 4. Readiness / status decisions applied

| Decision | Rationale |
|----------|-----------|
| **Head = `versions[0]`** | Same ordering contract as `latestQuoteVersionId` (versionNumber desc). |
| **Data source = workspace row only** | Reuses existing `hasPinnedWorkflow`, `hasFrozenArtifacts`, `hasActivation`, `proposalGroupCount` from history mapper — **no** extra Prisma/API calls, no duplicate truth store. |
| **Checklist uses yes / no / n/a style** | Avoids a single misleading “Ready” badge; each row has a short note. |
| **Draft send** | Static: pin required. **Not** claimed: empty plan, compose errors, staleness — honesty note points to compose-preview + send path. |
| **Sent →** sign + read freeze/lifecycle | Matches enum order `DRAFT` → `SENT` → `SIGNED`; POST routes referenced as text only (no new buttons). |
| **Signed →** activate or runtime | Depends on `hasActivation`; copy stays factual. |
| **Links** | Scope (dev), lifecycle JSON, freeze JSON for the head id — same URLs as before, consolidated. |
| **`QuoteHeadReadinessInput` in lib** | Manual subset of history DTO; comment documents sync obligation (drift-prevention). |

## 5. Behavioral impact

- Dev workspace page shows a **“Head version — readiness”** section before workspace compose/send actions.
- Users see **why** send may be blocked (e.g. missing pin) from static fields before clicking compose.
- Users are explicitly told that **compose/send success** still requires server validation beyond this summary.

## 6. Validation performed

- `npm run test:unit` — **6 tests, all passed**.
- `npm run build` — **success**.

## 7. Known gaps / follow-ups

- **Workspace JSON** (`GET /api/quotes/:quoteId/workspace`) unchanged — API clients do not get the derived text; only dev page does. Adding an optional `headReadiness` block to the API would need a versioned contract decision.
- **Unknown `status`** strings (future enum values): derivation falls back to a generic “unknown status” next step.
- **Proposal group count** is a weak proxy for “scope exists”; called out in checklist note.

## 8. Risks / caveats

- If `QuoteVersionHistoryItemDto` gains/changes fields, **`QuoteHeadReadinessInput` must stay aligned** (documented in lib file).
- Orphan or inconsistent rows (e.g. `SENT` without frozen hashes) still render; notes may say “verify data” but cannot diagnose cause without reads.

## 9. Recommended next step

**Optional API surfacing:** add a compact `headSummary` (or reuse embedded `versions[0]` only) to `QuoteWorkspaceDto` for non-dev clients, **or** keep API minimal and add a **small** `GET …/readiness` route later if multiple consumers need the same copy — avoid duplicating derivation in two languages without tests.

**Product bottleneck after this slice:** actionable **office** shortcuts from the summary (e.g. deep-link to pin PATCH flow or a minimal pin picker) while still not building a full editor.

---

### Appendix: What is derived vs direct

| Element | Source |
|--------|--------|
| Pin / frozen / activation / group count | Direct from workspace `versions[0]` (history DTO). |
| Likely next steps / honesty notes | **Derived** in `deriveQuoteHeadWorkspaceReadiness` from `status` + those booleans/counts only. |

### Appendix: Knowable without compose

- Head **status** (DRAFT / SENT / SIGNED).
- **Pinned workflow** presence (send blocker for draft when absent).
- **Frozen artifact** hashes recorded (post-send signal).
- **Activation** presence (post-sign path).
- **Proposal group count** (structural hint only).

### Appendix: Not knowable without compose / send

- Compose validation errors, empty plan/slot sets, `WORKFLOW_NOT_PINNED` beyond pin field (pin is knowable).
- Staleness token alignment at send time.

### Appendix: Intentionally out of scope

- Embedded scope/lifecycle/freeze JSON, line-item validation UI, runtime job lists, sign/activate buttons, full preflight scoring.
