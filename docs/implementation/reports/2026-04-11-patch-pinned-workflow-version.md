# After-action report: PATCH pinned workflow on draft quote version

**Date:** 2026-04-11  
**Authority:** epic 07 (version-scoped process pin), `05-compose-preview-contract`, existing compose/send pin rules.

---

## Objective

Allow **draft-only** updates to **`QuoteVersion.pinnedWorkflowVersionId`** via tenant-scoped API: pin must reference a **PUBLISHED** `WorkflowVersion` owned by the **same tenant** (via `workflowTemplate.tenantId`). Clearing the pin uses **`null`**. **Compose preview staleness** bumps after every successful change.

---

## Scope

| Item | Detail |
|------|--------|
| Service | `setPinnedWorkflowVersionForTenant` — `not_found`, `assertQuoteVersionDraft`, validate workflow, update, `bumpComposePreviewStalenessToken`. |
| Errors | `PINNED_WORKFLOW_VERSION_NOT_FOUND`, `PINNED_WORKFLOW_VERSION_NOT_PUBLISHED` → **400** via `tenant-json`. |
| HTTP | `PATCH /api/quote-versions/[quoteVersionId]` — body **must** include `pinnedWorkflowVersionId` (`string` \| `null`). |
| Copy | `src/app/page.tsx` documents the endpoint. |

---

## Files

- `src/server/slice1/mutations/set-pinned-workflow-version.ts`
- `src/app/api/quote-versions/[quoteVersionId]/route.ts`
- `src/server/slice1/errors.ts`, `src/lib/api/tenant-json.ts`
- `src/server/slice1/index.ts`, `src/app/page.tsx`
- `docs/implementation/reports/2026-04-11-patch-pinned-workflow-version.md`

---

## Validation

Run `npm run build`.

---

## Next (sequence item 2)

**SOLD_SCOPE** compose/send semantics (explicit expansion or blocking codes).
