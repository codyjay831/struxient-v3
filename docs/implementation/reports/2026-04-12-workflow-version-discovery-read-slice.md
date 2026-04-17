# After-action report: published workflow-version discovery (read)

## 1. Objective

Provide the **first authenticated, tenant-safe read path** to discover **PUBLISHED** `WorkflowVersion` rows suitable for **quote-version pinning**, without workflow CRUD, snapshot payloads, or a heavy picker system.

Integrate minimally with the **dev quote workspace pin** surface so office users can pick from the list instead of relying only on pasted ids.

## 2. Scope completed

### API

| Route | Auth | Behavior |
|-------|------|----------|
| `GET /api/workflow-versions` | `read` | Lists **PUBLISHED** versions for `principal.tenantId` only. Query: `limit` (1–100, default 50). Response includes `data.filter: "PUBLISHED"` for explicit semantics. |
| `GET /api/workflow-versions/[workflowVersionId]` | `read` | Returns the same **compact discovery DTO** for one id if the version’s template belongs to the tenant; **404 NOT_FOUND** if not (no cross-tenant leak). **Any** workflow version status may appear on detail (e.g. to confirm a pasted id is still `DRAFT` before pin fails). |

### DTO (`WorkflowVersionDiscoveryItemDto`)

- `id`, `workflowTemplateId`, `templateDisplayName`, `templateKey`, `versionNumber`, `status`, `publishedAt` (ISO).
- **No** `snapshotJson` (not a snapshot inspection API).

### Reads module

- `src/server/slice1/reads/workflow-version-reads.ts` — `listPublishedWorkflowVersionsForTenant`, `getWorkflowVersionDiscoveryForTenant`, `clampWorkflowVersionListLimit`.
- Exported from `src/server/slice1/index.ts`.

### Workspace hints

- `QuoteWorkspaceRouteHints` extended with `workflowVersionsListGet` and `workflowVersionDetailGet` strings (static templates).

### Dev UI (`QuoteWorkspacePinWorkflow`)

- Fetches `GET /api/workflow-versions` when the head **DRAFT** pin target exists (any authenticated user with `read`).
- **Office:** `<select>` of published rows + text field + Set/Clear pin (unchanged `PATCH` quote-version).
- **Read-only:** scrollable id list + reload + `Link` to JSON (no pin controls).
- Manual id + `<details>` retained for edge cases; copy references detail GET for status shell.

### Tests (`auth-spine.integration.test.ts`)

- Unauthenticated list → **401**.
- Office list → **200**, `filter === "PUBLISHED"`, non-empty items in seeded DB, all items `PUBLISHED`.
- Read-only list → **200**.
- Tenant B GET tenant A version id → **404** + `NOT_FOUND`.
- Office GET by id → **200** shell.
- Workspace JSON → `routeHints.workflowVersionsListGet` contains `workflow-versions`.

## 3. Files changed (by purpose)

| Purpose | File |
|--------|------|
| Read model + clamp | `src/server/slice1/reads/workflow-version-reads.ts` |
| List route | `src/app/api/workflow-versions/route.ts` |
| Detail route | `src/app/api/workflow-versions/[workflowVersionId]/route.ts` |
| Barrel exports | `src/server/slice1/index.ts` |
| Workspace route hints | `src/server/slice1/reads/quote-workspace-reads.ts` |
| Pin UI integration | `src/app/dev/quotes/[quoteId]/quote-workspace-pin-workflow.tsx` |
| Integration smoke | `scripts/integration/auth-spine.integration.test.ts` |
| Report | `docs/implementation/reports/2026-04-12-workflow-version-discovery-read-slice.md` |

## 4. Discovery / read decisions applied

| Decision | Rationale |
|----------|-----------|
| **List = published-only** | Matches `setPinnedWorkflowVersionForTenant` (only `PUBLISHED` may be pinned). No `includeDraft` query flag in v1 — avoids casual widening; drafts are inspectable via **detail** GET if you know the id. |
| **Tenant via `WorkflowTemplate.tenantId`** | Same ownership chain as pin mutation. |
| **`read` capability on both GETs** | Aligns with `GET /api/flow-groups`, `GET /api/customers`; read-only users can discover ids for handoff; **mutate** remains on `PATCH` quote-version only. |
| **Order:** template `displayName` asc, `versionNumber` desc | Readable grouping without a separate template browser. |
| **Detail route** | Small addition: verify tenant + id and expose `status` without listing drafts. |
| **Pin UI** | Select + existing PATCH; no new workspace backend. |

## 5. Behavioral impact

- Office users on `/dev/quotes/[quoteId]` can **select** a published workflow version for the head draft pin.
- `GET /api/quotes/:quoteId/workspace` `routeHints` now point consumers at workflow-version discovery.
- API clients can call list/detail without workflow CRUD.

## 6. Validation performed

- `npm run test:unit` — pass (unchanged readiness tests).
- `npm run build` — pass (lint + types).
- `test:integration` — **not** run in this pass (requires live server + seed).

## 7. Known gaps / follow-ups

- **No** template-level list, search, pagination cursor, or “latest published per template” shortcut.
- **No** draft rows in list API (by design); draft-heavy workflows still need another slice or DB knowledge until a justified query flag exists.
- **No** production (non-dev) office shell beyond existing dev workspace.

## 8. Risks / caveats

- **Additive** public JSON (`filter`, new routes) — clients should tolerate unknown fields.
- Large tenants: list is **capped** at 100; may need pagination later.

## 9. Recommended next step

**Narrow filter:** optional `workflowTemplateId` query param on the list (tenant-owned template) to shrink results for one template family — still read-only, no CRUD.

**Next workspace bottleneck:** post-pin **compose/send** polish (e.g. inline compose error summary) or **sign/activate** deep links from readiness.

---

### Appendix: Fields exposed (list + detail)

Same DTO shape: id, template id/key/displayName, versionNumber, status, publishedAt. **No snapshot.**

### Appendix: Tenant scoping

- List: `where: { status: PUBLISHED, workflowTemplate: { tenantId: principal.tenantId } }`.
- Detail: `findFirst` where `id` and `workflowTemplate.tenantId === principal.tenantId`.

### Appendix: Intentionally missing

Workflow template/version CRUD, snapshot visualization, full-text search, cross-tenant admin views, runtime integration.
