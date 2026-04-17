# Struxient v3 — Epic roadmap index

**Status:** Navigation and dependency map for the full epic library under `docs/epics/`.

---

## What this library is

These documents are **implementation-grade product behavior contracts**, not lightweight feature headlines. Each epic follows `00-epic-writing-standard.md` and spells out create/read/edit/archive/delete/restore, fields, validations, lifecycle, search/filter/sort, relationships, permissions, mobile, notifications, audit, edge cases, anti-patterns, and explicit out-of-scope boundaries.

**Calibration example:** `01-leads-epic.md` defines the quality bar for depth and explicitness.

---

## Why this order

The sequence mirrors the **quote-to-execution spine** from canon (`01`–`03`) while front-loading **CRM / identity** objects that quotes and jobs attach to:

1. **Phase 1** establishes **who and where** (customers, flow group / project anchor, contacts, notes, files) before commercial documents reference them.
2. **Phase 2** walks the **quote lifecycle** from shell through versions, line items, groups, draft/edit, **send (freeze)**, signatures, and revision — matching `03-quote-to-execution-canon.md`.
3. **Phase 3** defines **reusable trade scope** (scope packets, packet task lines, task definitions, structured inputs, tiers, assemblies, AI assists) per `05`, `04`, `08`.
4. **Phase 4** defines **process structure** (templates, nodes, gates, skeleton tasks, completion rules, detours, holds, start eligibility) per `06`, `07`, decision `01` (scheduling non-authoritative for MVP).
5. **Phase 5** bridges **freeze → activation** (generated plan, execution package, activation, job anchor per decision `04`, runtime instances, effective snapshot, change orders, inspection per decision `03`).
6. **Phase 6** is **field and office execution UX** (work feed, node views, runtime task UX, evidence, mobile, handoff).
7. **Phase 7** is **operations, money, and learning** (scheduling per `01`, schedule blocks, payment gates per `02`, holds, cost events, labor actuals, variance, learning).
8. **Phase 8** is **cross-cutting** surfaces (portal, notifications, audit, global search, permissions, admin settings).

Epics are numbered **globally** (`02`–`60`) so ordering stays unambiguous even if files are grouped in subfolders later.

---

## Epic list (in order)

| # | File | Title (short) |
|---|------|----------------|
| 01 | `01-leads-epic.md` | Lead management |
| 02 | `02-customers-epic.md` | Customers |
| 03 | `03-flowgroup-project-anchor-epic.md` | FlowGroup / project anchor |
| 04 | `04-contacts-and-contact-methods-epic.md` | Contacts & contact methods |
| 05 | `05-notes-and-activity-timeline-epic.md` | Notes & activity timeline |
| 06 | `06-files-photos-documents-epic.md` | Files, photos, documents |
| 07 | `07-quotes-epic.md` | Quotes (shell) |
| 08 | `08-quote-versions-epic.md` | Quote versions |
| 09 | `09-quote-line-items-epic.md` | Quote line items |
| 10 | `10-proposal-groups-epic.md` | Proposal groups |
| 11 | `11-quote-editing-draft-behavior-epic.md` | Quote editing & draft behavior |
| 12 | `12-quote-send-freeze-epic.md` | Send & freeze |
| 13 | `13-quote-signatures-acceptance-epic.md` | Signatures & acceptance |
| 14 | `14-quote-change-revision-workflow-epic.md` | Change & revision workflow |
| 15 | `15-scope-packets-epic.md` | Scope packets (catalog) |
| 16 | `16-packet-task-lines-epic.md` | Packet task lines |
| 17 | `17-task-definitions-epic.md` | Task definitions (library) |
| 18 | `18-structured-input-definitions-epic.md` | Structured input definitions |
| 19 | `19-packet-tiers-variant-handling-epic.md` | Packet tiers & variants |
| 20 | `20-assemblies-rules-generated-scope-epic.md` | Assemblies / rules-generated scope |
| 21 | `21-ai-assisted-packet-authoring-epic.md` | AI-assisted packet authoring |
| 22 | `22-ai-assisted-quote-drafting-epic.md` | AI-assisted quote drafting |
| 23 | `23-process-templates-epic.md` | Process templates |
| 24 | `24-nodes-epic.md` | Nodes |
| 25 | `25-gates-routing-outcomes-epic.md` | Gates, routing, outcomes |
| 26 | `26-skeleton-tasks-epic.md` | Skeleton tasks |
| 27 | `27-completion-rules-epic.md` | Completion rules |
| 28 | `28-detour-loopback-epic.md` | Detours & loopbacks |
| 29 | `29-hold-model-epic.md` | Hold model |
| 30 | `30-start-eligibility-actionability-epic.md` | Start eligibility & actionability |
| 31 | `31-generated-plan-epic.md` | Generated plan (freeze artifact) |
| 32 | `32-execution-package-epic.md` | Execution package |
| 33 | `33-activation-epic.md` | Activation |
| 34 | `34-job-anchor-epic.md` | Job anchor |
| 35 | `35-runtime-task-instances-epic.md` | Runtime task instances |
| 36 | `36-effective-snapshot-runtime-merge-epic.md` | Effective snapshot & merge |
| 37 | `37-change-orders-scope-mutation-epic.md` | Change orders |
| 38 | `38-inspection-model-epic.md` | Inspection model (folded) |
| 39 | `39-work-station-actionable-work-feed-epic.md` | Work station / actionable feed |
| 40 | `40-node-job-execution-views-epic.md` | Node & job execution views |
| 41 | `41-runtime-task-execution-ux-epic.md` | Runtime task execution UX |
| 42 | `42-evidence-photos-completion-proof-epic.md` | Evidence & completion proof |
| 43 | `43-mobile-field-execution-epic.md` | Mobile field execution |
| 44 | `44-office-to-field-handoff-epic.md` | Office-to-field handoff |
| 45 | `45-scheduling-epic.md` | Scheduling (MVP intent) |
| 46 | `46-schedule-blocks-requests-epic.md` | Schedule blocks & requests |
| 47 | `47-payment-gates-epic.md` | Payment gates |
| 48 | `48-payment-holds-operational-holds-epic.md` | Payment & operational holds |
| 49 | `49-cost-actual-events-epic.md` | Cost & actual events |
| 50 | `50-time-tracking-labor-actuals-epic.md` | Time tracking & labor actuals |
| 51 | `51-variance-margin-visibility-epic.md` | Variance & margin visibility |
| 52 | `52-learning-feedback-loop-epic.md` | Learning feedback loop |
| 53 | `53-customer-portal-epic.md` | Customer portal |
| 54 | `54-portal-quote-review-sign-epic.md` | Portal quote review & sign |
| 55 | `55-portal-structured-input-collection-epic.md` | Portal structured inputs |
| 56 | `56-notifications-epic.md` | Notifications |
| 57 | `57-audit-history-epic.md` | Audit & history |
| 58 | `58-search-filtering-global-retrieval-epic.md` | Global search & retrieval |
| 59 | `59-permissions-roles-visibility-epic.md` | Permissions & roles |
| 60 | `60-admin-settings-tenant-configuration-epic.md` | Admin & tenant configuration |

