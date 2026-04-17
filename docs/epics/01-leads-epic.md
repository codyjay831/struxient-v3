# Epic 01 — Lead management

---

## 1. Epic title

Lead management

---

## 2. Purpose

Define the **lead** object in Struxient v3: a prospective customer or job opportunity that has entered the system but has not yet reached a quote. Leads are the upstream entry point to the quote-to-execution pipeline. This epic specifies how leads are created, viewed, edited, assigned, archived, and how they relate to the downstream objects (customers, quotes, jobs) defined by v3 canon.

---

## 3. Why this exists

Without a lead object, prospective work has nowhere to live before quoting begins. Sales and office teams need a place to capture inbound interest — from phone calls, web forms, referrals, or marketing — and track it through qualification to the point where a quote is created. Without explicit lead management:

- Inbound opportunities are tracked in spreadsheets, sticky notes, or personal memory.
- There is no visibility into pipeline volume, source effectiveness, or conversion rates.
- Assignment and follow-up accountability do not exist.
- Duplicate prospects are not detected.
- The transition from "someone called" to "we sent a quote" is undocumented.

Leads exist so that the moment before quoting has structure, accountability, and data.

---

## 4. Canon alignment

**Leads sit upstream of the quote-to-execution pipeline.** The canon documents (`01`–`09`) define the pipeline starting at quote line items. Leads are the **pre-pipeline intake object** — they feed into quote creation but are not themselves quote, packet, or FlowSpec objects.

**Relevant canon references:**

- **`O7` in `10-open-canon-decisions.md`:** "Customer/site identity canonical source — FlowGroup-duplicated fields vs Lead — which is canonical for display, portal, and audit?" This epic defines the lead's own identity fields but does **not** resolve O7. The lead is a **pre-customer** object; whether customer/site records are later sourced from lead data or maintained independently is noted as an open question to be resolved alongside O7.
- **`01-v3-core-thesis.md`:** Trade-first wedge. Leads must support trade-specific context (what kind of work the prospect wants) without requiring the estimator to define scope packets or line items at lead stage.
- **`09-banned-v2-drift-patterns.md`:** No collapsed vocabulary. A lead is not a quote, not a customer, not a job. It must not be overloaded to serve as any of those.

**Canon constraint:** The lead object must not hold commercial truth (that belongs to quote line items), process structure (that belongs to FlowSpec), or execution facts (that belongs to runtime). The lead holds **prospect identity and qualification context**.

---

## 5. User roles involved

| Role | Capabilities |
|---|---|
| **Admin** | Full access: create, view, edit, assign, archive, delete, restore, bulk operations, configure lead sources, view audit history. |
| **Office user (sales / estimator)** | Create, view, edit, assign to self or others (per tenant policy), archive own or assigned leads. Cannot delete. Cannot restore (admin only). |
| **Field user** | View leads assigned to them (read-only list + detail). Cannot create, edit, archive, or delete leads. May add notes if tenant policy allows. |
| **Customer / external** | No access to leads. Customers do not see or interact with the lead object. |

**Tenant-configurable:** Whether office users can reassign leads they do not own. Default: office users can only assign to themselves or reassign leads already assigned to them.

---

## 6. Primary object(s) affected

- **Lead** — the object defined by this epic.
- **Customer** — downstream object a lead may convert into or link to. (Customer epic is separate; this epic defines the relationship interface.)
- **Quote** — downstream object created from a qualified lead. (Quote epic is separate; this epic defines the handoff.)
- **User** — for lead assignment/ownership.
- **Note** (embedded or linked) — for lead-level commentary.

---

## 7. Where it lives in the product

**Desktop / web:**

- **Top-level navigation item:** "Leads" in the primary sidebar/nav. Not nested under quotes or customers.
- **List view:** `/leads` — the default landing page for the Leads section.
- **Detail view:** `/leads/:id` — individual lead detail page.
- **Create:** Accessible from the leads list (primary action button) and from a global "quick create" action if the product supports one.

**Mobile:**

- Leads appear as a top-level section in mobile navigation.
- Mobile surfaces list view (simplified columns) and detail view (single-column stack).
- Lead creation is available on mobile with the same required fields as desktop.

---

## 8. Create flow

### Entry points

1. **"New Lead" button** on the leads list page.
2. **Global quick-create** (if product supports a universal "+" or "New" action) with "Lead" as an option.
3. **API / integration** — leads may be created programmatically via API (web form submission, marketing tool integration, phone system integration). API-created leads follow the same validation rules.

### Step-by-step (UI)

1. User clicks "New Lead."
2. System presents a **create form** (modal or full-page — product design decision, but both must support all required fields).
3. User fills in required fields:
   - **Contact name** — at minimum, a single name field must be populated. See field definitions for structure.
   - **Lead source** — how this lead arrived (dropdown from tenant-configured source list).
4. User may fill in optional fields (see sections 14–15).
5. User clicks "Save" (or "Create Lead" — button label must be specific, not generic "Submit").
6. System validates all fields (see section 16).
7. **On success:**
   - Lead is created with status `new`.
   - Lead is assigned to the creating user by default unless the user explicitly selects a different assignee during creation.
   - System redirects to the new lead's detail view.
   - A toast notification confirms: "Lead created."
   - Audit log entry is written (see section 23).
