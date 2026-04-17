# Struxient v3 — Epic set summary

**Status:** Roll-up after authoring `01A` roadmap + epics `01`–`60` under `docs/epics/`.

---

## What this library now covers

The epic set spans **end-to-end** Struxient v3 product behavior from **CRM intake** through **catalog scope**, **quote lifecycle (draft → send/freeze → sign)**, **process templates / FlowSpec skeleton**, **plan + execution package + activation**, **job anchor**, **runtime execution**, **change orders**, **folded inspection**, **field and mobile UX**, **scheduling as non-authoritative intent (MVP)**, **payment gates + holds with executable task ids**, **cost/time/margin/learning**, **customer portal**, **notifications**, **audit**, **global search**, **permissions**, and **tenant admin settings**.

**Roadmap and dependencies:** see `01A-epic-roadmap-index.md`.  
**Structure and depth standard:** `00-epic-writing-standard.md`.  
**Quality calibration example:** `01-leads-epic.md`.

---

## Canon and decision pack integration

| Decision / canon area | Where reflected in epics |
|-----------------------|----------------------------|
| Trade-first, line-item-fronted, packet-driven, FlowSpec skeleton | `09`, `15`–`20`, `23`–`27`, `31`–`32` |
| Send freeze + activation semantics | `12`, `31`–`33` |
| Task identity layers | `04` (canon doc), `16`–`18`, `26`, `31`–`36`, `41` |
| Banned v2 drift (naming, workflow-first, JobTask, string payment, split-brain scheduling, etc.) | `09`, `25`, `30`, `35`–`36`, `45`–`47`, `59` |
| AI commit walls | `08` (canon), `21`–`22`, `52` |
| **Scheduling authority `01`** | `30`, `45`, `46`, `43` (copy), `60` (future flag hook) |
| **Payment / hold task id mapping `02`** | `30`, `47`, `48` |
| **Inspection folded model `03`** | `15`, `31`, `33`, `38`, `42` |
| **Job anchor timing `04`** | `13`, `33`, `34`, `47`, `60` (`createJobOnSign`) |

---

## Epics that contain **real** open questions

These epics intentionally retain **Open questions** because **canon**, **decision pack**, or **business** items remain unresolved or are **explicitly** left to implementation packaging:

| Epic | Topic |
|------|--------|
| `01-leads-epic` | O7 customer/site canonical display; customer match-or-create at conversion |
| `02-customers-epic` | O7 alignment; quote customer snapshot field list (ties `08`) |
| `03-flowgroup-project-anchor-epic` | O7 portal display vs billing vs site |
| `04-contacts-and-contact-methods-epic` | Project-local vs shared contact model at quote convert |
| `05-notes-and-activity-timeline-epic` | Rich text vs markdown |
| `06-files-photos-documents-epic` | Video limits |
| `07-quotes-epic` | Process template on shell vs version (recommend version-scoped) |
| `08-quote-versions-epic` | Legal snapshot field list for customer PDF |
| `09-quote-line-items-epic` | O10 override bounds surfacing (compose `32`) |
| `12-quote-send-freeze-epic` | Async send for very large quotes |
| `13-quote-signatures-acceptance-epic` | O16 signature provider scope |
| `14-quote-change-revision-workflow-epic` | Post-sign revision + re-sign rules |
| `16-packet-task-lines-epic` | Multi-template compatibility rules |
| `19-packet-tiers-variant-handling-epic` | Tier matrix vs separate line lists (implementation) |
| `20-assemblies-rules-generated-scope-epic` | Rule language / engine |
| `21`–`22` (AI) | O14 packaging order |
| `25-gates-routing-outcomes-epic` | Condition DSL vs fixed enums |
| `26-skeleton-tasks-epic` | Checklist vs multi-task inspection (`03` UX) |
| `27-completion-rules-epic` | How manifest tasks appear in **UI** progress vs routing |
| `28-detour-loopback-epic` | O20 customer-facing labels |
| `29-hold-model-epic` | O9 hold type MVP list (also `60`) |
| `30-start-eligibility-actionability-epic` | Phase C scheduling granularity (`01`) |
| `31-generated-plan-epic` | O12 storage shape |
| `36-effective-snapshot-runtime-merge-epic` | Cache invalidation / performance |
| `37-change-orders-scope-mutation-epic` | CO gate retargeting defaults (`02` ALL/ANY) |
| `38-inspection-model-epic` | One checkpoint → one task vs checklist (`03`) |
| `39-work-station-actionable-work-feed-epic` | Team feed default |
| `41-runtime-task-execution-ux-epic` | Reversal / correction depth |
| `43-mobile-field-execution-epic` | PWA vs native push |
| `44-office-to-field-handoff-epic` | Crew entity vs user tags |
| `45-scheduling-epic` | Phase C roadmap timing (business) |
| `46-schedule-blocks-requests-epic` | O6 precedence if Phase C (`01`/`canon O6`) |
| `47-payment-gates-epic` | **`02` ALL vs ANY**; pre-activation deposit target strategy |
| `48-payment-holds-operational-holds-epic` | Partial payments MVP? |
| `49-cost-actual-events-epic` | O15 GL depth |
| `50-time-tracking-labor-actuals-epic` | Integrate timesheet with TaskExecution? |
| `51-variance-margin-visibility-epic` | Burden methodology |
| `52-learning-feedback-loop-epic` | O15 approval RACI |
| `53-customer-portal-epic` | O7 address labeling |
| `54-portal-quote-review-sign-epic` | O16 |
| `55-portal-structured-input-collection-epic` | **O17** portal depth drives customer vs office **REQUIRED_TO_SEND** feasibility |
| `56-notifications-epic` | SMS vendor |
| `57-audit-history-epic` | Regional retention law |
| `58-search-filtering-global-retrieval-epic` | Index technology |
| `59-permissions-roles-visibility-epic` | O13 subcontractor matrix |
| `60-admin-settings-tenant-configuration-epic` | O9, O14, security key handling details |

