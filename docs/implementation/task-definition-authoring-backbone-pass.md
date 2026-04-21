# Implementation Report: Task Definition Authoring Backbone

## Mission
Build the smallest durable upstream authoring slice that lets a `TaskDefinition`
declare its **completion requirements** as authored truth, so the existing
downstream chain (compose snapshot → activation freeze → runtime required-field
enforcement → completion proof → customer-facing evidence) gets stronger
authored standards to enforce.

This pass closes the explicit follow-up gap from the
**Task-Definition-Driven Form Hardening** epic (§5):
> *"Authoring UI: Global TaskDefinition authoring is not yet built; records must currently be seeded or added via API/Console."*

## Canon Posture (no drift)
- `TaskDefinition` knows; it does not place. ✓ No placement fields added.
- Authored truth (library) stays separate from runtime/execution truth.
  `RuntimeTask` snapshots are not touched by authoring; status changes on
  `TaskDefinition` do **not** retroactively mutate any activated runtime row.
- No new conditional rule engine; no form layout builder; no widget system.
  This slice authors the bounded `completionRequirementsJson` array only.
- Curated library philosophy preserved: content edits are locked to `DRAFT`;
  status transitions are explicit (`DRAFT ⇄ PUBLISHED`, `* → ARCHIVED`).
- Naming hygiene from canon `04-task-identity-and-behavior.md` respected:
  the new surfaces consistently say "task definition", never "task".

## Durable Contract Added

`TaskDefinition.completionRequirementsJson` is now a documented discriminated
union (defined in `src/lib/task-definition-authored-requirements.ts`):

```ts
type CompletionRequirement =
  | { kind: "checklist";    label: string;                 required: boolean }
  | { kind: "measurement";  label: string; unit?: string;  required: boolean }
  | { kind: "identifier";   label: string;                 required: boolean }
  | { kind: "result";       required: boolean }   // singleton (PASS/FAIL gate)
  | { kind: "note";         required: boolean }   // singleton (completion note)
  | { kind: "attachment";   required: boolean };  // singleton (photo/evidence)
```

Two **new** authored kinds (`note`, `attachment`) extend the previous comment-only
contract. They were already supported by the conditional-rule engine *as
triggered* requirements; they are now authorable as **baseline** requirements,
which the brief explicitly called for ("whether completion notes are required",
"whether photo/evidence proof is required").

The shape is parsed/normalized via `parseCompletionRequirements()` which:
- Caps array size at 50.
- Trims labels and rejects empties / duplicates within a kind.
- Enforces singleton uniqueness for `result`, `note`, `attachment`.
- Caps label length (200) and unit length (32).
- Defaults `required: false` when omitted.
- Returns structured `{ index, message }` errors that propagate to the API.

## Files Changed

### New
- `src/lib/task-definition-authored-requirements.ts` — durable TS contract + parser.
- `src/lib/task-definition-authored-requirements.test.ts` — 14 unit tests.
- `src/server/slice1/reads/task-definition-reads.ts` — list + detail read DTOs.
- `src/server/slice1/mutations/task-definition-mutations.ts` — create / update / status transitions.
- `src/app/api/task-definitions/route.ts` — `GET` (list, status filter), `POST` (create).
- `src/app/api/task-definitions/[taskDefinitionId]/route.ts` — `GET` (detail), `PATCH` (content OR status, mutually exclusive).
- `src/components/task-definitions/task-definition-editor.tsx` — narrow client editor.
- `src/app/dev/task-definitions/page.tsx` — list page.
- `src/app/dev/task-definitions/new/page.tsx` — create page.
- `src/app/dev/task-definitions/[taskDefinitionId]/page.tsx` — edit/inspect page.
- `docs/implementation/task-definition-authoring-backbone-pass.md` — this report.

### Modified
- `prisma/schema.prisma` — comment-only update on `TaskDefinition.completionRequirementsJson`
  and `RuntimeTask.completionRequirementsJson` to point at the durable TS contract and
  enumerate the six kinds (incl. new `note` and `attachment`). **No migration required**:
  the JSON column already accepts the new shape.
- `src/server/slice1/errors.ts` — added 7 typed invariant codes for authoring failures
  (`TASK_DEFINITION_NOT_FOUND`, `_TASK_KEY_INVALID`, `_DISPLAY_NAME_INVALID`,
  `_INSTRUCTIONS_TOO_LONG`, `_TASK_KEY_TAKEN`, `_NOT_DRAFT`,
  `_INVALID_STATUS_TRANSITION`, `_REQUIREMENTS_INVALID`).
- `src/lib/api/tenant-json.ts` — mapped the new invariant codes to HTTP statuses
  (404 for not-found, 409 for status/lock conflicts, 400 for shape errors).
- `src/server/slice1/mutations/runtime-task-execution.ts` — extended the existing
  `requirements` validation loop to also enforce `kind: "note"` and
  `kind: "attachment"` when authored as `required: true`. (Conditional-rule
  enforcement for these kinds is unchanged and continues to work alongside.)
- `src/app/page.tsx` — added a hub link to `/dev/task-definitions` under Discovery.

## Schema Changes
**None.** The `TaskDefinition.completionRequirementsJson` JSON column already
exists; only its documented contract was widened. This is intentionally the
narrowest durable change: existing data parses unchanged, and existing
compose/activation snapshots continue to flow without migration.

