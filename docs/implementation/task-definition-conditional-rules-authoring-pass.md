# Implementation Report: TaskDefinition Conditional-Rule Authoring Surface

## Mission
Expose authoring of the **existing** conditional-rule shape on `TaskDefinition`,
DRAFT-locked, using the same parser-driven authored-truth pattern established
in the prior completion-requirements authoring slice.

This pass closes the explicit follow-up gap from the conditional-rule backbone
pass and from the prior authoring slice (which surfaced rules as a read-only
count + JSON link).

## Canon Posture (no drift)
- The runtime engine is **NOT** widened. The parser only accepts shapes the
  existing validator (`runtime-task-execution.ts:264-313`) already matches.
- No new trigger kinds, no new require kinds, no boolean operators, no nested
  rules, no expression language.
- Authored truth (`TaskDefinition.conditionalRulesJson`) stays separate from
  runtime truth (`RuntimeTask.conditionalRulesJson`). Authoring writes touch
  only the library row; activated snapshots are unchanged.
- Content edits remain locked to `DRAFT` (existing `assertEditableStatus`).
- No compose / freeze / activation changes.
- No new placement, no catalog/platform features.

## Durable Contract Added

`TaskDefinition.conditionalRulesJson` is now a documented discriminated union
defined in `src/lib/task-definition-conditional-rules.ts`:

```ts
type ConditionalRule = {
  id: string;
  trigger:
    | { kind: "result";    value: "PASS" | "FAIL" | "INCOMPLETE" }
    | { kind: "checklist"; label: string; value: "yes" | "no" | "na" };
  require:
    | { kind: "note";        message?: string }
    | { kind: "attachment";  message?: string }
    | { kind: "measurement"; label: string; message?: string }
    | { kind: "identifier";  label: string; message?: string };
};
```

Bounded enums (`PASS|FAIL|INCOMPLETE`, `yes|no|na`) match exactly what the
existing field UI emits and the existing validator matches. Anything outside
these sets is now rejected at authoring time so it cannot become a silent dead
rule after activation.

The parser also enforces:

- Cap of 25 rules per definition; message ≤ 280 chars; id ≤ 64 chars in
  `[A-Za-z0-9._\-:]`.
- Auto-assigned ids (`rule-1`, `rule-2`, …) when omitted; caller-supplied ids
  preserved if valid.
- Duplicate-id rejection.
- Duplicate `(trigger, require)` rejection — identical rules can't both fire.
- Cross-validation against the same `TaskDefinition`'s authored
  `completionRequirements`: `trigger.label` (checklist) and `require.label`
  (measurement|identifier) must reference real authored items.
- Idempotency: `parse(parse(x).value).value === parse(x).value`.

## Files Changed

### New
- `src/lib/task-definition-conditional-rules.ts` — durable TS contract + parser.
- `src/lib/task-definition-conditional-rules.test.ts` — 16 unit tests.
- `docs/implementation/task-definition-conditional-rules-authoring-pass.md` — this report.

### Modified
- `src/server/slice1/errors.ts` — added `TASK_DEFINITION_CONDITIONAL_RULES_INVALID`.
- `src/lib/api/tenant-json.ts` — mapped the new code to HTTP 400.
- `src/server/slice1/reads/task-definition-reads.ts` — `TaskDefinitionDetailDto`
  now exposes `conditionalRules: ConditionalRule[]` (parsed) alongside the
  existing `conditionalRulesRawJson` for back-compat inspection.
- `src/server/slice1/mutations/task-definition-mutations.ts`:
  - `CreateTaskDefinitionInput` and `UpdateTaskDefinitionInput` accept
    `conditionalRules?: unknown`.
  - `loadEditableTaskDefinition` now also selects existing
    `completionRequirementsJson` and `conditionalRulesJson` so update can
    reconcile against post-update truth.
  - Update path re-validates effective rules against effective requirements
    whenever **either** changes — preventing silent broken references when an
    author edits one without touching the other.
- `src/app/api/task-definitions/route.ts` and
  `src/app/api/task-definitions/[taskDefinitionId]/route.ts` — accept
  `conditionalRules` body field with `Array.isArray` shape gate.
- `src/components/task-definitions/task-definition-editor.tsx`:
  - New "Conditional rules" section, DRAFT-locked, with:
    - `+ Rule` button.
    - Bounded trigger pickers (`result|checklist` × constrained value enums).
    - Checklist-label dropdown sourced from authored requirements; warns when
      no checklist requirement exists yet.
    - Bounded require pickers (`note|attachment|measurement|identifier`);
      `measurement`/`identifier` show a label dropdown sourced from authored
      requirements with a guard message when none exist.
    - Optional message input (capped at 280 chars).
    - Per-rule inline validation issues (rendered red).
  - Initial prop replaced `conditionalRulesCount` with `conditionalRules`.
- `src/app/dev/task-definitions/new/page.tsx` and
  `src/app/dev/task-definitions/[taskDefinitionId]/page.tsx` — pass
  `conditionalRules` through to the editor.

## Schema Changes
**None.** The `conditionalRulesJson` JSON columns on both `TaskDefinition` and
`RuntimeTask` already exist and accept the contract unchanged.

## API / Error Contract
- `POST /api/task-definitions` — body now optionally includes
  `conditionalRules: ConditionalRule[]`. Cross-validated against the body's
  `completionRequirements`.
