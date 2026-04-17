# Reference comparison: Leads vs Quotes

## Why this comparison matters

`01-leads-epic.md` is the reference-quality bar. `07-quotes-epic.md` is the most prominent example of an epic that is structurally correct and canon-aligned but likely too thin to build a real feature without the builder inventing significant behavior.

---

## Where Leads is implementation-complete

| Dimension | What Leads does | Line count |
|-----------|----------------|------------|
| **Create flow** | Step-by-step (8 numbered steps), entry points, partial-create rules, defaults table | ~30 lines |
| **List view** | Column table with source/sortable/notes, default sort, pagination spec, empty state copy, filtered empty state copy | ~30 lines |
| **Filters** | Full table: filter name, type, behavior, defaults | ~10 lines |
| **Search** | Searchable fields listed, search type, min query, debounce | ~6 lines |
| **Detail view** | Layout sections (header, primary, notes, activity, related), action buttons, note editing policy (24h window, append-only, immutable after window) | ~20 lines |
| **Edit behavior** | What is editable, what is not, inline vs full form, validation rules, who can edit (per role table), reassignment rules, concurrency policy | ~25 lines |
| **Archive** | What archive means, who can archive, flow (4 steps), cascade rules, bulk archive | ~20 lines |
| **Delete** | Hard delete conditions, eligibility checks, confirmation (type name), tombstone audit, who can delete | ~18 lines |
| **Restore** | Who can restore, why office cannot, flow (4 steps), status restoration from `statusBeforeArchive`, relationship handling | ~15 lines |
| **Required fields** | 2-row table with type and "why required" | explicit |
| **Optional fields** | 18-row table with type, default, "why optional" | explicit |
| **Field definitions** | Full table: field, data type, max length, format/constraints, uniqueness, system/user | ~40 lines |
| **Status / lifecycle** | Status meaning table, allowed transitions table (14 rows), disallowed transitions list, initial status | ~40 lines |
| **Search/filter/sort** | Detailed spec with debounce, AND/OR logic, sort interaction | ~15 lines |
| **Relationships** | 5 relationship sections with cardinality, creation rules, referential integrity, broken-reference handling | ~30 lines |
| **Permissions** | Full action × role table (10 actions × 4 roles), tenant-configurable knobs, row-level note | ~25 lines |
| **Mobile** | Capability table (12 rows: available/not), offline policy, layout expectations | ~20 lines |
| **Notifications** | 5 event-specific notification rules, webhook event list | ~20 lines |
| **Audit** | Event table (10 events with logged data), visibility, retention rules | ~15 lines |
| **Edge cases** | 10 specific scenarios with expected behavior | ~40 lines |
| **What must not happen** | 8 explicit anti-requirements | ~15 lines |
| **Out of scope** | 13-row table with "why" and "where covered" | ~15 lines |
| **Open questions** | 4 questions with options, tradeoffs, recommendations, who decides | ~30 lines |

**Total: ~829 lines.** A builder reading this epic knows exactly what to build, what not to build, and what to ask about.

---

## Where Quotes is thinner

| Dimension | What Quotes does | What is missing | Impact |
|-----------|-----------------|-----------------|--------|
| **Create flow** | 4 numbered bullet points. "Pick customer, pick FlowGroup, create Quote + initial QuoteVersion, redirect." | No form layout. No validation detail. No partial-create rules. No defaults table. No success/failure handling. No toast. No error states. What happens if customer has no FlowGroups? What does the picker look like? | Builder invents the entire create wizard UX |
| **List view** | 1 paragraph: columns named, default sort stated, filters named | No column table with sortable/notes. No pagination spec. No empty state copy. No filtered-empty state. | Builder invents list UX details |
| **Detail view** | "Shows version history list; primary CTA opens latest editable or latest sent" | No layout sections. No action buttons described. No header area. No sidebar. What is the detail page? | Builder invents the entire quote detail page |
| **Edit behavior** | 2 lines: "Shell fields editable: nickname, tags, owner. Not editable: line items." | No inline-vs-form distinction. No validation. No concurrency. No who-can-edit rules. No toast. | Builder guesses edit UX |
| **Archive** | 1 line: "Archive quote shell hides from default lists; versions remain accessible; cannot activate from archived." | No archive flow (confirmation dialog? bulk?). No who-can-archive. No cascade detail. | Builder invents archive UX |
| **Delete** | 1 line: "Hard delete only if single draft with never sent and admin confirms; otherwise void workflow." | No delete flow. No confirmation UX. No error messages. | Builder invents or skips |
| **Restore** | 1 line: "Admin restores archived shell." | No flow, no audit detail, no confirmation | Builder invents |
| **Required fields** | 3-row table with FK and quoteNumber | No max-lengths, no format constraints, no uniqueness enforcement detail beyond "unique per tenant" | Thin but possibly adequate |
| **Optional fields** | 1 line listing 4 fields | No types, no defaults, no "why optional" | Builder guesses types and defaults |
| **Field definitions** | 2 lines | No data types, no max lengths, no format constraints table | Builder invents all validation |
| **Status / lifecycle** | 1 paragraph: salesStatus mirrors highest version state | No transition table. No disallowed transitions. Not clear whether salesStatus is derived or manually set. | Builder guesses lifecycle rules |
| **Permissions** | 3 lines | No action × role table. "Office: tenant-wide read; create if licensed" is not a permission spec. | Builder invents permissions |
| **Mobile** | 1 line: "List + open portal link share; heavy editing desktop-first." | No mobile layout. No capability table. | Builder skips mobile or invents |
| **Notifications** | 1 line: "Webhook on quote shell create." | No in-app notifications. No email. | Builder skips notifications |
| **Audit** | 1 line: "Log shell create, archive, restore, customer/project link changes." | No event table. No visibility. No retention. | Builder logs minimally |
| **Edge cases** | 1 edge case | The quote shell probably has at least 5-8 meaningful edge cases | Builder discovers them in QA |
| **Open questions** | 1 question | Inadequate for a primary navigation object | Possibly ok if resolved elsewhere |