8. **On validation failure:**
   - Form remains open with inline field-level error messages.
   - No partial save. The lead is not created until all required validations pass.

### Partial information

Leads must be creatable with **minimal information**. The minimum viable lead is:

- A **contact name** (first name alone, last name alone, or a combined display name — at least one name component).
- A **lead source**.

Everything else — email, phone, address, trade interest, notes — is optional at creation. This supports the common case where a phone call comes in and the office user captures a name and call source before details are available.

### Defaults applied at creation

| Field | Default |
|---|---|
| Status | `new` |
| Assigned to | Creating user |
| Created at | Server timestamp (UTC) |
| Priority | `normal` (if priority field is implemented) |

---

## 9. Read / list / detail behavior

### List view

**URL:** `/leads`

**Columns displayed (default):**

| Column | Source | Sortable | Notes |
|---|---|---|---|
| Contact name | `firstName` + `lastName` or `displayName` | Yes | Primary identifier; links to detail view |
| Status | `status` enum | Yes | Shown as a colored badge |
| Lead source | `source` | Yes | |
| Assigned to | `assignedTo` user display name | Yes | |
| Phone | `primaryPhone` | No | Shown if available; masked or hidden per tenant policy |
| Email | `primaryEmail` | No | Shown if available |
| Trade interest | `tradeInterest` | Yes | What kind of work the prospect wants |
| Created date | `createdAt` | Yes | Formatted to tenant timezone; relative ("2 days ago") with absolute on hover |
| Last activity | `updatedAt` or most recent note/status change | Yes | Helps identify stale leads |

**Default sort:** `createdAt` descending (newest first).

**Pagination:** Paginated (not infinite scroll). Default page size: 25. Options: 25, 50, 100. Page count and total count displayed.

**Empty state:** When no leads exist, the list area displays:

- Heading: "No leads yet"
- Body: "Leads track prospective customers before you create a quote. Create your first lead to get started."
- Action button: "New Lead" (same action as the primary create button).

**Empty state (filtered):** When filters produce no results:

- Heading: "No leads match your filters"
- Body: "Try adjusting your filters or search terms."
- Action link: "Clear filters" (resets to default filter state).

### Filters

| Filter | Type | Behavior |
|---|---|---|
| Status | Multi-select dropdown | Options: `new`, `contacted`, `qualified`, `unqualified`, `converted`. Default: `new`, `contacted`, `qualified` (active statuses). |
| Assigned to | Multi-select dropdown (user list) | Filter by one or more assignees. "Unassigned" is an explicit option. |
| Lead source | Multi-select dropdown | From tenant-configured source list. |
| Trade interest | Multi-select dropdown | From tenant-configured trade list. |
| Created date | Date range picker | From/to dates. Presets: "Today", "Last 7 days", "Last 30 days", "This month", "This quarter." |
| Has email | Boolean toggle | Yes/No — filter to leads with or without an email address. |
| Has phone | Boolean toggle | Yes/No — filter to leads with or without a phone number. |

### Search

**Searchable fields:** `firstName`, `lastName`, `displayName`, `primaryEmail`, `primaryPhone`, `companyName`, `notes` (body text).

**Search type:** Substring match, case-insensitive. A search for "john" matches "Johnson" and "john@example.com." Minimum query length: 2 characters.

**Search interaction:** A search bar above the list. Search applies as an additional filter on top of the active filter set.

### Detail view

**URL:** `/leads/:id`

**Layout:** Single-page detail view with the following sections:

**Header area:**
- Contact name (large, primary).
- Status badge (with ability to change status via dropdown — see edit behavior).
- Assigned-to avatar and name.
- Action buttons: "Edit", "Convert to Quote" (or "Create Quote"), "Archive" (or "More" menu containing archive/delete).

**Primary information section:**
- Contact name (first, last).
- Company / business name.
- Primary phone (clickable tel: link).
- Primary email (clickable mailto: link).
- Address (formatted; link to maps).
- Trade interest.
- Lead source.
- Priority (if implemented).

**Description / notes section:**
- A free-text description field (set during create or edit).
- A chronological list of notes (timestamped, attributed to creating user). Notes are append-only from the detail view (add note form at the top or bottom of the list). Individual notes can be edited by their author or an admin within a configurable window (default: 24 hours after creation; after that, notes are immutable). Notes cannot be deleted (audit integrity).

**Activity / history section:**
- Chronological log of status changes, assignment changes, edits. Each entry: timestamp, user, action description. See section 23.

**Related objects section:**
- If this lead has been converted: link to the resulting customer and/or quote(s).
- If there is a linked customer (pre-conversion association): link to that customer.

---

## 10. Edit behavior

### What is editable

All lead fields (required and optional) are editable after creation **except:**

- `id` — system-generated, immutable.
- `createdAt` — system-generated, immutable.
- `createdBy` — system-generated, immutable.
- `tenantId` — system-generated, immutable.

### Edit interaction

- **Inline edit on detail view** for quick single-field changes (status, assigned-to, phone, email).
- **Full edit form** (modal or page) accessible from "Edit" button on detail view for multi-field edits. The edit form pre-populates all current values.

### Validation on edit

Same validations as creation (see section 16). If an edit makes a required field empty, the save is rejected with an inline error.

### Who can edit

