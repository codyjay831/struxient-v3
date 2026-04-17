# Struxient v3 — Epic writing standard

**Status:** Normative for all epic documents under `docs/epics/`.

---

## Purpose of this document

This document defines the **required depth and structure** for every Struxient v3 epic. Its goal is to eliminate the common SaaS failure mode where epics name features without specifying the obvious-but-critical product behavior that builders then invent on the fly.

Every epic written under this standard must be **product-complete**: a builder reading it should be able to implement the described surface without guessing how creation, listing, editing, archiving, deletion, permissions, empty states, mobile use, or audit behave. If a behavior is intentionally omitted, the epic must say so explicitly in its **Out of scope** section — silence is never acceptable shorthand for "do the normal thing."

---

## Why this standard exists

1. **"Standard CRUD" is not a spec.** Every product defines create/read/update/delete differently. Defaults, required fields, soft-delete vs hard-delete, who can see what, what happens on mobile — these are product decisions, not implementation trivia.

2. **Assumptions become bugs.** When an epic says "list view with filters" and nothing else, one builder adds text search, another skips it, a third adds full-text search across related objects. The epic must say what is filterable, what is sortable, and what the default sort is.

3. **Edge cases surface late.** Duplicate handling, partial creation, restoring archived records, empty states — these are discovered in QA or production if not written down during epic authoring.

4. **Canon alignment must be explicit.** Struxient v3 has a normative canon (`docs/canon/`). Epics must reference which canon concepts they touch and must not contradict locked decisions.

---

## Required epic structure

Every epic must contain the following sections, **in this order**, using these exact headings. If a section does not apply, write "Not applicable — [reason]" rather than omitting it.

### 1. Epic title

A short, specific title. Not a feature tagline. Example: "Lead management" not "CRM power."

### 2. Purpose

One to three sentences: what this epic delivers to the product and why it matters to users.

### 3. Why this exists

The business or product rationale. What user problem does this solve? What breaks or is missing without it?

### 4. Canon alignment

Which canon documents and locked assumptions this epic touches. Explicit statement of how the epic conforms to or depends on canon. If the epic introduces an object not yet in canon, say so.

### 5. User roles involved

Every role that interacts with this epic's objects, and what they do. Do not assume "admin can do everything" — spell out what admin, office user, field user, and customer (if applicable) can each do.

### 6. Primary object(s) affected

The main data objects this epic creates, modifies, or depends on. Name them using v3 canon vocabulary.

### 7. Where it lives in the product

Navigation location, screen(s), whether it is a top-level section or embedded in another view. If there is a mobile surface, describe where it appears there separately.

### 8. Create flow

Step-by-step: how the user creates the object. Required fields at creation time. What happens if only partial information is available. What defaults are applied. What validations run. What the system does after successful creation (redirect, toast, side effects).

### 9. Read / list / detail behavior

**List view:** what columns or fields are shown. Default sort order. Available filters. Available search (what fields are searched, is it substring or prefix or full-text). Pagination or infinite scroll. What the empty state says and offers.

**Detail view:** what is shown. Layout expectations (sections, tabs, sidebar). What related objects are surfaced. What actions are available from the detail view.

### 10. Edit behavior

Which fields are editable after creation. Whether edit is inline, modal, or full-page. Validation on edit. What happens to related objects when key fields change (e.g., renaming, re-assigning). Who can edit. Concurrency expectations (last-write-wins, optimistic locking, or not applicable at expected scale).

### 11. Archive behavior

Whether archive is supported. What "archived" means for this object (hidden from default lists, still queryable, still linkable from other objects). Who can archive. Whether archiving cascades to child objects. Whether there is a bulk archive.

### 12. Delete behavior

Whether hard delete is allowed. Under what conditions. What prevents deletion (existing relationships, downstream objects). Who can delete. What confirmation is required. What happens to references from other objects.

### 13. Restore behavior

Whether archived or soft-deleted records can be restored. By whom. What happens to relationships that were created while the record was archived. Whether restore is available from a specific UI location or only via support.

### 14. Required fields

Every field that must be present at creation. For each: name, type, why it is required.

### 15. Optional fields

Every field that may be present. For each: name, type, default value (or null), why it is optional.

### 16. Field definitions and validations

For every field (required and optional): data type, max length or range, format constraints (email, phone, URL, enum values), uniqueness rules, and whether the field is user-facing or system-managed.

### 17. Status / lifecycle rules

