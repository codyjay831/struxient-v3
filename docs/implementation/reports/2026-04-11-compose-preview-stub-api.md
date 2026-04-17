# After-action report: Compose preview (draft) — stub API + MANIFEST expansion

**Date:** 2026-04-11  
**Authority:** `docs/schema-slice-1/05-compose-preview-contract.md`, `docs/schema-slice-1-codepack/07-compose-engine-input-output-spec.md`, `docs/planning/01-id-spaces-and-identity-contract.md` §6, prior `getQuoteVersionScopeReadModel` + line-item APIs.

---

## 1. Objective

Add a **draft-only** **compose preview** HTTP endpoint whose **response shape** matches the slice-1 preview contract, driven by **`getQuoteVersionScopeReadModel`** plus targeted loads for workflow snapshot, **PacketTaskLine**, and **QuoteLocalPacketItem**. Implement **MANIFEST** line expansion (tier filter, quantity explosion), **deterministic `planTaskId`** from the normative ingredient tuples, **staleness echo**, and **minimal package slots** bound to workflow `nodes`.

---

## 2. Scope completed

### Read model extension

- **`quoteVersionScopeQueryArgs`** now selects **`pinnedWorkflowVersionId`** and **`composePreviewStalenessToken`** so preview and scope share one load path for version metadata used by compose.

### Service (`src/server/slice1/compose-preview/`)

- **`plan-task-id.ts`** — `computePlanTaskIdLibrary` / `computePlanTaskIdLocal` (SHA-256 of sorted JSON tuple, `pt_` prefix); **`computePackageTaskId`** (`pk_` prefix) for stub slots.
- **`build-compose-preview.ts`** — `buildComposePreviewResponse`:
  - **404 path:** no scope row for tenant (`not_found`).
  - **409 path:** `status !== DRAFT` (`not_draft`).
  - **Blocking errors (contract codes):** `NO_LINE_ITEMS`, `WORKFLOW_NOT_PINNED`, `WORKFLOW_NOT_PUBLISHED`, `SNAPSHOT_SCHEMA_INVALID`, `EXPANSION_EMPTY`, `PACKAGE_BIND_FAILED`.
  - **MANIFEST + library:** tier filter per `07`; **`targetNodeKey` / `title` / `taskKind`** from **`PacketTaskLine.embeddedPayloadJson`** (required `targetNodeKey`; title/kind fallback).
  - **MANIFEST + quote-local:** tier filter on **`QuoteLocalPacketItem`**; **`targetNodeKey`** from column; title/kind from optional **`embeddedPayloadJson`** or **`lineKey`** / **`UNKNOWN`**.
  - **Workflow:** tenant-safe **`WorkflowVersion`** load (`workflowTemplate.tenantId`); **`snapshotJson.nodes[].id`** defines bindable node ids.
  - **Staleness:** `staleness` / `stalenessToken` from **`composePreviewStalenessToken`** vs request **`clientStalenessToken`** (both `null` → **fresh**).
  - **`SOLD_SCOPE`** lines: no plan rows in this stub (commercial-only row remains in **`lineItemCount`**).
  - **`packagePreview.slots`:** one slot per plan row, **`source: "SOLD_SCOPE"`**, **`planTaskIds`** singleton (slice-1 stub; full bind/merge deferred).

### HTTP

- **`POST`** `/api/quote-versions/[quoteVersionId]/compose-preview` — JSON body optional; invalid JSON → **400**; **404** / **409** as above; **200** with `{ data, meta }` on success.
- Reuses **`requireTenantJson`** + **`jsonResponseForCaughtError`** (scope read invariant failures → existing mapping).

### Seed alignment

- **`WorkflowVersion.snapshotJson`:** `{ nodes: [{ id: "node-roof" }] }` so local + catalog **`targetNodeKey: "node-roof"`** bind.
- **`PacketTaskLine.embeddedPayloadJson`:** includes **`targetNodeKey`**, **`title`**, **`taskKind`** (replaces `{ stub: true }`).

### Product copy

- **`src/app/page.tsx`** — documents compose-preview **POST**.

### Exports

- **`src/server/slice1/index.ts`** — `buildComposePreviewResponse`, request/response types.

---

## 3. Files touched

| Path | Role |
|------|------|
| `src/server/slice1/reads/quote-version-scope.ts` | Pin + staleness on scope select |
| `src/server/slice1/compose-preview/plan-task-id.ts` | Deterministic ids |
| `src/server/slice1/compose-preview/build-compose-preview.ts` | Preview builder |
| `src/app/api/quote-versions/[quoteVersionId]/compose-preview/route.ts` | Route |
| `src/server/slice1/index.ts` | Barrel |
| `src/app/page.tsx` | Dev-facing API list |
| `prisma/seed.js` | Snapshot + catalog embedded payload |
| `docs/implementation/reports/2026-04-11-compose-preview-stub-api.md` | This report |

---

## 4. Canon / product decisions

| Decision | Rationale |
|----------|-----------|
| **`planTaskId` tuple v1** in JSON before hash | Allows future v2 without colliding with old hashes if version field bumps. |
| **409 for non-draft** | Matches other draft-only endpoints; contract body errors are for **compose** rules, not lifecycle misuse. |
| **Partial preview** on per-line failures | Other MANIFEST lines still expand; errors accumulate (**no silent drop**). |
| **Package `source: SOLD_SCOPE`** per row | Matches `07-snapshot-shape-v0` slot enum; slot merge / skeleton tasks deferred. |

---

## 5. Behavioral impact

**New:** Clients can **POST** compose-preview on a **draft** version and receive **staleness**, **errors**, **planPreview.rows**, **packagePreview.slots**, and **stats**.

**Unchanged:** No DB mutations, no **`composePreviewStalenessToken`** bump (still null unless product sets it on mutations later), no send transaction, no audit.

---

## 6. Validation

| Check | Result |
|--------|--------|
| `npm run build` | **Passed** |

**Not run:** HTTP smoke against live DB after re-seed (recommended: `npm run db:seed` then POST with `STRUXIENT_DEV_QUOTE_VERSION_ID`).

---

## 7. Gaps / follow-ups

1. **Staleness token bump** on draft mutations (`05`).
2. **`SOLD_SCOPE`** commercial lines → plan/package semantics (may differ from MANIFEST rows).
3. **Slot merging** per **`nodeId`**, **skeleton** tasks, **`SNAPSHOT_SCHEMA_INVALID`** depth (skeletonTasks, gates).
4. **Warning** paths (`MISSING_OPTIONAL_DESCRIPTION`, etc.) and **`acknowledgedWarningCodes`** enforcement.
5. **Strict published** scope revision at send (preview may still reference draft revisions per prior line-item report).

---

## 8. Risks

| Risk | Mitigation note |
|------|------------------|
| **Embedded JSON shape** | Catalog lines require **`targetNodeKey`** in **`embeddedPayloadJson`** until a stricter schema exists. |
| **Hash algorithm** | Not yet cross-language documented; tuple fields are normative per §6. |

---

## 9. Recommended next step

Wire **`composePreviewStalenessToken`** updates into **line / group / pin mutations** (opaque random, monotonic bump) and echo in **GET scope** DTO for client convenience.