- **Admin:** Any lead.
- **Office user:** Leads assigned to them, or unassigned leads. Tenant policy may extend this to "any lead" — default is assigned/unassigned only.
- **Field user:** Cannot edit leads (except adding notes if tenant policy allows — see section 9 detail view).

### What happens on edit

- `updatedAt` is set to server timestamp.
- `updatedBy` is set to the editing user.
- An audit log entry is written with the old and new values of changed fields (see section 23).
- A toast confirms: "Lead updated."

### Reassignment

Changing the `assignedTo` field is treated as a standard edit. When a lead is reassigned:

- The new assignee sees the lead in their assigned leads view.
- The previous assignee no longer sees it in their "My Leads" filtered view (but can still find it via "All Leads" if they have permission).
- An audit entry records the reassignment: who reassigned, from whom, to whom.
- A notification is sent to the new assignee (see section 22).

### Concurrency

At MVP scale, **last-write-wins** is acceptable. If two users edit the same lead simultaneously, the last save overwrites. No optimistic locking is required initially. If the lead object later gains high-concurrency use cases, this decision should be revisited.

---

## 11. Archive behavior

### What archive means

Archiving a lead **hides it from the default list view** but does not delete it. Archived leads:

- Do not appear in the leads list when the default status filter is active (default filters exclude archived leads).
- Are accessible via a status filter that includes "Archived" or via a dedicated "Archived Leads" view/filter toggle.
- Remain visible on any related object that links to them (e.g., if a customer was somehow linked to this lead before archiving, the link still resolves — it displays the lead name with an "Archived" indicator).
- Retain all their data, notes, and audit history.
- Can be restored (see section 13).

### Who can archive

- **Admin:** Any lead.
- **Office user:** Leads assigned to them, or unassigned leads.
- **Field user:** Cannot archive.

### Archive flow

1. User clicks "Archive" from the lead detail view (or selects one or more leads in the list view and chooses "Archive" from a bulk actions menu).
2. System shows a confirmation dialog: "Archive this lead? It will be hidden from your active leads list but can be restored later."
3. On confirm:
   - Lead status is set to `archived`.
   - `archivedAt` is set to server timestamp.
   - `archivedBy` is set to the acting user.
   - Audit log entry is written.
   - User is returned to the leads list (or stays on detail view with an "Archived" banner and a "Restore" button).

### Cascade

Archiving a lead does not cascade to any related objects. If a quote was created from this lead, the quote is unaffected.

### Bulk archive

Supported from the list view. User selects multiple leads via checkboxes, then clicks "Archive" from the bulk actions bar. Confirmation dialog states the count: "Archive 5 leads?" Same rules apply per lead.

---

## 12. Delete behavior

### Whether hard delete is allowed

**Hard delete is restricted to admins only** and only under specific conditions:

- The lead has **no** linked quotes, customers, or jobs.
- The lead has **never** been in `converted` status.

If any of those conditions are not met, delete is blocked. The UI disables the delete action and shows a tooltip: "This lead cannot be deleted because it has linked records. Archive it instead."

### Delete flow

1. Admin clicks "Delete" from the lead detail view (inside a "More" or "Danger zone" menu — not a primary action button).
2. System checks eligibility (no linked records, never converted).
3. If eligible, system shows a confirmation dialog: "Permanently delete this lead? This action cannot be undone. All notes and history for this lead will be removed."
4. Admin must type the lead's contact name (or a confirmation word like "DELETE") to confirm. This prevents accidental deletion.
5. On confirm:
   - Lead record and all associated notes are **hard deleted** from the database.
   - Audit log retains a tombstone entry: "Lead [name] (ID: [id]) deleted by [user] at [timestamp]." The tombstone does not retain PII beyond what was in the audit log at the time of deletion.
6. User is redirected to the leads list.

### Who can delete

- **Admin only.** No other role can hard delete leads.

---

## 13. Restore behavior

### What can be restored

Archived leads can be restored. Hard-deleted leads cannot be restored.

### Who can restore

- **Admin:** Any archived lead.
- **Office user:** Cannot restore (admin-only action). This prevents an office user from archiving and restoring the same lead repeatedly to reset activity metrics.

### Restore flow

1. Admin navigates to an archived lead (via the "Archived" filter on the leads list or by following a direct link).
2. Admin clicks "Restore" (visible on the detail view when lead status is `archived`).
3. System shows a confirmation dialog: "Restore this lead? It will return to your active leads list with its previous status."
4. On confirm:
   - Lead status is set to the status it held **before archiving** (stored in `statusBeforeArchive`). If that status was `converted`, the lead is restored as `converted`.
   - `archivedAt` and `archivedBy` are cleared.
   - Audit log entry is written: "Lead restored by [user]."
   - The lead reappears in the active leads list.

### What happens to relationships on restore

If other records were created or linked while this lead was archived, those links remain. Restoring does not alter any related objects.

---

## 14. Required fields

| Field | Type | Why required |
|---|---|---|
| `contactName` (at least one of `firstName` or `lastName`, or a `displayName`) | String | A lead must be identifiable by name. Without a name, there is no meaningful record to follow up on. |
| `source` | Enum (from tenant-configured list) | Every lead must have a tracked origin so the business can measure which channels produce opportunities. |

Only two fields are required at creation. This keeps the barrier to lead capture as low as possible while ensuring minimum usefulness.

