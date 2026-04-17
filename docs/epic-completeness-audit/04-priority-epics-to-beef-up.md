# Priority epics to beef up

Ranked by risk of producing a half-built feature × how soon the epic is needed for implementation.

---

## Rank 1: Epic 07 — Quotes (shell)

**Grade:** C+
**Needed by:** Slice 1 (immediate)

### What is missing

- **Create flow:** No form detail, no validation errors, no defaults table, no inline customer/FlowGroup create, no success/failure handling
- **List view:** No column table, no pagination, no empty states, no filtered-empty state
- **Detail page:** No layout sections, no action buttons, no header area description
- **Edit behavior:** No inline-vs-form distinction, no field-level validation, no concurrency, no who-can-edit
- **Archive flow:** No confirmation dialog, no who-can-archive, no bulk archive
- **Delete flow:** No step-by-step, no eligibility error messages
- **Restore flow:** No steps beyond "admin restores"
- **Field definitions:** No table at all
- **Permissions:** No action × role table
- **Status/lifecycle:** salesStatus derivation rules unclear (derived vs explicit)
- **Mobile:** No capability table, no layout
- **Edge cases:** 1 edge case for a primary navigation object

### Why it matters

This is the **primary navigation object** for the commercial pipeline. Every user who touches quotes uses this surface. The current epic tells the builder almost nothing about what they're building — it's a database schema note, not a product spec.

### What kind of rewrite is needed

**Full rewrite** to the 01-leads standard. Every section needs expansion to match the depth of the writing standard.

---

## Rank 2: Epic 34 — Job anchor

**Grade:** B-
**Needed by:** Post-Slice 1 (activation), but design now to avoid rework

### What is missing

- **Create flow:** "ensureJobForFlowGroup on sign" — no detail on what happens if the ensure fails, what the user sees, what audit is written
- **List view:** Columns named but no sortable flags, no pagination, no empty state (says "N/A" but there's an initial state before any jobs exist in the tenant)
- **Detail page:** Tabs listed but not described. What does the Overview tab show? What actions exist?
- **Edit behavior:** 2 lines. What is the jobStatus dropdown? Is it inline? What validation?
- **Status/lifecycle:** Values listed but no transition table. Can `complete` go back to `in_progress`? Can `cancelled` be restored?
- **Archive:** "Cancel job: requires policy checklist" — what checklist? What policy?
- **Field definitions:** No table
- **Permissions:** 2 lines
- **Mobile:** 1 line

### Why it matters

Jobs are the **primary runtime navigation object**. PMs, dispatchers, and field leads all navigate by job. The detail page is one of the most complex screens in the app (tabs for overview, quotes, flow, files, notes, schedule, money). None of that is specified.

### What kind of rewrite is needed

**Heavy expansion.** The epic should define the job detail page layout, job list UX, status transition table, and action-button states.

---

## Rank 3: Epic 23 — Process templates

**Grade:** B-
**Needed by:** Slice 1 catalog setup (needed before quotes can reference templates)

### What is missing

- **Template editor layout:** "Graph canvas + inspector" is the entire description of one of the most complex screens in the app
- **Create flow:** 4 steps. No form detail. No template naming rules.
- **Detail page:** "Tabs" listed but not described
- **Publish validation:** 1 line
- **Field definitions:** 2 lines
- **Permissions:** 1 line
- **Mobile:** 1 line

### Why it matters

The template editor is a **canvas application** — nodes, edges, gates, skeleton tasks, completion rules. A builder needs to know the layout (where's the canvas, where's the inspector, where's the toolbar, where's the node list). The current epic provides none of this.

### What kind of rewrite is needed

**Heavy expansion** covering the template editor layout and combining UX guidance for the sub-objects (nodes 24, gates 25, skeleton tasks 26, completion rules 27) into a coherent authoring surface spec. The sub-object epics can remain for their data/behavior details but the editor layout belongs in 23.

---

## Rank 4: Epic 15 — Scope packets (catalog)

**Grade:** B-
**Needed by:** Slice 1 catalog setup

### What is missing

- **Packet editor layout:** Tabs listed ("Overview, Tiers, Task lines, Checkpoints, History, Where used") but not described
- **Create flow:** 4 steps with no form detail
- **Publish flow:** 1 line ("Publish → immutable publishedRevision")
- **Tier matrix UX:** Defers to 19 but 19 is also thin
- **Field definitions:** 2 lines
- **Permissions:** 1 line

### Why it matters

Catalog authoring is a daily workflow for the author persona. The packet editor is a multi-tab form with task-line grids, tier matrices, and publish gates. Without UX detail, the builder invents the entire authoring experience.

### What kind of rewrite is needed

**Heavy expansion** of the editor surface. Add: tab layout descriptions, create form detail, publish confirmation flow, deprecation flow, "where used" impact warnings.

---

## Rank 5: Epic 11 — Quote editing and draft behavior

**Grade:** B-
**Needed by:** Slice 1 (immediate)

### What is missing

- **Editor layout:** "Quote workspace route; full-width layout; right rail validation/compose" — no section breakdown, no panel descriptions, no toolbar actions
- **What the screen looks like:** The editor is the single most-used screen in the commercial workflow and no epic defines its visual structure
- **Navigation routing:** "Deep link redirects to current draft or latest sent per rule" — this rule is never defined
- **Autosave UX:** Described as "debounce 2s" but no save indicator, no failure UX, no conflict resolution UX
- **Preflight UX:** "Must call compose dry-run before enabling Send" but no description of where errors/warnings appear

### Why it matters

This is the most important user-facing surface in Slice 1. The builder needs to know what panels exist, where they are, what they show, and how the user navigates between them.

### What kind of rewrite is needed

**Expansion** adding an editor layout spec: left panel (groups/lines), center (line grid), right rail (validation/compose/structured inputs), header (version badge, save indicator, Send button), mobile behavior.

---

## Rank 6: Epic 08 — Quote versions

**Grade:** B-
**Needed by:** Slice 1 (immediate)

### What is missing

- **Create flow:** "Auto on quote create (v1 draft)" — no detail
- **Version list within quote:** "Version #, status, sent date, total, activated? badge" — no table, no layout
- **Detail view:** "Read-only for sent; editor for draft" — what does read-only look like?
- **Field definitions:** No table
- **Delete conditions:** 1 sentence

### Why it matters

Versions are the freeze carrier. Users interact with versions constantly: viewing version history, comparing versions, opening specific versions. The UX needs more definition.

### What kind of rewrite is needed

**Moderate expansion.** Add: version history list layout, version-switching UX, version header display, field definitions table, read-only sent version layout.

---

## Rank 7: Epic 12 — Quote send/freeze

**Grade:** B
**Needed by:** Slice 1 (immediate)

### What is missing

- **Send confirmation modal:** Content described procedurally but no layout. What does the modal show? How are warnings displayed? Where are error details?
- **"Sending..." state:** "Async job with sending state" mentioned as an option but not specified
- **Success UX:** "Set status=sent, sentAt" — but what does the user see? Redirect? Toast? Celebration?
- **Email delivery:** "Email customer link if email channel" — no email content spec

### Why it matters

Send is the single most critical user action in the commercial pipeline. The confirmation modal and success experience need to feel right. Builders should not invent the UX for the moment when a proposal becomes legally binding.

### What kind of rewrite is needed

**Moderate expansion.** Add: confirmation modal layout, warning acknowledgment UX, send progress indicator, success state, error recovery UX, email template spec.
