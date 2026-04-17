# After-action report: quote workspace compose + send (dev slice)

## 1. Objective

Add the smallest **workspace-context** flow so an office user can, for the **current head draft** only:

1. Run **compose preview** via the existing version route.
2. See a compact operational summary (not a full payload dump).
3. **Send (freeze)** that same draft using the existing send route with an honest request body (`clientStalenessToken` from compose, fresh `sendClientRequestId`).
4. **Refresh** workspace from server truth after a successful send.

Constraints honored: **no new** compose/send APIs under workspace, **no** weakening of `office_mutate`, **no** conflating preview vs freeze semantics in copy, **no** quote editor sprawl.

## 2. Scope completed

- New client panel on **`/dev/quotes/[quoteId]`** (`QuoteWorkspaceComposeSendPanel`).
- Server page computes **latest draft target** from `versions[0]` (same ordering as `latestQuoteVersionId`) and passes `hasPinnedWorkflow` from history DTO.
- **Compose**: `POST /api/quote-versions/:quoteVersionId/compose-preview` with JSON body (`clientStalenessToken` from prior compose when re-running; `acknowledgedWarningCodes: []` placeholder).
- **Send**: `POST /api/quote-versions/:quoteVersionId/send` with `clientStalenessToken` from last compose response and `sendClientRequestId` generated per click.
- **Integration**: `READ_ONLY` **403** on compose-preview (assert `INSUFFICIENT_ROLE`), complementing existing send 403.

## 3. Files changed (by purpose)

| Purpose | File |
|--------|------|
| Workspace UI wiring | `src/app/dev/quotes/[quoteId]/page.tsx` |
| Compose + send panel (client) | `src/app/dev/quotes/[quoteId]/quote-workspace-compose-send-panel.tsx` |
| Auth smoke | `scripts/integration/auth-spine.integration.test.ts` |
| This report | `docs/implementation/reports/2026-04-12-quote-workspace-compose-send-slice.md` |

**Unchanged:** Workspace DTO / `GET /api/quotes/:quoteId/workspace`, compose-preview and send route handlers, auth helpers.

## 4. Workspace action decisions applied

| Decision | Rationale |
|----------|-----------|
| Target **only** `versions[0]` when `status === "DRAFT"` | Matches product rule: head version is newest; compose/send in this slice are draft-only. |
| If head is not `DRAFT`, show inactive explanation | Avoids ambiguous “which version?” and matches API `QUOTE_VERSION_NOT_DRAFT` for compose. |
| **Compose** allowed without pinned workflow | `buildComposePreviewResponse` does not require a pin; useful diagnostics. |
| **Send** disabled without pin | `sendQuoteVersionForTenant` returns `WORKFLOW_NOT_PINNED` when `pinnedWorkflowVersionId` is missing; UI explains instead of mystery 422. |
| **Send** disabled until a successful compose returned **and** `errors.length === 0` | Send re-runs compose in the transaction; empty preview errors are a necessary (not sufficient) condition; avoids “click send → compose_blocked” when preview already showed errors. |
| **`clientStalenessToken` for send** = `data.stalenessToken` from last compose response | Matches server expectation: token on row must match client token at send time (`SEND_STALE_CLIENT_TOKEN` if drifted). |
| **`sendClientRequestId`** unique per click | Idempotency + avoids duplicate-key collisions across versions. |
| After send **200**: clear local preview state + **`router.refresh()`** | Head may become `SENT`; history must come from server. |
| Compact summary + optional `<details>` for errors/warnings JSON | Operational clarity without giant dumps. |

## 5. Behavioral impact

- **Office** users on the dev workspace page see a second panel (below “Create next draft version”) for compose/send against the head draft.
- **Read-only** users still see the panel copy where relevant but cannot mutate; API continues to return **403** for compose-preview and send.
- **No** change to JSON workspace API or tenant boundaries.

## 6. Validation performed

- `npm run build` — **success** (compile, lint, typecheck as part of Next build).
- Integration test file updated; full `auth-spine.integration.test.ts` run was **not** executed in this pass (requires live server + seed + cookies per suite README).

## 7. Known gaps / follow-ups

- **No** automated test proving a full office **happy path** send (would need seeded draft with pin + manifest lines that yield non-empty plan/package per `send-quote-version.ts`).
- **`acknowledgedWarningCodes`** is sent as `[]` only; no UI to acknowledge warnings if the engine later requires it for downstream flows.
- **Workspace JSON / production office shell** does not embed this UI; slice is **dev workspace** only, as agreed for “minimal workspace action surface.”
- If head draft **changes** (e.g. after “create next version”), user must re-run compose; local state does not auto-sync until compose again (by design).

## 8. Risks / caveats

- **Send** can still fail with `SEND_COMPOSE_BLOCKED`, `SEND_STALE_CLIENT_TOKEN`, or empty plan/package even when preview looked clean, if data changed between preview and send (rare in dev; user re-runs compose).
- Staleness display **`fresh` / `stale`** on preview reflects request vs server token at preview time; send uses the **returned** `stalenessToken` (server value), which is the correct field for the send body.

## 9. Recommended next step

**Pin + scope ergonomics from workspace:** surface read-only **scope** / **lifecycle** summary for the head draft (links exist today; next bottleneck is often “does this draft satisfy send preconditions?” without opening multiple tabs). Alternatively, a **narrow** integration fixture that pins a workflow and asserts office **compose → send** once against seed data.

---

### Appendix: how latest draft is chosen

`getQuoteWorkspaceForTenant` returns `versions` ordered by `versionNumber` **descending**. The page sets:

- `head = ws.versions[0]`
- `latestDraftWorkspaceTarget = head.status === "DRAFT" ? { quoteVersionId, versionNumber, hasPinnedWorkflow } : null`

So the target is **exactly** the newest version row, and only when it is **DRAFT**.

### Appendix: how send input is derived

| Field | Source |
|-------|--------|
| `clientStalenessToken` | `data.stalenessToken` from the last successful `compose-preview` response (may be `null` if server token is null). |
| `sendClientRequestId` | `ws-send-${Date.now()}-${random}` generated on each send click. |

### Appendix: intentionally not handled

- Line-item / proposal-group editing, workflow pin editing, sign/activate, compare/diff, proposal builder UI, runtime/job actions.
- Warning acknowledgement UX beyond empty array.
- Product (non-dev) workspace shell for compose/send.
