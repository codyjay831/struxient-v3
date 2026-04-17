# Cross-epic gap patterns

Recurring weaknesses found across the epic library that would cause systemic implementation problems if not addressed.

---

## Pattern 1: Container epics that describe architecture, not behavior

**Affected epics:** 07 (Quotes), 08 (Quote versions), 11 (Quote editing), 23 (Process templates), 34 (Job anchor)

These epics correctly describe what an object **is** and what it **owns**, but do not describe what a user **does** with it. They read like database design docs dressed in the 27-section format.

**Telltale signs:**
- §8 (Create flow) is 3-4 bullets
- §9 (List/detail) is a paragraph, not a table
- §10 (Edit) is 2 lines
- §11-13 (Archive/delete/restore) are 1 line each
- §16 (Field definitions) is missing or 2 lines
- §20 (Permissions) is a sentence, not a table

**Why this matters:** These are primary navigation objects — the quote list, the quote detail page, the job list, the template editor. Builders interact with these sections constantly. When the epic says "list with columns" but doesn't define column widths, sortability, pagination, or empty states, the builder invents all of it. Results are inconsistent across the app.

**Fix:** Each container epic needs the same treatment as Leads: column tables, layout sections, action-button specs, confirmation dialog copy, empty states, mobile behavior tables.

---

## Pattern 2: Missing field definitions tables

**Affected epics:** 07, 08, 09, 10, 11, 15, 16, 23, 24, 25, 34

The epic writing standard (§16) requires: "For every field (required and optional): data type, max length or range, format constraints (email, phone, URL, enum values), uniqueness rules, and whether the field is user-facing or system-managed."

These epics either have no table at all or have 1-2 lines like "`quoteNumber`: max 50; pattern tenant-defined; immutable after first send optional policy."

**Why this matters:** Without field definitions, a builder must:
- Invent max lengths (is `quoteNumber` 50 or 100 chars?)
- Decide format constraints (regex for quote numbers? free text?)
- Choose uniqueness enforcement (unique per tenant? per customer? globally?)
- Guess validation error messages

These are product decisions disguised as implementation trivia. They show up in QA as bugs.

**Fix:** Every epic with a persistent object needs a full field definitions table. For epics with 3-4 fields, this is a small table. For epics with 10+ fields, it's substantial but necessary.

---

## Pattern 3: Weak permissions sections

**Affected epics:** 07, 08, 10, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27

Many epics handle permissions with a single line like "Catalog roles," "Process author," or "Inherit quote version permissions." The epic writing standard (§20) requires: "Who can see the object in list views. Who can see detail. Who can create. Who can edit. Who can archive. Who can delete. Who can restore."

**Why this matters:** When permissions are vague, two things happen:
1. The builder hardcodes a guess (usually "admin can do everything, office can do most things")
2. The permissions epic (59) lists permission keys but doesn't define which actions on which objects they gate

The result is that the permissions matrix is never fully defined until QA discovers that a field user can void a quote.

**Fix:** Every epic with user-facing actions needs at minimum a 3-column table: Action | Roles that can | Notes. For catalog epics (15-20, 23-27), this can be a shared table referenced across the group.

---

## Pattern 4: Missing or inadequate mobile behavior

**Affected epics:** 07, 08, 10, 15, 16, 23, 24, 25, 27, 32, 33

Many epics handle mobile with 1 line: "Read-only on mobile," "Not applicable for authoring," or "Mobile: list + open portal link share."

**Why this matters:** For CRM objects (quotes, customers, jobs), users expect functional mobile access. For catalog authoring objects, "not applicable" is correct but should say **why** (authoring is desktop-only by design). For execution objects, mobile is primary.

The issue is consistency: if some epics say "read-only on mobile" without specifying **what** the read-only view shows, builders either skip mobile entirely or build a generic detail card.

**Fix:**
- CRM/primary objects (quotes, jobs, customers): Need mobile capability table like Leads §21
- Catalog authoring objects: "Desktop-only by design — mobile shows read-only summary card with [these fields]" is sufficient
- Execution objects: Most are covered by epic 43, which is adequate

---

## Pattern 5: Over-reliance on neighboring epics for basic behavior

