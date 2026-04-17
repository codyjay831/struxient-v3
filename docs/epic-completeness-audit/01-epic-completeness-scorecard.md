# Epic completeness scorecard

**Standard:** `01-leads-epic.md` defines the quality bar. Each epic is graded against the 27-section standard in `00-epic-writing-standard.md` and measured by whether a builder could ship a **functioning feature** from the epic alone, without inventing behavior.

**Grades:**
- **A** — Implementation-complete. Builder can implement without inventing obvious behavior.
- **B** — Structurally strong but behavior-thin. Architecture clear, but too many product behaviors left implicit. Builders will fill gaps ad hoc.
- **C** — Incomplete / risky. Would likely produce a half-built or structurally confused feature.

---

| # | Epic | Grade | Short reason | Risk if built as-is | Rewrite? |
|---|------|-------|--------------|---------------------|----------|
| 01 | Leads | **A** | Reference quality. Full CRUD, lifecycle, permissions, mobile, edge cases, validations, audit. | Low | No |
| 02 | Customers | **A-** | Solid CRM object epic. Create, list, detail, filters, search, archive, delete, permissions, mobile, audit all present. Slightly thinner on field definitions than 01 but sufficient. | Low | No |
| 03 | FlowGroup | **B+** | Good structural coverage. Create flow, filters, archive, delete covered. Thinner on validations, field definitions (address structure), and mobile. Adequate for build but a builder would invent address validation rules. | Low-Medium | Light expand |
| 04 | Contacts | **B** | Object role clear. CRUD present. But polymorphic parent model (`parentType`+`parentId` vs join tables) left to implementation. Primary-uniqueness enforcement described but field validation detail thin. Mobile UX thin. | Medium | Light expand |
| 05 | Notes & timeline | **B+** | Good for a cross-cutting concern. Timeline composition, redact policy, edit windows defined. Thin on exact UI layout (where exactly does the input live, keyboard behavior). Acceptable because notes attach to many parents. | Low | No |
| 06 | Files / photos | **B+** | Upload flow, permissions, virus scan, categories, frozen-version pin rules covered. Thin on exact chunked upload UX and quota management UI. Acceptable. | Low | No |
| **07** | **Quotes (shell)** | **C+** | **Structurally correct but behavior-thin.** List behavior is 2 sentences. Detail page described in 1 paragraph. Create flow delegates everything to other epics. Edit behavior is 2 lines. Archive and delete are 1 line each. No field definitions table. No validations table. No mobile detail. No edge cases beyond one. A builder would invent the entire quote list/detail UX.** | **High** | **Yes — rewrite** |
| 08 | Quote versions | **B-** | Object role and status transitions clear. But create flow says "auto on quote create" without UX detail. Detail view thin ("read-only for sent; editor for draft" — what does that look like?). No field validation table. Delete conditions single sentence. | Medium-High | Expand |
| 09 | Quote line items | **B** | Commercial fields and execution mode defined. Create flow has real steps. But field validations sparse (money rounding? quantity decimal rules?). Edit section thin. Mobile "read-only" with no detail. Archive/restore on draft described but UX sparse. | Medium | Light expand |
| 10 | Proposal groups | **B** | Object is intentionally simple. Create/edit/delete covered with merge-flow for non-empty delete. But field definitions table absent. Permissions section is "inherit." Mobile: "read-only section headers." Barely sufficient. | Low-Medium | No |
| **11** | **Quote editing (draft)** | **B-** | **Orchestrator epic.** Defines autosave, preflight, concurrent editors. But it delegates all content to other epics and has no field definitions, no validations, no required fields, no create flow, no archive/delete of its own. The editor UX is the single most important user-facing surface in Slice 1 and this epic says almost nothing about **what the screen looks like**, what sections exist, or how the user navigates. | **Medium-High** | **Expand** |
| **12** | **Quote send/freeze** | **B** | Core transaction defined. Send flow has 11 steps. But the epic is mostly procedural (what system does) without enough UX detail (what does the confirmation modal contain? what does the "sending..." state look like? what does success look like?). No field definitions table. | **Medium** | **Expand** |
| 13 | Signatures / acceptance | **B** | Sign flow defined with 8 steps. Signature record fields listed. But portal signing UX defers heavily to 54. Offline sign not addressed. "Record signature" dialog for office has no detail. | Medium | Light expand |
| 14 | Quote change / revision | **B** | Revision and void workflows defined. Carry-forward options described. Supersede timing specified. But compare-versions UX is 1 line. Void confirmation flow thin. | Medium | Light expand |
| **15** | **Scope packets (catalog)** | **B-** | **Object structure clear. Publish workflow defined. But this is a major authoring surface with almost no UX detail.** Create flow has 4 numbered steps with no form detail. Detail page "tabs" listed but not specified. Field definitions has 2 lines. No packet editor layout described. A builder would invent the entire catalog authoring UX. | **Medium-High** | **Expand** |
| 16 | Packet task lines | **B-** | Canon role clear (placement on line, not definition). But create flow thin. Node picker UX described in 1 sentence. No field max-lengths beyond "match definition caps." Grid columns listed but detail drawer "merged preview" unexplained. | Medium | Light expand |
| 17 | Task definitions | **B** | Catalog library object with draft/publish. Adequate for the object's simplicity. Field definitions thin but object is straightforward. "Usage count" and "used by" described. | Low-Medium | No |
| 18 | Structured inputs | **B** | Template definitions and answer lifecycle defined. Commit semantics discussed. But the epic covers both **template authoring** and **answer filling** across quote, portal, and execution — each with different UX — and gives thin treatment to all three. | Medium | Light expand |
| 19 | Packet tiers | **B** | Tier matrix model described. Picker UX thin but adequate for scope. | Low-Medium | No |
| 20 | Assemblies / rules | **B** | Secondary system. Adequately scoped. Rules author and overlay diff defined. Implementation language explicitly out of scope. | Low | No |
| 21 | AI packet authoring | **B** | AI draft flow with diff review and apply defined. Commit wall clear. Adequate for the feature's scope. | Low | No |
| 22 | AI quote drafting | **B** | Suggestion panel, accept/reject, confidence display. Adequate. | Low | No |
| **23** | **Process templates** | **B-** | **Major authoring surface. Create flow is 4 steps. Graph canvas + inspector mentioned once. Detail page "tabs" listed but not specified. No field definitions table. Publish validation described in 1 line. A builder would invent the entire template editor UX.** | **Medium-High** | **Expand** |
| 24 | Nodes | **B-** | Structural sub-object of template. Kind enum, create flow, edit rules adequate. But this is part of the template canvas and has almost no UX guidance beyond "canvas" and "inspector." | Medium | Light expand (or supplement with 23) |
| 25 | Gates / routing | **B-** | Graph edges. Condition types defined. But expression language punted. UX is "canvas edges; gate editor modal" — no detail. | Medium | Light expand (or supplement with 23) |
| 26 | Skeleton tasks | **B** | Sub-object of nodes. Adequate scope: name, outcomes, checklist. UX thin but object is simple. | Low-Medium | No |
| 27 | Completion rules | **B** | Rule modes defined. Preview explanation mentioned. Thin but adequate for a config sub-panel. | Low | No |
| 28 | Detours / loopback | **B** | Runtime concept. Create flow with reason enum, blocking set, resolve flow. Adequate for scope. | Low-Medium | No |
| 29 | Hold model | **B** | Hold types, apply/release, payment gate linkage. Adequate for a runtime overlay. | Low-Medium | No |
| 30 | Start eligibility | **B+** | Core computation. Reason codes listed. Override rules. API consistency requirement stated. | Low | No |
| 31 | Generated plan | **B** | Freeze artifact. Expansion rules, plan preview table, editable overlays on draft. Canon-aligned. Thin on manual plan task creation UX. | Medium | Light expand |
| 32 | Execution package | **B** | Compose artifact. Error/warning rules defined. Node-slot structure. Canon-aligned. Thin on UX (compose summary). | Low-Medium | No |
| 33 | Activation | **B** | Transaction steps defined. Preconditions listed. Atomic requirement stated. Adequate. | Low-Medium | No |
| **34** | **Job anchor** | **B-** | **Jobs are a primary navigation object. List columns named. Detail tabs listed. But create flow is "ensure on sign" only. Status values listed but transitions not. Edit behavior: 2 lines. Archive is "cancel" with no detail. No field definitions table.** | **Medium-High** | **Expand** |
| 35 | Runtime task instances | **B** | Materialization from package. Inject flow. Supersede rules via CO. Source classification. Adequate for runtime domain. | Low-Medium | No |
| 36 | Effective snapshot merge | **B** | Computed projection. Badges for kind. API contract requirement (explicit ids). Adequate. | Low | No |
| 37 | Change orders | **B** | Post-activation scope deltas. Draft/submit/apply lifecycle. Customer sign for price changes. Concurrent CO blocking. | Low-Medium | No |
| 38 | Inspection model | **B** | Folded model per decision 03. No new table. Task category flag. Adequate. | Low | No |
| 39 | Work station / feed | **B** | Primary field landing. Sections (today, upcoming, blocked), empty state, filters, pagination. Adequate for a view epic. | Low-Medium | No |
| 40 | Node / job views | **B** | Kanban board. Completion state columns. Badges. Forbidden drag. Adequate. | Low | No |
| 41 | Task execution UX | **B+** | Start/complete flow with eligibility check, outcomes, evidence gates. Timer display. Reversal flow admin. Good detail for field critical path. | Low | No |
| 42 | Evidence / photos | **B** | Evidence capture, metadata, retention, rejection flow. Task linkage. Adequate. | Low | No |
| 43 | Mobile field execution | **B** | Cross-cutting mobile constraints. Offline policy (online required for start/complete). Camera, push, responsive. Adequate as constraint doc. | Low | No |
| 44 | Office-to-field handoff | **B** | Handoff record, crew assignment, briefing, acknowledge flow. Adequate. | Low | No |
| 45 | Scheduling (MVP) | **B+** | Explicitly documents MVP non-enforcement. Banner requirement. Phase C flag. Well-aligned with decision 01. | Low | No |
| 46 | Schedule blocks | **B** | Block row model, time classes, supersede chain, cancel. Adequate. | Low | No |
| 47 | Payment gates | **B+** | Gate targets with explicit executable ids. Satisfaction rules. Pre-activation strategy options documented. §9 is notably strong with satisfaction semantics, multi-target gates, and normative blocking rules. | Low | No |
| 48 | Payment + operational holds | **B** | Integration glue between holds and gates. Auto-satisfy flow. Adequate. | Low | No |
| 49 | Cost / actual events | **B** | Append-only cost events. Reversal pattern. Task attribution. Adequate. | Low | No |
| 50 | Time tracking | **B** | Labor time entries, approval workflow, payroll export. Separate from TaskExecution truth. Adequate. | Low | No |
| 51 | Variance / margin | **B** | Read-only analytics. Cards defined. Drilldown dimensions. "Insufficient data" empty state. Adequate. | Low | No |
| 52 | Learning feedback | **B** | Suggestion inbox. Accept into draft. Human publish gate. Adequate. | Low | No |
| 53 | Customer portal | **B** | Auth flow, magic link, dashboard, PII boundaries. Adequate for shell. | Low-Medium | No |
| 54 | Portal quote review/sign | **B** | Proposal pages, line visibility, decline flow. Adequate. Defers sign mechanics to 13. | Low | No |
| 55 | Portal structured inputs | **B** | Customer-entered inputs with commit semantics. Review flow. Adequate. | Low | No |
| 56 | Notifications | **B+** | Cross-cutting. Event triggers, templates, throttling, deep links, preferences. Good. | Low | No |
| 57 | Audit / history | **B+** | Global audit. Field-level diffs. PII masking. Retention. Export. Good. | Low | No |
| 58 | Search / filtering | **B** | Global omnibox. Result grouping. Min query, debounce. Permission-filtered. Adequate. | Low | No |
| 59 | Permissions / roles | **B** | Role templates, permission keys, row-level options, matrix UI. Adequate as infrastructure. | Low | No |
| 60 | Admin settings | **B** | Settings control plane. Key list, validation, danger zone. Adequate. | Low | No |

---

## Summary counts

| Grade | Count | Meaning |
|-------|-------|---------|
| **A / A-** | 2 | Ready to build |
| **B+ / B** | 46 | Structurally sound; some thin but adequate for their scope |
| **B-** | 8 | Risky — key UX or behavioral detail missing |
| **C+** | 1 | Would produce a half-built feature |

---

## Highest risk epics (need rewrite or heavy expansion)

1. **07 — Quotes (shell)** — C+. The single biggest gap. Primary navigation object with almost no product behavior specified.
2. **23 — Process templates** — B-. Major authoring surface with almost no UX guidance.
3. **15 — Scope packets** — B-. Another major authoring surface left thin.
4. **34 — Job anchor** — B-. Primary runtime navigation object with thin behavior.
5. **11 — Quote editing (draft)** — B-. The most important user-facing surface, described as an orchestrator stub.
6. **08 — Quote versions** — B-. Core freeze carrier with thin UX and missing field validations.
7. **12 — Quote send/freeze** — B. Transaction is there but UX gaps for the most critical moment.