---

## 15. Optional fields

| Field | Type | Default | Why optional |
|---|---|---|---|
| `firstName` | String | `null` | Structured name component. Optional because sometimes only a last name or business name is known. |
| `lastName` | String | `null` | Structured name component. Same rationale. |
| `displayName` | String | Auto-generated from `firstName` + `lastName` if both present; otherwise whichever is provided | Computed display label. Can be manually overridden. |
| `companyName` | String | `null` | The prospect's business name. Not all leads are businesses. |
| `primaryEmail` | String | `null` | Not always known at intake. |
| `secondaryEmail` | String | `null` | Alternate contact email. |
| `primaryPhone` | String | `null` | Not always known at intake. |
| `secondaryPhone` | String | `null` | Alternate contact phone. |
| `address.street1` | String | `null` | Job site or mailing address. Often not known initially. |
| `address.street2` | String | `null` | |
| `address.city` | String | `null` | |
| `address.state` | String | `null` | |
| `address.zip` | String | `null` | |
| `address.country` | String | Tenant default country | |
| `tradeInterest` | Enum or string (tenant-configured) | `null` | What trade/service the prospect is interested in (e.g., "Electrical", "Solar", "HVAC"). Helps route and qualify. |
| `description` | Text (long) | `null` | Free-text summary of the opportunity or initial conversation. |
| `priority` | Enum: `low`, `normal`, `high`, `urgent` | `normal` | Helps office team prioritize follow-up. |
| `estimatedValue` | Decimal (currency) | `null` | Rough dollar estimate of potential job value. Used for pipeline reporting. Not a quote — purely an estimate for forecasting. |
| `assignedTo` | User ID (foreign key) | Creating user | Who is responsible for following up on this lead. |
| `referralSource` | String | `null` | If the lead source is "Referral", who referred them. Free text. |
| `tags` | Array of strings | `[]` (empty array) | Tenant-defined labels for ad-hoc categorization. |

---

## 16. Field definitions and validations

| Field | Data type | Max length | Format / constraints | Uniqueness | System or user |
|---|---|---|---|---|---|
| `id` | UUID | — | System-generated | Globally unique | System |
| `tenantId` | UUID | — | Must reference a valid tenant | — | System |
| `firstName` | String | 100 chars | Trimmed whitespace. No leading/trailing spaces stored. Unicode allowed. | Not unique | User |
| `lastName` | String | 100 chars | Same as `firstName` | Not unique | User |
| `displayName` | String | 200 chars | Auto-computed from first + last if not manually set. If manually set, manual value wins. | Not unique | User (with auto-fallback) |
| `companyName` | String | 200 chars | Trimmed whitespace. | Not unique | User |
| `primaryEmail` | String | 254 chars | Must be a valid email format (RFC 5322 simplified) if provided. Stored lowercase. | Not unique (duplicates handled via detection, not enforcement — see edge cases) | User |
| `secondaryEmail` | String | 254 chars | Same as `primaryEmail` | Not unique | User |
| `primaryPhone` | String | 30 chars | Stored as digits + optional formatting characters. No validation beyond non-empty if provided. Display formatting applied at render time per tenant locale. | Not unique | User |
| `secondaryPhone` | String | 30 chars | Same as `primaryPhone` | Not unique | User |
| `address.street1` | String | 200 chars | Trimmed. | — | User |
| `address.street2` | String | 200 chars | Trimmed. | — | User |
| `address.city` | String | 100 chars | Trimmed. | — | User |
| `address.state` | String | 100 chars | Free text (not enum) to support international addresses. | — | User |
| `address.zip` | String | 20 chars | No format enforcement (international postal codes vary). | — | User |
| `address.country` | String | 2 chars (ISO 3166-1 alpha-2) | Must be valid ISO country code if provided. Defaults to tenant default. | — | User |
| `source` | Enum (tenant-configured) | — | Must be one of the values in the tenant's lead source list. The tenant configures this list via settings. Minimum seed list: `phone_call`, `web_form`, `referral`, `walk_in`, `marketing`, `other`. | — | User |
| `tradeInterest` | Enum or tag (tenant-configured) | — | Must be from tenant's trade list if enforced; or free text if tenant allows it. | — | User |
| `description` | Text | 5000 chars | No format constraints. Plain text. | — | User |
| `priority` | Enum | — | `low`, `normal`, `high`, `urgent` | — | User |
| `estimatedValue` | Decimal | — | Non-negative. Two decimal places. Currency is tenant-level setting (not per-lead). | — | User |
| `assignedTo` | UUID (FK to User) | — | Must reference a valid active user in the tenant. `null` means unassigned. | — | User |
| `referralSource` | String | 200 chars | Free text. | — | User |
| `tags` | Array of strings | 50 tags max; each tag 50 chars max | Lowercase, trimmed, deduplicated. | — | User |
| `status` | Enum | — | `new`, `contacted`, `qualified`, `unqualified`, `converted`, `archived`. See section 17. | — | System + User |
| `statusBeforeArchive` | Enum | — | Same values as `status` minus `archived`. Stored when archiving, cleared on restore. | — | System |
| `createdAt` | Timestamp (UTC) | — | Server-set at creation. Immutable. | — | System |
| `createdBy` | UUID (FK to User) | — | Set at creation. Immutable. | — | System |
| `updatedAt` | Timestamp (UTC) | — | Server-set on every update. | — | System |
| `updatedBy` | UUID (FK to User) | — | Set on every update. | — | System |
| `archivedAt` | Timestamp (UTC) | — | Set when archived. Cleared on restore. `null` when active. | — | System |
| `archivedBy` | UUID (FK to User) | — | Set when archived. Cleared on restore. | — | System |
| `convertedAt` | Timestamp (UTC) | — | Set when status moves to `converted`. Immutable after set. | — | System |
| `convertedBy` | UUID (FK to User) | — | Set when status moves to `converted`. | — | System |
| `convertedToQuoteId` | UUID (FK to Quote) | — | Set when a quote is created from this lead. `null` until conversion. | — | System |
| `convertedToCustomerId` | UUID (FK to Customer) | — | Set when a customer record is created or linked during conversion. `null` until conversion. | — | System |