**Total: ~137 lines.** This is 6x shorter than Leads. The difference is not just length — it's that nearly every section that requires product decisions (list UX, detail UX, archive flow, delete flow, permissions, mobile) is 1-2 lines where Leads provides 15-30 lines.

---

## What behavior Quotes depends on other epics for

The Quotes epic explicitly delegates:

| Behavior | Delegated to | Problem |
|----------|-------------|---------|
| Line item content | Epic 09 | Fine — canon-correct. Line items belong on version, not shell. |
| Version lifecycle | Epic 08 | Fine — versions are a separate object. |
| Quote editor UX | Epic 11 | **Problem.** Epic 11 is itself thin (B-). The editor is the single most important user surface and no epic gives it a real UX spec. |
| Void workflow | Epic 14 | Fine — void is a distinct flow. |
| Activation | Epic 33 | Fine — separate domain. |
| Navigation routing | Epic 11 | **Problem.** "Deep link redirects to current draft or latest sent per rule (epic 11)" — epic 11 does not define this rule either. |

**The real issue:** The quote **shell** is a navigation container that users interact with daily — they see it in a list, click into it, see version history, create new quotes, archive old ones. None of that behavior is actually specified in any epic. Epic 07 says "it's a container" and points elsewhere. Epic 08 defines the version object. Epic 11 defines the editor. But nobody defines:

- What the quote detail page actually looks like
- What actions are available from the quote detail page
- What the version history section shows and how it works
- How the user switches between versions
- What the quote header displays
- What happens when you click a quote in the list

---

## Is the delegation acceptable?

**Partially.** Delegation of line-item content to epic 09 is correct (canon). Delegation of freeze mechanics to epic 12 is correct. But delegation of the quote's own CRUD behavior to "other epics" that don't actually define it either is a real gap.

The quote shell needs to stand alone as a usable object even before you add line items or versions. At minimum a builder needs to know:

- What the list page looks like
- What the detail page sections are
- What actions exist and where
- What the archive/delete confirmation dialogs say
- What empty states exist
- What the mobile experience is

---

## What must be added to make Quotes build-complete

### Must add (critical for implementation)

1. **Create flow:** Step-by-step with form fields, validation errors, inline customer/FlowGroup create option, defaults, success/failure handling
2. **List view:** Column table with sortable flags, pagination spec, empty state copy, filtered-empty copy
3. **Detail page layout:** Section breakdown (header, version history, related objects, notes tab, files tab, activity tab), action buttons and their states
4. **Field definitions table:** Every field with type, max length, format, uniqueness, system/user
5. **Archive flow:** Step-by-step with confirmation dialog copy, who-can-archive table, bulk archive
6. **Delete flow:** Step-by-step with eligibility check, confirmation dialog, audit
7. **Restore flow:** Step-by-step with confirmation
8. **Permissions table:** Action × role matrix (at least 8 actions × 4 roles)
9. **Status/lifecycle:** Transition table with triggers and disallowed transitions; clarify derived vs explicit salesStatus
10. **Mobile behavior:** Capability table with what is/isn't available

### Should add (important for quality)

11. **Edge cases:** Wrong FlowGroup (covered), but also: duplicate quotes for same customer/project, quote with no versions (impossible?), quote with all void versions, archived customer on new quote, etc.
12. **Notifications:** In-app notification on quote create, archive, version sent
13. **Audit:** Event table with what is logged

### Can defer (nice-to-have)

14. Version comparison UX (partially in epic 14)
15. Saved views for quote list