## API / Error Contract
- `GET  /api/task-definitions?limit=&status=DRAFT,PUBLISHED` — read.
- `POST /api/task-definitions` — body: `{ taskKey, displayName, instructions?, completionRequirements? }`. Always creates as `DRAFT`. office_mutate.
- `GET  /api/task-definitions/[id]` — detail with parsed `completionRequirements` array and raw conditional rules JSON.
- `PATCH /api/task-definitions/[id]`:
  - Content body (DRAFT only): `{ displayName?, instructions?, completionRequirements? }`.
  - Status body (mutually exclusive): `{ status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }`.

Errors flow through `InvariantViolationError` → `jsonResponseForCaughtError` and
return `{ error: { code, message, context } }` with appropriate HTTP statuses.
Requirement parse failures include `context.issues: { index, message }[]` so the
editor can highlight the offending row.

## UI / Editor Surface
A narrow client editor at `/dev/task-definitions/[id]` exposes:
- **Identity** — `taskKey` (immutable after create), `displayName`.
- **Instructions** — single textarea, snapshotted to `RuntimeTask.instructions` at activation.
- **Completion requirements** — bounded list with `+ kind` add buttons,
  per-row `required` checkbox, optional unit for measurements, reorder + remove.
  Singletons (`result`, `note`, `attachment`) auto-disable their `+` button once added.
- **Conditional rules** — read-only count + link to JSON. (Authoring of
  conditional rules is intentionally out of scope; see "Next slice".)
- **Status panel** — explicit transitions with idempotent server-side guards.

The editor reuses the existing `InternalBreadcrumb` /
`InternalEmptyDiscoveryState` components and Tailwind palette consistent with
the rest of the `/dev/*` testing hub.

## Validation
Two layers, both exercised by the API:
1. **Wire shape** in `route.ts` — types & required keys.
2. **Authored shape** in `parseCompletionRequirements` (called from mutations) —
   structural rules described above. Invalid arrays are rejected with
   `TASK_DEFINITION_REQUIREMENTS_INVALID` and a per-index issues list.

Editing on a `PUBLISHED` or `ARCHIVED` definition is rejected with
`TASK_DEFINITION_NOT_DRAFT` (HTTP 409). The user must explicitly transition
back to `DRAFT` to mutate content.

## Tests
- `src/lib/task-definition-authored-requirements.test.ts` — **14 unit tests** covering:
  - Empty / null / non-array roots.
  - Full-kind acceptance.
  - Trimming, dedup-per-kind, default `required`.
  - Singleton enforcement for `result | note | attachment`.
  - Unit type checks; non-object items.
  - Idempotency (`parse(parse(x).value).value === parse(x).value`).
  - 50-item cap.
- All 5 pre-existing unit test files still pass (31 tests total green).

Integration coverage of the authoring HTTP roundtrip is intentionally deferred
(matches sibling-pass cadence noted under "Next slice").

## What Is Now Possible
- Office authors can create, edit, publish, archive curated TaskDefinitions
  through `/dev/task-definitions` without touching the database or seeds.
- Each definition can durably declare:
  - Whether a **completion note** is required (new authored kind).
  - Whether **photo/evidence proof** is required (new authored kind).
  - Whether **structured completion input** is required (per-item via
    `checklist`/`measurement`/`identifier`/`result`).
- These requirements flow through the existing pipeline unchanged:
  compose-engine pulls them → activation freezes them onto `RuntimeTask` →
  runtime validator enforces them on completion → DTOs surface them to office
  & customer evidence views.

## What Remains Out of Scope
- Conditional-rule **authoring** (the engine exists and runs; only baseline
  requirements are now authorable).
- Versioning of `TaskDefinition` (no `revisionNumber`); content edits remain
  gated to `DRAFT` so PUBLISHED truth is stable.
- A custom-fields builder, dynamic widget palette, or trade-specific layout.
- Skeleton-task authoring of structured requirements.
- Bulk import / catalog promotion workflows from `QuoteLocalPacket` to library.
- Compose-side filtering of `TaskDefinition.status` (current behavior preserved).
- Office editing of activated runtime requirements (forbidden by canon).

## Drift Risks Avoided
1. **No new "tasks" model** — built entirely on the existing `TaskDefinition` row.
2. **No placement on `TaskDefinition`** — preserved the canon split between
   library meaning and packet placement.
3. **No mutation of `RuntimeTask` snapshots** — status changes on the library
   don't affect frozen activation truth.
4. **No silent shape change** — the discriminated union is explicit, validated,
   tested, and reflected in updated schema comments.
5. **No mid-stream conditional-rule edits** — kept that engine off the table
   to keep the slice narrow.
6. **No new auth/role surface** — reuses existing `office_mutate` / `read`
   capabilities.

## Recommended Next Slice
**Conditional-Rule Authoring Surface.** With the baseline requirements editor
in place, the natural next step is to expose authoring of the existing
`conditionalRulesJson` shape (trigger × required-evidence). It should reuse
the same parser-driven validation pattern, lock to DRAFT, and add a similarly
narrow editor section. After that, the most leverage comes from a small
**TaskDefinition → PacketTaskLine library picker** so packet authors can
attach to library standards directly from the catalog editor instead of
embedded payloads.