---

## 17. Status / lifecycle rules

### Statuses

| Status | Meaning | Set by |
|---|---|---|
| `new` | Lead has been created but no follow-up action has been taken. | System (at creation) |
| `contacted` | Someone on the team has reached out to the prospect. | User (manual status change) |
| `qualified` | The lead has been evaluated and determined to be a real opportunity worth quoting. | User (manual status change) |
| `unqualified` | The lead has been evaluated and determined not to be a fit (wrong area, scope too small, not ready, etc.). | User (manual status change) |
| `converted` | A quote (and optionally a customer record) has been created from this lead. | System (when "Convert to Quote" action completes) |
| `archived` | The lead is no longer active and has been archived. | System (when user archives the lead) |

### Allowed transitions

| From | To | Trigger |
|---|---|---|
| `new` | `contacted` | User changes status |
| `new` | `qualified` | User changes status (skip contacted if evaluation was immediate) |
| `new` | `unqualified` | User changes status |
| `new` | `converted` | User triggers "Convert to Quote" |
| `new` | `archived` | User archives the lead |
| `contacted` | `qualified` | User changes status |
| `contacted` | `unqualified` | User changes status |
| `contacted` | `converted` | User triggers "Convert to Quote" |
| `contacted` | `archived` | User archives the lead |
| `qualified` | `contacted` | User changes status (revert — prospect went cold, re-reaching out) |
| `qualified` | `unqualified` | User changes status |
| `qualified` | `converted` | User triggers "Convert to Quote" |
| `qualified` | `archived` | User archives the lead |
| `unqualified` | `contacted` | User changes status (re-engagement) |
| `unqualified` | `qualified` | User changes status (circumstances changed) |
| `unqualified` | `archived` | User archives the lead |
| `converted` | `archived` | User archives the lead (rare — lead was converted but the resulting quote was abandoned) |
| `archived` | (previous status) | Admin restores the lead |

### Disallowed transitions

- `converted` → `new`, `contacted`, `qualified`, or `unqualified`. Once converted, the lead cannot return to pre-conversion statuses. The linked quote is the next stage of the pipeline. If the quote is abandoned, the lead can be archived, but it cannot be "un-converted."
- Any status → `converted` without creating or linking a quote. The `converted` status is system-set as a side effect of the "Convert to Quote" action — it is not a user-selectable dropdown option on its own.

### Status on creation

Always `new`.

---

## 18. Search / filter / sort behavior

### Search

| Aspect | Specification |
|---|---|
| Searchable fields | `firstName`, `lastName`, `displayName`, `primaryEmail`, `primaryPhone`, `companyName`, `description` (body text of description field), note text |
| Search type | Case-insensitive substring match |
| Minimum query length | 2 characters |
| Debounce | 300ms after typing stops before query fires |
| Result behavior | Filters the list view in place; does not navigate to a separate search results page |
| Empty search results | Shows the filtered empty state (see section 9) |

### Filters

See section 9 (list view) for the full filter table. Summary:

- **Status:** Multi-select. Default: active statuses only (`new`, `contacted`, `qualified`).
- **Assigned to:** Multi-select from user list. Includes "Unassigned" option.
- **Lead source:** Multi-select from tenant source list.
- **Trade interest:** Multi-select from tenant trade list.
- **Created date:** Date range with presets.
- **Has email / Has phone:** Boolean toggles.

Filters combine with AND logic. Within a multi-select filter, values combine with OR logic (e.g., status = `new` OR `contacted`).

### Sort

**Sortable columns:** Contact name, status, lead source, assigned to, trade interest, created date, last activity.

**Default sort:** `createdAt` descending.

**Sort interaction:** Click column header to sort ascending; click again for descending; click again to remove sort (return to default). Only one sort column at a time.

### Saved views / filters

Out of scope for this epic. See section 26.

---

## 19. Relationships to other objects

### Lead → Customer

- **Cardinality:** Many-to-one (many leads can link to one customer) or one-to-one (one lead creates one customer at conversion). Both are valid patterns — the chosen model is:
  - At conversion, the system checks if a customer with matching identity (name + email or name + phone + address) already exists in the tenant.
  - If a match is found, the lead links to the existing customer (`convertedToCustomerId`).
  - If no match is found, a new customer record is created from the lead's contact information, and the lead links to that new customer.
  - This link is informational and immutable after conversion. Editing the lead's contact info after conversion does not update the customer. Editing the customer does not update the lead.