- `PATCH /api/task-definitions/[id]` — same. Status-only PATCH remains
  mutually exclusive with content keys (unchanged from prior slice).
- New error code `TASK_DEFINITION_CONDITIONAL_RULES_INVALID` → HTTP 400 with
  `{ context: { issues: { index, message }[] } }` so the editor can highlight
  individual rows.

## Editor / UX Surface
Bounded by design:

- No free-text trigger or require kinds.
- No way to type a label that doesn't exist in authored requirements; selectors
  pull from the live in-editor list.
- Pre-publish guidance shown when a rule references a missing requirement
  (e.g., `result` trigger requiring a `measurement` before any measurement is
  authored).
- Singletons / status / publish / archive / DRAFT-lock semantics inherited
  unchanged from the prior slice.

## Authored-truth vs runtime-truth boundary (verified)

| Path | Reads from | Writes to |
|---|---|---|
| Authoring (this slice) | `TaskDefinition.conditionalRulesJson` | `TaskDefinition.conditionalRulesJson` only |
| Compose | `TaskDefinition.conditionalRulesJson` (or embedded payload) | composed slot only |
| Activation | composed slot | `RuntimeTask.conditionalRulesJson` (one-shot freeze) |
| Runtime validator | `RuntimeTask.conditionalRulesJson` (frozen) | nothing — read only |

No code path in this slice writes to `RuntimeTask`, `TaskExecution`,
`CompletionProof`, `Activation`, or any flow/quote row. Library `status`
changes still do not retroactively mutate any frozen runtime snapshot.

## Tests
- `src/lib/task-definition-conditional-rules.test.ts` — **16 unit tests**:
  - Empty / null / non-array roots.
  - Each trigger × require combination accepts the canonical shape.
  - Cross-validation enabled rejects unknown checklist trigger labels and
    unknown measurement/identifier require labels.
  - Cross-validation disabled (legacy/inspection) skips the checks.
  - Unsupported trigger values (e.g., `MAYBE`, `skip`) rejected.
  - Unknown trigger/require kinds rejected.
  - `(trigger, require)` duplicate rejection.
  - Duplicate-id rejection; auto-id assignment; caller-id preservation.
  - Empty messages stripped, non-string messages rejected.
  - 25-item cap.
  - Idempotency.
- All 6 unit test files pass — **47 tests total green** (`npm run test:unit`).

Integration coverage of the authoring → activation → runtime-validator chain
is deferred (matches sibling-pass cadence; the runtime engine is unchanged).

## What Is Now Possible
- Office authors can define conditional requirements like:
  - "If overall result is FAIL, require a note (with custom message)."
  - "If overall result is FAIL, require a photo/evidence attachment."
  - "If overall result is INCOMPLETE, require a note."
  - "If checklist 'Power off' is no, require a measurement 'Voltage'."
  - "If checklist 'Pre-test passed' is na, require an attachment."
- Authored rules are cross-validated against authored requirements before save,
  so an author cannot publish a definition whose rules reference labels that
  don't exist on the same definition.
- Runtime enforcement is unchanged: the existing validator now receives a
  cleaner, well-shaped snapshot via the existing compose/activation pipeline.

## What Remains Intentionally Unsupported
- Boolean operators (AND/OR), nested rules, expression language.
- New trigger kinds (measurement-out-of-range, identifier-pattern, time-based,
  last-result, attachment-count, etc.).
- New require kinds (signature, identifier-format, second-photo, third-party
  approval, etc.).
- Office-side correction / rejection / send-back workflow.
- Field-tech UI improvements (e.g., asterisking baseline `note`/`attachment`
  requirements — that remains the carry-over follow-up from the prior slice).
- Versioning of authored rules; edits stay gated to DRAFT.
- Compose-side filtering of `TaskDefinition.status` (current behavior preserved).
- Authoring of conditional rules on Skeleton tasks.

## Drift Risks Avoided
1. **No engine widening** — parser accepts only what the runtime validator
   already matches.
2. **No silent dead rules** — bounded enums + cross-label validation reject
   shapes that could never trigger.
3. **No silent broken references** — update path re-validates rules against
   the post-update requirements whenever either changes.
4. **No runtime-truth mutation** — verified: only `TaskDefinition` rows are
   written by this slice's authoring path.
5. **No new authoring framework** — the editor reuses the existing
   parser-driven pattern from the requirements slice; no new state machine,
   no new rendering primitives.
6. **No catalog / packet creep** — no changes outside the `TaskDefinition`
   editor and its DTOs.
7. **No new auth/role surface** — reuses `office_mutate` / `read`.

## Epic completeness
Fully done for this scope. The slice delivers a complete, narrow authoring
surface for the existing conditional-rule engine. No further work in this
direction is required to unblock the next narrow epic.

## Recommended Next Slice
Carry-over from the prior slice's verification: **field-tech UI alignment for
baseline `note` / `attachment` requirements** — a one-day polish pass adding
`isAuthoredRequired(kind)` to `execution-work-item-card.tsx` and OR-ing it
with the existing `isRuleRequired(...)` checks. After that, the next narrow
authoring step is a small **TaskDefinition → PacketTaskLine library picker**
so packet authors can attach to library standards from the catalog editor.
