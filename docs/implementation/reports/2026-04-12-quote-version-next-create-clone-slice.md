# After-action report: next quote-version create (clone) — 2026-04-12

## 1. Objective

Provide an **authenticated, office-only** path to create **`QuoteVersion` N+1** as **`DRAFT`** by **cloning draft-authoring structure** from the **current head** (max `versionNumber`), without mutating prior versions or dragging **send/freeze/sign/activation** artifacts into the new row.

## 2. Scope completed

- **`POST /api/quotes/[quoteId]/versions`** — `requireApiPrincipalWithCapability("office_mutate")`; tenant from principal; **404** if quote not in tenant; **422** `NO_SOURCE_VERSION` if no versions exist; **409** `VERSION_NUMBER_CONFLICT` on unique collision (handled in mutation).
- **Single Prisma `$transaction`** for: resolve quote + actor → aggregate **max `versionNumber`** → load **source** at that number → create new version → clone **ProposalGroup**s → **QuoteLocalPacket** (+ **QuoteLocalPacketItem**) → **QuoteLineItem**s with remapped FKs.
- **Response DTO** `CreateNextQuoteVersionSuccessDto`: `quoteVersionId`, `versionNumber`, `proposalGroups[]` `{ id, name, sortOrder }`.
- **Slice1** mutation `createNextQuoteVersionForTenant` + exports.
- **Dev hint** on `/dev/quotes` for the POST path.
- **Integration smoke:** unauthenticated **401**; READ_ONLY **403**; office clone → history shows v2 + **v1 id unchanged**; tenant B **404** on POST.

## 3. Files changed (grouped by purpose)

| Purpose | Files |
|--------|--------|
| Mutation | `src/server/slice1/mutations/create-next-quote-version.ts` |
| Slice1 exports | `src/server/slice1/index.ts` |
| API | `src/app/api/quotes/[quoteId]/versions/route.ts` (`POST` added) |
| Dev copy | `src/app/dev/quotes/page.tsx` |
| Integration | `scripts/integration/auth-spine.integration.test.ts` |
| This report | `docs/implementation/reports/2026-04-12-quote-version-next-create-clone-slice.md` |

## 4. Cloning / versioning decisions applied

| Topic | Decision |
|--------|-----------|
| **Template (“head”)** | **`QuoteVersion` with maximum `versionNumber`** for the quote (same aggregate as history list’s first row when history is `versionNumber desc`). |
| **Next number** | **`max(versionNumber) + 1`**, enforced by **`@@unique([quoteId, versionNumber])`**; races → **`version_number_conflict`** / **409**. |
| **New row status** | Always **`DRAFT`**. |
| **Copied onto new version** | **`title`**, **`pinnedWorkflowVersionId`** (continues editable compose/pin semantics when already set). |
| **Cloned children (new ids, new `quoteVersionId`)** | **`ProposalGroup`** (name, sortOrder), **`QuoteLocalPacket`** (+ items), **`QuoteLineItem`** (commercial fields including **`scopePacketRevisionId`**, **`quoteLocalPacketId`** remapped to cloned packets). |
| **Quote-local packet promotion** | **Reset** to **`promotionStatus: NONE`**, **`promotedScopePacketId: null`** on clones (no inherited promotion state). |
| **`createdById` on new packets** | **Actor** (authenticated office user), not copied from source. |
| **Not copied / left default-null** | **`sentAt` / `sentBy` / `sendClientRequestId`**, compose/freeze/snapshot fields, **`signedAt` / `signedBy`**, **`QuoteSignature`**, **`Flow`**, **`Activation`**, **`RuntimeTask`**, **`AuditEvent`**, **`PreJobTask`**. |
| **Prior versions** | **No updates** to existing rows; clone **inserts only**. |

## 5. Behavioral impact

- After POST, **`GET /api/quotes/{quoteId}/versions`** shows an additional row; older **`quoteVersionId`** values remain valid for **scope / lifecycle / freeze** on their respective versions.
- **Pinned workflow** on the clone matches the head at clone time; **staleness / freeze hashes** are absent so clients should re-run compose/freeze flows as today’s rules require.

## 6. Validation performed

- `npm run build` — run after implementation.

## 7. Known gaps / follow-ups

- **No selective clone** (choose source version other than head).
- **No diff/compare**, **supersede**, or **void** semantics.
- **No UI** beyond dev copy text.
- **Concurrent duplicate** handling returns **409**; clients must retry.

## 8. Risks / caveats

- Cloning from a **SIGNED/SENT** head still produces a **clean DRAFT** shell but **copies line/packet structure** — operators must understand they are forking commercial content, not replaying lifecycle.
- **Invalid `pinnedWorkflowVersionId`** on head (e.g. deleted workflow) can cause **FK failure** on create — not special-cased in this slice.

## 9. Recommended next step

- **Explicit “clone from version N”** (office-only) with guardrails, or **quote-version summary `GET`** for a single id aligned with history DTOs.