### Lead → Quote

- **Cardinality:** One-to-many. A lead can result in multiple quotes (e.g., the prospect wants separate quotes for different scopes). Each quote records which lead it originated from.
- **Relationship creation:** Set during the "Convert to Quote" action. The first quote sets `convertedToQuoteId` on the lead; subsequent quotes from the same lead add to the association but do not overwrite the first conversion reference.
- **Referential integrity:** If a quote is deleted (which is its own epic's rules), the lead remains. The link becomes a broken reference that the system handles gracefully (shows "Quote was deleted" in the lead's related objects section).

### Lead → Job

- **No direct relationship.** Leads do not link directly to jobs. The path is Lead → Quote → (activation) → Job. This aligns with canon: activation creates the job anchor from a signed quote, not from a lead.

### Lead → FlowGroup

- **At conversion**, the system should create or link a **FlowGroup** for the site/project. This is the anchor for `PreJobTask` records (site surveys, utility checks) and eventually for the Quote and Job.
- Canon open decision O7 addresses customer/site identity display rules. The FlowGroup relationship is now established at lead conversion.

### Lead → PreJobTask (via FlowGroup)

- **Indirect relationship.** When a lead is qualified and a `FlowGroup` is created, the office user can create **PreJobTask** records (e.g., "Schedule Site Survey") on that FlowGroup. These tasks appear in the field technician's Work Station with a `PRE_JOB` badge.
- The lead itself does not own `PreJobTask` records — they are anchored to the site-level `FlowGroup`, not the person-level lead.

### Lead → User (assignment)

- **Cardinality:** Many-to-one. A lead has zero or one assigned user. A user can have many assigned leads.
- **Integrity:** If the assigned user is deactivated, the lead retains the assignment but the system flags it as "Assigned to inactive user" in the list view and detail view. Admin can reassign.

### Lead → Notes

- **Cardinality:** One-to-many. A lead has zero or more notes. Notes belong to exactly one lead.
- **Integrity:** Notes are never orphaned. If a lead is hard-deleted, its notes are deleted with it. If a lead is archived, notes remain accessible on the archived lead's detail view.

---

## 20. Permissions / visibility

### Object-level permissions

| Action | Admin | Office user | Field user |
|---|---|---|---|
| View leads list | All leads in tenant | All leads in tenant | Only leads assigned to them |
| View lead detail | Any lead | Any lead | Only leads assigned to them |
| Create lead | Yes | Yes | No |
| Edit lead | Any lead | Assigned or unassigned leads (tenant-configurable: any lead) | No (except adding notes if tenant policy allows) |
| Change status | Any lead | Assigned or unassigned leads | No |
| Reassign lead | Any lead | Assigned to self, or reassign own leads to others. Tenant-configurable: reassign any lead. | No |
| Archive lead | Any lead | Assigned or unassigned leads | No |
| Restore lead | Any lead | No | No |
| Delete lead | Yes (with conditions — see section 12) | No | No |
| Bulk operations | Yes | Yes (within their edit permissions) | No |
| Export leads | Yes | Yes (tenant-configurable) | No |
| View audit history | Yes | Yes (for leads they can view) | No |

### Tenant-configurable permission knobs

- Whether office users can edit/reassign any lead or only assigned/unassigned leads.
- Whether field users can add notes to assigned leads.
- Whether office users can export lead data.

### Row-level visibility note

Field users see only their assigned leads. This is not a filter — leads not assigned to them are completely invisible (API returns only their leads; UI shows only their leads).

---

## 21. Mobile behavior

### What is available on mobile

| Capability | Available | Notes |
|---|---|---|
| View leads list | Yes | Simplified layout: contact name, status badge, source. Swipe or tap for detail. |
| View lead detail | Yes | Single-column stacked layout. All sections visible via scroll. |
| Create lead | Yes | Same required/optional fields. Keyboard-optimized form. Phone field uses `tel` input type for dialer keyboard. |
| Edit lead | Yes | Inline edit on detail view. Full edit form via "Edit" action. |
| Change status | Yes | Dropdown on detail view. |
| Add note | Yes | Note input at bottom of detail view. |
| Archive lead | Yes | Via action menu on detail view. |
| Delete lead | No | Admin-only action restricted to desktop. |
| Restore lead | No | Admin-only action restricted to desktop. |
| Bulk actions | No | Too error-prone on small screens. |
| Search | Yes | Search bar at top of list view. |
| Filters | Yes | Collapsed filter panel; tap to expand. Fewer filter options visible by default (status, assigned to). Full filters behind "More filters." |

### Offline behavior

Out of scope for MVP. Leads require network connectivity. If the user is offline, the app displays a connectivity warning and does not allow create/edit operations. The list view may display a cached snapshot if the app architecture supports it, but this is not a requirement for this epic.

### Layout expectations

- **List view:** Single-column card list. Each card shows contact name (bold), status badge, source tag, and a secondary line with phone or email if available. Tap opens detail.
- **Detail view:** Full-width stacked sections. "Call" and "Email" action buttons at the top of the detail view that trigger native device actions (open phone dialer, open email client).

---

## 22. Notifications / side effects

### When a lead is created

- No notification (the creating user is already aware).
- If the lead is created via API (web form), the assigned user (default: tenant-configured form handler or admin) receives an in-app notification: "New lead from web form: [contact name]."