All statuses or states the object can be in. Transitions: which statuses can move to which, and what triggers the transition (user action, system event, time). Whether status is user-editable or system-driven. Initial status on creation.

### 18. Search / filter / sort behavior

Explicitly: which fields are searchable, which are filterable (and filter type: dropdown, date range, text), which are sortable. Default filter state (e.g., "active only"). Default sort. Whether saved filters or views exist.

### 19. Relationships to other objects

Every object this epic's primary object relates to. Cardinality (one-to-one, one-to-many, many-to-many). Whether the relationship is required or optional. What happens on each side when the relationship is created, changed, or broken. Reference integrity rules.

### 20. Permissions / visibility

Who can see the object in list views. Who can see detail. Who can create. Who can edit. Who can archive. Who can delete. Who can restore. Whether any of this is tenant-configurable. Whether there is row-level visibility (e.g., assigned user only vs team vs company-wide).

### 21. Mobile behavior

Whether this object is accessible on mobile. What subset of behavior is available (view only, create, edit). Layout expectations for small screens. Offline expectations if any.

### 22. Notifications / side effects

What happens in the rest of the system when this object is created, updated, archived, deleted, or has a status change. Email or in-app notifications. Webhook or integration triggers if applicable.

### 23. Audit / history requirements

Whether changes to this object are logged. What is logged (field-level diff, who changed, when). Where the audit log is visible (on the object detail, in a global audit view, both). Retention expectations.

### 24. Edge cases

Specific scenarios that must be handled. Duplicates, partial data, concurrent edits, bulk operations, imports, timezone issues, unicode in names, very long field values, objects with many relationships, etc. Each edge case should state the expected behavior.

### 25. What must not happen

Explicit anti-requirements. Things this epic's implementation must avoid — informed by canon bans, past mistakes, or product philosophy. This is where banned v2 patterns are restated as specific prohibitions for this epic.

### 26. Out of scope

What this epic does not cover, even if a reader might expect it. Explicitly name deferred features, related epics that will handle adjacent behavior, and integration points that are not addressed here.

### 27. Open questions

Only truly unresolved decisions that require stakeholder input. Each question must state what the options are, what the tradeoff is, and who needs to decide. If there are no open questions, write "None — all decisions for this epic are resolved."

---

## Quality checklist (for epic reviewers)

Before an epic is considered complete, verify:

- [ ] Every section from 1–27 is present. No section is silently omitted.
- [ ] No section contains only "standard behavior" or "normal CRUD" or "basic validations" without spelling out what that means.
- [ ] Required and optional fields are individually listed with types and constraints.
- [ ] Create, edit, archive, delete, and restore flows are described as step-by-step user-facing behavior, not just "user can create."
- [ ] Permissions state who can do what, not just "role-based access."
- [ ] Empty states describe what the user sees and what actions are offered.
- [ ] Mobile section says what is and is not available, not just "responsive."
- [ ] Canon alignment section references specific canon doc numbers, not just "follows canon."
- [ ] Edge cases list specific scenarios, not just "handle edge cases."
- [ ] Out of scope names specific things, not just "future work."

---

## Anti-patterns to avoid in epic writing

| Anti-pattern | Why it fails | What to do instead |
|---|---|---|
| "Standard CRUD" | Every product's CRUD is different | Describe each operation fully |
| "Basic validations" | Which validations? On which fields? | List each field's validation rules |
| "Normal list behavior" | What columns? What sort? What filters? | Specify the list completely |
| "Usual permissions" | There is no universal "usual" | State each role's capabilities |
| "Responsive design" | What is cut on mobile? What is rearranged? | Describe the mobile surface |
| "Handle duplicates" | Prevent? Warn? Merge? Ignore? | State the duplicate strategy |
| "Audit trail" | What is logged? Where is it visible? | Specify logged fields and UI |
| "TBD" without context | Unactionable placeholder | State options, tradeoffs, and who decides |

---

## Relationship to canon

Epics are **downstream of canon**. Canon defines primitives, ownership, pipeline semantics, and hard bans. Epics define product behavior for specific objects and surfaces. An epic may not contradict canon. If an epic discovers a canon gap, it must note it in **Open questions** and reference the relevant canon doc or open decision number.

---

## File naming convention

```
docs/epics/NN-short-name-epic.md
```

- `NN` is a zero-padded sequence number.
- `short-name` is a lowercase-hyphenated object or feature name.
- All epics are markdown.
- Subfolders may be created for epic groups (e.g., `docs/epics/catalog/` for packet and definition epics) but each epic is a single file.
