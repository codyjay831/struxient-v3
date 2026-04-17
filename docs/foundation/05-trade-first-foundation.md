# Trade-first foundation — why this v2-derived structure fits v3

**Labels:** **Proven from code** · **Strong inference** · **Working v3 interpretation** · **Unclear / needs canon decision**

**Locked assumptions:** Trade-first; line-item-fronted; packet-driven; workflow = process skeleton; quote-selected scope determines work.

---

## 1. How saved v2 foundation supports trade-first over full-home-first

### 1.1 Selling unit matches trade reality

**Proven from code:** Contractors add quote lines from **catalog bundles** (`bundleKey` + tier), not from raw task libraries in the primary quote dialog.

**Working v3 interpretation:** Trades sell **scoped packages** (“panel upgrade + MPU tier,” “maintenance visit + checklist tier”) — **line item + packet** matches **estimate → proposal → change order** habits better than a flat universal task graph.

### 1.2 Reuse lands where estimators reuse

**Proven from code:** `BundleTemplate` is keyed **`bundleKey` × `tier`** per company; `TaskDefinition` factors repeated **instructions/inputs** across packets.

**Working v3 interpretation:** **Reuse** is **packet-level** (SKUs) and **definition-level** (shared work intelligence) — **not** “reuse the whole home workflow.” Full-home would tempt **one giant template**; trade-first needs **composable packets** on **fewer line items**.

### 1.3 Process skeleton supports inspection-heavy trades without owning scope

**Proven from code:** Nodes, gates, detours, completion rules — **field-service** shaped (`05`, `07`).

**Working v3 interpretation:** Electrical/solar/HVAC share **phases** (mobilize, rough, inspect, finish, closeout) as **process**, while **what** is installed varies by **packet**. **FlowSpec** carries **phase physics**; **packets** carry **SKU scope**.

### 1.4 Speed: freeze + activate pipeline

**Proven from code:** Send composes **execution package** in one pipeline; activation is transactional (`03`).

**Working v3 interpretation:** **No double entry** between “what we quoted” and “what the crew sees” if **freeze** discipline holds — aligns with market expectation **without** naming competitors.

### 1.5 Mobile continuity

**Strong inference:** Field truth is **FlowSpec execution** + merged **runtime tasks**; workstation/APIs project actionable tasks (`04`, product surface doc).

**Working v3 interpretation:** Crews need **node-organized** checklists tied to **sold scope** — the v2 split (**manifest runtime tasks** vs **skeleton tasks**) must be **documented in UX** so mobile users aren’t lost.

---

## 2. v2 pieces especially strong for specific trade patterns

| Trade pattern | v2 mechanism | Why it fits |
|--------------|--------------|-------------|
| **Electrical** | Tiers (`MICRO`/`STANDARD`/`FULL`), multiple checkpoints | Same SKU family, different depth of work — **Proven** bundle tier model. |
| **Solar / battery / service upgrade** | **Assemblies** (rule-generated tasks + provenance) | **Variable** scope from **inputs** without abandoning packets — **Proven** assembly integration (evaluate as **secondary** path vs default packet quoting). |
| **Recurring trade packets** | `BundleTemplate` catalog | **Copy/paste business** (maintenance contracts) maps to **reusable packets**. |
| **Inspection / correction loops** | `DetourRecord` + blocking semantics | **Fail inspection → loop back** without republishing workflow — **Proven** `derived.ts`. |
| **Office-to-field handoff** | Send freeze + activation + `InstallItem` optional link from line | **Commercial freeze** then **operational instantiate** — **Proven** activation path. |
| **Quote-to-execution speed** | Single zipper + idempotent activation | Reduces **reinterpretation** at job start — **Proven** hot path. |

---

## 3. v2 pieces that look like full-home / general-builder drift

**Strong inference** (from synthesis + pain doc — not a competitor comparison):

- **Per-job workflow graph authoring** as default — v3 **should not** center this for trade MVP (**locked assumption 7–8**). v2 **supports** rich authoring (`Workflow`, builder) which is **necessary for template creation** but **dangerous** as the **day-to-day** estimator path.
- **Fan-out multi-workflow** complexity — powerful for **multi-discipline home** jobs; **trade-first** may defer (**12 matrix: needs review**).
- **Cross-flow dependencies** — valuable when **sales + execution** flows coexist; for **single-trade MVP**, treat as **advanced** unless canon requires **sales overlay** parity.
- **Massive snapshot JSON** carrying **everything** — smells like **integrator / platform** growth pain; trade-first still benefits from **separation of concerns** in v3 storage design.

---

## 4. Trade-first prioritization table (foundation level)

| Capability | v3 priority (foundation) | Notes |
|------------|-------------------------|--------|
| Line item + packet quoting | **P0** | Core spine in v2. |
| Send freeze + execution package | **P0** | Integrity spine. |
| Activation → Flow + runtime manifest | **P0** | No double entry. |
| Task definition library in packets | **P1** | Already in v2; sharpens reuse. |
| Detours / holds / payment start gates | **P1** | Real operations; **redesign** payment bridge. |
| Scheduling | **P1/P2** | **Only** with explicit authority policy. |
| Assemblies | **P2** | Strong for solar/upgrades; not every trade. |
| Cost actuals + learning | **P2+** | Append-only **CostEvent** is sound; learning is maturity. |
| Fan-out / cross-flow | **P2+** | Scope carefully for trade MVP. |
| AI drafting | **Optional** | **Evaluate** per GTM; not structural dependency. |

---

## See also

- `02-end-to-end-structure.md`  
- `06-flowspec-role.md`  
- `07-task-packet-node-relationship.md`