### When a lead is assigned or reassigned

- The new assignee receives an in-app notification: "You have been assigned a lead: [contact name]."
- Email notification is tenant-configurable (default: off). If enabled, the assignee receives an email with lead name, source, and a link to the lead detail view.

### When a lead status changes

- No notification by default. Status changes are tracked in audit history.
- If a lead is moved to `qualified`, the assigned user's manager (if organizational hierarchy exists) may receive a notification. This is out of scope for MVP — listed here as a future consideration.

### When a lead is converted

- The assigned user receives an in-app notification: "Lead [contact name] has been converted. Quote [quote number] created."
- The linked quote appears in the user's quote list.

### When a lead is archived

- No notification (the archiving user is already aware).

### Webhook / integration triggers

- Leads support a webhook event model: `lead.created`, `lead.updated`, `lead.status_changed`, `lead.converted`, `lead.archived`, `lead.deleted`. Payload includes the lead object (sanitized per tenant PII policy).
- Webhook configuration and delivery mechanics are out of scope for this epic (covered by an integrations epic).

---

## 23. Audit / history requirements

### What is logged

Every mutation to a lead record is logged:

| Event | Logged data |
|---|---|
| Lead created | All initial field values, creating user, timestamp |
| Field edited | Field name, old value, new value, editing user, timestamp |
| Status changed | Old status, new status, changing user, timestamp |
| Assigned / reassigned | Old assignee, new assignee, changing user, timestamp |
| Note added | Note ID, note author, timestamp (note content is in the note record, not duplicated in audit) |
| Note edited | Note ID, old content, new content, editing user, timestamp |
| Lead archived | Archiving user, timestamp, status before archive |
| Lead restored | Restoring user, timestamp, restored-to status |
| Lead deleted | Deleting user, timestamp, tombstone summary (lead name, ID) |
| Converted | Converting user, timestamp, linked quote ID, linked customer ID |

### Where audit is visible

