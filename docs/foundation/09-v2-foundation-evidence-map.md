# v2 foundation evidence map — links for v3 work

This index points to **reverse-engineered docs** in `Struxient_v2` and **v3 research** outputs. Use it to trace claims back to evidence without re-auditing the entire codebase.

**Repository:** Struxient_v2 (paths below are relative to repo root).

---

## A. Reverse-engineering set (`docs/reverse-engineering/2026-04-10-struxient-v2/`)

| Doc | Focus |
|-----|--------|
| `00-synthesis-struxient-v2-to-v3.md` | Capstone: strengths, risks, MVP inference, open questions |
| `01-product-surface-inventory.md` | Surfaces (APIs/UI scope) |
| `02-domain-model-inventory.md` | Prisma entities, blurry boundaries |
| `03-quote-to-execution-breakdown.md` | Send, sign, activate, packaged path |
| `04-task-system-deep-dive.md` | Task taxonomy, eligibility, overload |
| `05-node-stage-workflow-deep-dive.md` | Nodes, gates, detours, fan-out |
| `06-job-progression-status-logic.md` | No Job status enum, dual progress |
| `07-readiness-blockers-holds-detours.md` | Holds, payment bridge, detours |
| `08-scheduling-time-horizon.md` | ScheduleBlock, eligibility gap |
| `09-role-projection-matrix.md` | Roles, capabilities |
| `10-automation-ai-inventory.md` | AI/deterministic automation inventory |
| `11-pain-points-landmines-coupling.md` | Blunt coupling list |
| `12-preserve-redesign-drop-matrix.md` | Preserve/redesign/drop recommendations |

---

## B. v3 research (`docs/v3-research/`)

| Doc | Focus |
|-----|--------|
| `task-vs-packet-audit.md` | Tasks vs packets vs line items vs activation |
| `reuse-layer-matrix.md` | Comparative matrix across reuse layers |
| `preliminary-v3-direction-notes.md` | Short directional note |
| `v2-evidence-index-task-packet-quote.md` | Code path index (Prisma, libs, routes) |

---

## C. Canon / architecture (optional cross-read — design intent)

Not code truth alone; use for **stated intent** and **drift** checks:

- `docs/canon/quote/10_quote_execution_bridge_contract.md`
- `docs/architecture/02_activation-pipeline.md`
- `docs/architecture/zipper_model_investigation_2026-03-06.md`
- `docs/canon/flowspec/26_runtime_tasks_contract_v0.md`

---

## D. Key code paths (from evidence index + reverse-engineering)

| Topic | Path |
|-------|------|
| Send / freeze | `src/app/api/quotes/[quoteId]/send/route.ts` |
| Plan compute | `src/lib/quote/bundles.ts` — `computeGeneratedPlan`, `mergeDraftPlanOverlay` |
| Execution package | `src/lib/quote/composer.ts` |
| Types | `src/lib/quote/types.ts` |
| Activate | `src/app/api/quotes/[quoteId]/activate/route.ts`, `src/lib/quote/activate-job-from-quote-version.ts`, `src/lib/quote/activation-from-package.ts` |
| Packet line resolution | `src/lib/catalog/packet-line-resolver.ts` |
| Runtime task creation | `src/lib/flowspec/runtime-task-from-scope.ts` |
| Effective snapshot | `src/lib/flowspec/effective-snapshot.ts` |
| Derived/actionability | `src/lib/flowspec/derived.ts` |
| Start eligibility | `src/lib/flowspec/task-start-eligibility.ts` |
| Payment bridge | `src/lib/holds/legacy-payment-bridge.ts` |
| Job progress | `src/lib/job/progress.ts` |
| Schema | `prisma/schema.prisma` |
| Ordering assistant | `src/lib/quote/ordering-assistant/*` |
| Catalog package AI | `src/lib/catalog/ai-package-draft.ts`, `src/app/api/catalog/package-ai-draft/route.ts` |
| Assembly quote integration | `src/lib/catalog/assembly-quote-integration.ts` |

---

## E. Contradiction hotspots to re-verify when canonizing

1. **Comments** (“single execution system”) vs **JobTask** / **legacy-payment-bridge** still in use.  
2. **`autoCreateJobOnSignature`** vs explicit **activation** — sequencing.  
3. **InspectionCheckpoint** vs FlowSpec completion.  
4. **Scheduling** authority vs **start eligibility** deferral.

---

## F. Struxient_v3 foundation outputs (this folder)

| File | Role |
|------|------|
| `01-v3-foundation-synthesis.md` | Executive synthesis + verdict |
| `02-end-to-end-structure.md` | Backbone flow |
| `03-object-boundaries.md` | Object ownership |
| `04-save-redesign-drop-foundation-matrix.md` | Save/redesign/drop |
| `05-trade-first-foundation.md` | Trade-first fit |
| `06-flowspec-role.md` | FlowSpec repositioning |
| `07-task-packet-node-relationship.md` | Core relationships |
| `08-time-cost-learning-foundation.md` | Time/cost/learning |
| `09-v2-foundation-evidence-map.md` | This index |
| `10-open-canon-questions.md` | Open decisions |