---

## Dependency graph (high level)

```
01 Leads ──┐
02 Customers ──┬──► 07 Quotes ──► 08 Versions ──► 09 Line items ──► … ──► 12 Freeze ──► 13 Sign ──► 33 Activation
03 FlowGroup ──┘         │              │                    │
04 Contacts              │              └── 10 Groups        ├── 15–22 Catalog / AI
05 Notes (polymorphic) ◄─┴────────────── all parent types    │
06 Files (polymorphic) ◄─────────────────────────────────────┘
15 Scope packets ──► 16 Packet lines ──► 17 Definitions
18 Structured inputs ◄── ties to 17, 09, 12
23 Templates ──► 24 Nodes ──► 25 Gates, 26 Skeleton, 27 Completion
28 Detours, 29 Holds ──► 30 Start eligibility ◄── 45–46 (scheduling: non-blocking MVP)
09 + 15 + 23 ──► 31 Plan ──► 32 Package ──► 33 Activation ──► 35 Runtime + 36 Effective
37 COs, 38 Inspection (folded)
39–44 Execution surfaces
47 Payment gates ◄── decision 02; 48 Holds
53–55 Portal ◄── 07–13, 18
56–60 Cross-cutting ◄── all
```

**Hard dependencies (must not invert):**

- **Customer + FlowGroup** before **quote** that binds them (`03`, `04` decision pack job timing).
- **Scope packet + line item** semantics before **generated plan** (`31`).
- **Process template publish** before **execution package compose** (`32`).
- **Freeze (`12`)** before **sign truth (`13`)** before **activation (`33`)** per `03`.
- **Runtime task instances (`35`)** after **activation**; **effective snapshot (`36`)** after both skeleton and runtime exist.
- **Payment gates (`47`)** use **executable ids** per `docs/decisions/02`; **no** string bridge.

**Soft / parallel dependencies:**

- **Notes (`05`)** and **files (`06`)** attach to many parents; behavior is defined polymorphically.
- **AI epics (`21`, `22`)** sit beside human authoring; they do not replace freeze gates (`08` canon).

---

## Canon and decision pack alignment

| Source | Epics most affected |
|--------|---------------------|
| `02-core-primitives`, `03-quote-to-execution` | 07–14, 31–37 |
| `04-task-identity`, `05-packet`, `06-node-flowspec` | 15–20, 23–30, 35–36 |
| `07-time-cost-actuals` | 49–51 |
| `08-ai-assistance` | 21–22 |
| `09-banned-v2-drift` | All; especially 30, 36, 47, 48 |
| `10-open-canon-decisions` | Open questions only where still open (e.g. O2 multi-flow, O17 portal depth) |
| Decision `01` scheduling | 45, 46, 30 |
| Decision `02` payment mapping | 47, 48, 30 |
| Decision `03` inspection | 15, 31, 33, 38 |
| Decision `04` job timing | 13, 33, 34, 47 |

---

## How to use this index during implementation

1. **Planning:** Use dependencies above to order schema and API work; do not implement activation before freeze semantics are stable.
2. **Reviews:** When a feature touches multiple domains, cross-check the relevant epics for conflicting behavior.
3. **QA:** Acceptance criteria can be traced to explicit sections (e.g. archive/delete, mobile subset).
4. **Onboarding:** Read Phase 1–2 for CRM + quote basics, then Phase 4–5 for execution bridge.

---

## Related documents

- `00-epic-writing-standard.md` — required section structure and quality checklist.
- `99-epic-set-summary.md` — coverage summary, open questions rollup, recommended next step after epic authoring.