- **Lead detail view:** An "Activity" or "History" tab/section showing a chronological feed of all audit events for that lead. Oldest at bottom, newest at top (or toggle).
- **Global audit log:** If the product has a tenant-wide audit log, lead events appear there filterable by object type "Lead." (Global audit log is out of scope for this epic's build but the lead audit data must be structured to support it.)

### Retention

Audit records are retained for the lifetime of the lead. If a lead is hard-deleted, audit records for that lead are retained as tombstones (without PII beyond what was in the audit at write time) for a tenant-configurable period (default: 7 years for compliance). After that period, tombstones may be purged.

---

## 24. Edge cases

### Duplicate leads

- **Detection:** When a user creates a lead, the system checks for potential duplicates by matching on: (a) `primaryEmail` exact match, (b) `primaryPhone` exact match (normalized digits only), (c) `firstName` + `lastName` + `address.zip` combination match.
- **Behavior on match:** The system shows a warning before save: "A lead with similar information already exists: [name, email/phone]. Do you want to create this lead anyway?" The user can proceed (creates the lead) or cancel (returns to form). Duplicate leads are allowed — the system warns but does not block.
- **No automatic merge.** Merging duplicate leads is out of scope for this epic (see section 26).

### Very long names or field values

- Fields exceeding max length are rejected at validation with a specific message: "[Field name] must be [max] characters or fewer. You entered [actual] characters."
- Unicode characters (accents, CJK, emoji) are permitted in name and text fields. Character count is by Unicode codepoint, not byte length.

### Lead with no phone and no email

- This is allowed. The lead is still useful with just a name and source (e.g., walk-in, referral where follow-up is in person). The list view shows empty cells for phone and email. The detail view shows placeholder text: "No phone number" / "No email address" with an "Add" link.

### Lead assigned to a user who is later deactivated

- The lead retains the assignment. The list view and detail view show the user's name with an "(Inactive)" badge. Admin can reassign. The system does not auto-reassign — deactivated users' leads remain in place until manually handled.

### Lead created via API with missing required fields

- API returns a 422 Unprocessable Entity response with a body listing which required fields are missing. The lead is not created.

### Lead created via API with invalid field values

- API returns a 422 with a body listing which fields have invalid values and what the constraints are. The lead is not created.

### Concurrent edits

- Last write wins at MVP (see section 10). If User A edits the phone number and User B edits the email simultaneously, both edits succeed independently. If both edit the same field, the last save overwrites.

### Bulk operations at scale

- Bulk archive is supported for up to 100 leads at a time. If more than 100 are selected, the system shows: "You can archive up to 100 leads at a time. Please reduce your selection."
- Bulk delete is not supported (delete is rare and high-ceremony).

### Converting a lead that has already been converted

- The "Convert to Quote" action remains available on a `converted` lead. This creates an additional quote linked to the same lead. The lead's `convertedToQuoteId` retains the first quote reference. The additional quote records the lead origin in its own metadata. This supports the scenario where a prospect wants a second quote for different scope.

### Importing leads

- Bulk import (CSV/Excel) is out of scope for this epic (see section 26). When implemented, the import process must apply the same validation and duplicate detection rules as manual creation.

### Timezone handling

- `createdAt`, `updatedAt`, `archivedAt`, `convertedAt` are stored in UTC. Display formatting converts to the tenant's configured timezone. The lead object does not have a per-lead timezone field.

### Leads from before the system was set up (historical leads)

- If tenants need to import historical leads, they must go through the bulk import mechanism (out of scope) or API. Historical leads are created with `source` = a tenant-configured value like `historical_import` and `createdAt` set to the import timestamp (not the historical date — the system does not allow backdating `createdAt`). A separate `originalDate` optional field could be considered but is not part of this epic.

---

## 25. What must not happen

1. **A lead must not become a quote substitute.** Leads do not carry line items, scope packets, pricing, or execution modes. If someone needs to define commercial scope, they must create a quote. The lead is pre-commercial.

2. **A lead must not become a customer substitute.** Leads have contact information, but the customer record (once created) is the canonical customer identity for quotes, jobs, and billing. Lead contact fields are a snapshot of what was known at lead time.

3. **A lead must not hold process or execution state.** No FlowSpec binding, no node assignment, no runtime task instances. This is canon.

4. **Collapsed vocabulary.** A lead is not referred to as a "prospect," "opportunity," "contact," or "account" interchangeably in the UI. The v3 product uses "Lead" consistently. Internal code may use "lead" in all identifiers — no aliasing.

5. **Silent deletion.** Leads must not be silently deleted by any automated process (cleanup jobs, archival sweeps). Deletion is always user-initiated and audited.

6. **Automatic status changes without user awareness.** The system does not auto-advance lead status based on time or inactivity. Status changes are explicit user actions (except `converted`, which is set by the conversion action, and `archived`, which is set by the archive action).

7. **Lead data leaking to customer portal.** Customers never see the lead object, the lead's internal notes, priority, estimated value, or any lead-specific metadata. The customer's view of the relationship begins at the quote stage.

8. **PII exposure in exports or webhooks without tenant consent.** Lead exports and webhook payloads must respect tenant PII policies. Email and phone are included only if the tenant has not restricted PII in exports.

---

## 26. Out of scope

| Out-of-scope item | Why | Where it will be covered |
|---|---|---|
| Lead merge (deduplication) | Complex UX; not required for MVP intake | Future epic: lead merge |
| Bulk import (CSV / Excel) | Separate epic for import pipeline, validation, error handling | Future epic: data import |
| Saved views / custom list configurations | Cross-cutting feature, not lead-specific | Future epic: saved views |
| Lead scoring (automatic qualification) | Requires analytics / ML infrastructure | Future epic: lead scoring |
| Marketing automation integration (beyond webhooks) | Integration-specific; not core lead object | Future epic: marketing integrations |
| Lead forms (embeddable web forms) | Separate build for form builder, hosting, submission pipeline | Future epic: lead capture forms |
| Customer object definition | Separate epic | Epic: customer management |
| Quote creation flow | Separate epic; this epic defines the handoff point | Epic: quoting |
| FlowGroup / site relationship | Blocked by canon open decision O7 | Resolved with O7 |
| Reporting / dashboard widgets for leads | Cross-cutting analytics feature | Future epic: reporting |
| Lead-to-lead relationships (e.g., spouse, business partner) | Not required for trade-first MVP | Future consideration |
| Custom fields (tenant-defined fields beyond the standard set) | Cross-cutting custom fields feature | Future epic: custom fields |
| Workflow automation (e.g., auto-assign based on rules, auto-send email on status change) | Requires automation engine | Future epic: workflow automation |

---

## 27. Open questions

### OQ1 — Customer record creation at conversion: create-always vs match-or-create

**Question:** When a lead is converted, should the system always create a new customer record, or should it attempt to match an existing customer (by email, phone, or name+address) and link to that?

**Options:**
- **(A) Always create:** Simple, no ambiguity, but creates duplicates if the same person submits multiple leads.
- **(B) Match-or-create:** Smarter, avoids duplicates, but matching rules can produce false positives (especially with common names). Requires a "Did you mean this customer?" UI step during conversion.

**Recommendation:** Option B (match-or-create) with a confirmation step. The system proposes a match; the user confirms or overrides.

**Who decides:** Product owner.

### OQ2 — Relationship to canon open decision O7

**Question:** Once O7 (Customer/site identity canonical source) is resolved, does the lead's contact information feed into the canonical customer/site record, or is it always a copy?

**Impact:** If leads feed canonical customer data, then lead contact edits after conversion might need to propagate (or explicitly not propagate). If leads are always a copy, the answer is simpler but means manual re-entry if the lead had the most complete data.

**Who decides:** Product owner + architect, in conjunction with O7 resolution.

### OQ3 — Estimated value currency

**Question:** Is `estimatedValue` always in the tenant's base currency, or should leads support per-lead currency?

**Recommendation:** Tenant base currency only at MVP. Per-lead currency is a multi-currency feature that belongs in a later epic.

**Who decides:** Product owner.

### OQ4 — Lead source configurability scope

**Question:** How configurable is the lead source list? Is it a fixed enum that the product ships, a tenant-configurable list with a seed, or fully free-text?

**Recommendation:** Tenant-configurable list with a product-provided seed list. The seed list (`phone_call`, `web_form`, `referral`, `walk_in`, `marketing`, `other`) is created for new tenants. Tenants can add, rename, and deactivate sources. They cannot delete sources that are in use on existing leads.

**Who decides:** Product owner.