**Still canon-open (not “owned” by a single epic):** **`10-open-canon-decisions.md`** items **O2 multi-flow**, **O4 InstallItem**, **O12** (referenced in epics above), **O16/O17** (portal/signatures), plus any items **narrowed** by `docs/decisions/01–04` but not yet retrofitted into canon text (per decision pack note).

---

## Open questions blocked on canon / business

| Item | Blocker type | Epics affected |
|------|----------------|----------------|
| **O2 Multi-flow / fan-out** | Canon / GTM | `32`, `33`, `47` (`flowId` scoping), `40` |
| **O4 InstallItem** | Canon / GTM | `35`, `51` |
| **O12 Freeze storage shape** | Engineering / canon maintenance | `08`, `12`, `31`, `32`, `57` exports |
| **O16 Signature provider parity** | Business / legal | `13`, `54` |
| **O17 Portal structured-input depth** | Business | `12` (send gating), `18`, `55`, `60` |
| **O7 Customer vs FlowGroup canonical identity** | Data governance | `01`–`04`, `53` |
| **O13 Task-level authorization** | GTM / compliance | `35`, `41`, `59` |
| **`02` ALL vs ANY payment gate satisfaction** | Product default | `47`, `48` |
| **Pre-activation payment targets without runtime ids** | Business | `47`, `33` |

---

## Is the epic set detailed enough for implementation planning?

**Yes, as a behavior contract layer:** each epic `02`–`60` follows the **27-section** standard and spells out **list/detail/create/edit/archive/delete/restore** (or explicit **Not applicable**), **fields**, **validations**, **lifecycle**, **search/filter/sort**, **relationships**, **permissions**, **mobile**, **notifications**, **audit**, **edge cases**, **anti-patterns**, and **out of scope**.

**What remains before schema / sprint breakdown:** resolve or **freeze defaults** for the **blocked** items above, produce a **permission key registry** (named in `59`), and run a **short engineering spike** on **search/index** (`58`) and **freeze storage** (`O12`) so epics **31–32** bind to **concrete** persistence shapes without changing their **semantic** requirements.

---

## Recommended next step

**Proceed to schema and API contract design** (and **migration strategy** from v2 where applicable) using:

1. `docs/decisions/05-decision-pack-summary.md` as **resolved** cross-cutting decisions for **scheduling**, **payment ids**, **inspection**, **job timing**.  
2. `docs/canon/*` + this epic library for **behavioral** acceptance criteria.  
3. A **traceability matrix** exercise: map each **immutable** canon rule to **at least one** epic section to catch gaps before build.

**Suggested immediate artifact after schema:** a **single** “**ID spaces**” document listing **`skeletonTaskId`**, **`runtimeTaskId`**, **`planTaskId`**, **`packageTaskId`**, **`flowId`**, **`jobId`** — derived from epics **31–36**, **47–48**, and **`02` decision** — to prevent **public API** drift (`04`, `09`).

---

## Quality verification (self-check)

- **No epic** uses shorthand **“standard CRUD applies”** or **“normal list behavior”** as a substitute for specifics.  
- **Quote / packet / task / node / FlowSpec** layering is **preserved** across **09**, **15–20**, **23–27**, **31–36**.  
- **Banned v2 patterns** are **explicitly** negated again in **30**, **35–36**, **45–48**, **59**.  
- **Mobile** expectations are **stated** wherever **field** or **customer** touch the surface (not just “responsive”).  
- **MVP scheduling honesty** is **explicit** in **30**, **45**, **46**, **43**, **60**.

For ongoing maintenance, when **canon `10`** is updated to reference **`docs/decisions/01–04`**, revisit **Open questions** sections in the epics listed above to **close** or **narrow** them so the library stays **honest** over time.