**Affected epics:** 07 (relies on 08, 11, 14 for quote behavior), 08 (relies on 11 for editor, 12 for send), 11 (relies on 09, 10, 23, 18 for all content), 23 (relies on 24, 25, 26, 27 for template content), 32 (relies on 31 for plan, 12 for trigger)

Some delegation is necessary and canon-correct. The problem is when no epic in the chain actually defines the user-facing behavior. For example:

- Quote list behavior: 07 says "list" → 08 says "list within quote" → 11 says "N/A inside editor" → Nobody defines the quote list page fully
- Template editor UX: 23 says "graph canvas + inspector" → 24 says "template canvas; node inspector" → 25 says "canvas edges; gate editor modal" → Nobody defines the editor layout

**Why this matters:** The builder has to read 4-5 epics simultaneously and synthesize a UI that was never designed. They become the product designer by default.

**Fix:** The "parent" epic in each cluster should contain the authoritative UX spec for the combined surface. Epic 07 should define the quote detail page layout (even if it says "line items section — see epic 09 for row details"). Epic 23 should define the template editor layout (even if it says "node inspector panel — see epic 24 for node fields").

---

## Pattern 6: Lifecycle behavior omitted for objects that clearly need it

**Affected epics:** 07 (salesStatus derived or explicit?), 08 (transitions exist but UX for each thin), 15 (draft → published → deprecated → archived — transitions not explicit), 23 (same), 34 (status values listed but no transition table)

The epic writing standard (§17) requires: "All statuses or states. Transitions: which statuses can move to which, and what triggers the transition. Whether status is user-editable or system-driven."

Many epics list statuses but don't define transitions. When transitions aren't defined, builders invent them — or worse, they implement statuses as a free-form dropdown where any value can be selected at any time.

**Fix:** Every epic with a status field needs a transition table. For simple objects (active ↔ archived), a 2-row table. For complex objects (quote versions: draft → sent → signed → superseded → void), a full transition table with triggers and disallowed paths.

---

## Pattern 7: Structural/catalog epics left thin because they feel "internal"

**Affected epics:** 15 (scope packets), 16 (packet task lines), 17 (task definitions), 18 (structured inputs), 19 (tiers), 23 (process templates), 24 (nodes), 25 (gates), 26 (skeleton tasks), 27 (completion rules)

These epics define the **catalog and template authoring system** — the tools that catalog authors and process designers use daily. Because they feel "internal" (no customer-facing surface), they get thin treatment.

But catalog authoring is a **primary workflow** for the admin/author persona. The template editor is a complex canvas application. The packet editor is a multi-tab form with tier matrices and task-line grids. These surfaces need real UX guidance.

**Why this matters:** If the template editor is poorly built because the epic was thin, every job using that template inherits the confusion. Catalog quality is upstream of execution quality.

**Fix:** The highest-impact fix is to expand epic 23 (process templates) into a real authoring-surface spec that covers the template editor layout, node inspector, gate editor, and skeleton task panel. Then expand epic 15 (scope packets) similarly for the packet editor. The sub-object epics (24-27) can remain thinner if 23 provides the layout context.

---

## Pattern 8: Edge cases sections that are too sparse

**Affected epics:** 07 (1 edge case), 08 (2), 10 (1), 15 (1), 16 (1), 23 (1), 24 (1), 34 (1)

The epic writing standard (§24) says: "Specific scenarios that must be handled. Each edge case should state the expected behavior."

Leads has 10 edge cases with full behavioral specs. Most thin epics have 1. The number of edge cases should roughly scale with the object's interaction surface area. A primary navigation object like Quotes or Jobs has at least 5-8 meaningful edge cases.

**Fix:** For each thin epic, brainstorm: What happens with duplicates? Partial data? Concurrent edits? Bulk operations? Missing dependencies? Archived parents? Deactivated users? Then specify the behavior.

---

## Summary: The systemic issue

The epic library has two tiers:

1. **Tier 1 epics** (Leads, Customers, some runtime epics): Written as product specs. A builder can implement them.
2. **Tier 2 epics** (most of the rest): Written as architecture specs. They describe the data model and canon alignment but leave product behavior to the builder.

The gap is not canon alignment — every epic respects canon. The gap is **implementation completeness**: does the epic tell the builder what the user actually sees and does?

For Slice 1 (quotes through send/freeze), this matters immediately. Epics 07, 08, 09, 10, 11, 12 are the critical path and most are Tier 2.
