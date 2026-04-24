# Epic 07 — Quotes (shell)

---

## 1. Epic title

Quotes (shell / container)

---

## 2. Purpose

Define the **quote** as the **stable container** for **versioned proposals** under a **customer** and **FlowGroup**. The quote shell carries **identity**, **sales status**, and **navigation context** while **quote versions** (epic 08) carry **commercial truth** and **freeze snapshots**. This epic specifies how quotes are created, listed, viewed, edited, archived, deleted, and restored as a first-class product object.

---

## 3. Why this exists

Users need a **persistent object** to:

- Open from a list and recognize by number and customer
- View version history and navigate between proposals
- Attach files and notes that span revisions
- Track overall sales status across the quoting lifecycle
- Navigate from CRM (customer/project) to commercial work

Without a quote shell, versioned proposals float without a stable home. Users cannot find, organize, or track their commercial pipeline.

---

## 4. Canon alignment

- **`02-core-primitives`:** Line items sell; the quote shell **does not** own reusable scope definitions or commercial truth (those live on quote versions and line items).
- **`03-quote-to-execution`:** Send/sign/activation reference **quote version**, not the mutable shell alone. The shell is the navigational anchor; the version is the truth carrier.
- **`09-banned-v2-drift`:** No collapsed vocabulary. A quote is not a job, not a lead, not a customer. The shell does not become a mini-CRM.

---

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Admin** | Full access: create, view, edit, archive, restore, delete, void/cancel policies. Can see all quotes in tenant. |
| **Office / estimator** | Create quotes, view all quotes in tenant, edit quotes they own or are assigned to (tenant-configurable: any quote). Archive own or assigned quotes. Cannot delete unless admin. |
| **Field user** | Read-only on assigned jobs' originating quote link. Cannot create, edit, or archive quotes. Sees quote number and status only — not commercial detail unless tenant extends. |
| **Customer** | No direct access to the **internal** quote shell. Customers see the **sent version** via portal (epic 54). They never see draft versions, internal notes, or sales status. |

**Tenant-configurable:** Whether office users can edit/archive quotes they don't own. Default: own or assigned only.

---

## 6. Primary object(s) affected

- **Quote** — the object defined by this epic.
- **QuoteVersion** — child object created automatically when a quote is created (epic 08).
- **Customer** — required parent relationship.
- **FlowGroup** — required parent relationship (site/project anchor).
- **Lead** — optional back-link when quote originates from lead conversion.

**Schema note (repo truth):** `Quote.leadId` is implemented in Prisma as an optional FK to `Lead` (same migration as the minimal `Lead` table). **Application code** does not yet populate it; all existing quotes and new shells keep `leadId` **NULL** until a later convert/shell slice sets it.

---

## 7. Where it lives in the product

**Desktop / web:**

- **Top-level navigation item:** "Quotes" in the primary sidebar/nav. Not nested under customers or jobs.
- **List view:** `/quotes` — the default landing page for the Quotes section.
- **Detail view:** `/quotes/:quoteId` — individual quote detail page showing version history and shell-level information.
- **Create:** Accessible from the quotes list (primary action button), from a customer detail page ("New Quote" action), from a FlowGroup detail page ("New Quote" action), and from the lead conversion flow.

**Deep link behavior:** `/quotes/:quoteId` without a version ID redirects to:
- The **current draft version** if one exists (opens editor — epic 11).
- The **latest sent version** if no draft exists (opens read-only sent view).
- The **quote detail shell page** if no versions have been sent and no draft is in progress (should not normally happen — a quote always has at least one version).

**Mobile:**

- Quotes appear in a top-level "Quotes" section in mobile navigation (or under a "Sales" hub if grouped).
- Mobile surfaces list view (simplified columns) and detail view (single-column stack).
- Quote creation is available on mobile with the same required fields.
- Heavy editing (line items, groups, structured inputs) is desktop-first (epic 11).

---

## 8. Create flow

### Entry points

1. **"New Quote" button** on the quotes list page.
2. **"New Quote" action** on a customer detail page (pre-fills customer).
3. **"New Quote" action** on a FlowGroup detail page (pre-fills customer and FlowGroup).
4. **Lead conversion** — when converting a lead (epic 01), a quote is created with customer and lead linkage.
5. **API** — quotes may be created programmatically via API with the same validation rules.

### Step-by-step (UI)

1. User clicks "New Quote."
2. System presents a **create form** (modal or full-page).
3. User selects **customer** (required):
   - Searchable dropdown filtered to active customers in tenant.
   - If no customers exist, the dropdown shows "No customers found" with a "+ Create customer" inline action (opens customer quick-create — epic 02). After creating the customer, the form returns with the new customer pre-selected.
   - If the customer was pre-filled from a customer detail page or lead conversion, the field shows the selected customer and allows changing it.
4. User selects **FlowGroup / project** (required):
   - Searchable dropdown filtered to FlowGroups belonging to the selected customer. Updates when customer changes.
   - If no FlowGroups exist for this customer, the dropdown shows "No projects found" with a "+ Create project" inline action (opens FlowGroup quick-create — epic 03). After creating the FlowGroup, the form returns with the new FlowGroup pre-selected.
   - If a FlowGroup was pre-filled from a FlowGroup detail page, the field shows the selected project.
5. **Validation:** Customer and FlowGroup must belong to the same tenant. FlowGroup's `customerId` must match the selected customer. If the FlowGroup is archived, the create is blocked with: "This project is archived. Restore it or select a different project."
6. User may fill in optional fields:
   - **Internal nickname** — free text, helps distinguish quotes for the same customer/project.
   - **Tags** — multi-select from tenant-configured tag list or free-text entry.
   - **Owner** — defaults to the creating user; dropdown of active users in tenant.
   - **Lead link** — if created from lead conversion, this is auto-populated and read-only.
7. User clicks "Create Quote."
8. **On success:**
   - Quote is created with a system-generated `quoteNumber`.
   - An initial QuoteVersion (v1) is created in `draft` status (epic 08).
   - `salesStatus` is set to `draft`.
   - System redirects to the quote editor (epic 11) with the new draft version open.
   - A toast notification confirms: "Quote [quoteNumber] created."
   - Audit log entry is written: `quote.created`.
9. **On validation failure:**
   - Form remains open with inline field-level error messages.
   - No partial save. The quote is not created until all required validations pass.

### Defaults applied at creation

| Field | Default |
|-------|---------|
| `salesStatus` | `draft` |
| `ownerUserId` | Creating user |
| `quoteNumber` | Auto-generated per tenant sequence (see §16) |
| `createdAt` | Server timestamp (UTC) |
| `createdBy` | Creating user |

---

## 9. Read / list / detail behavior

### List view

**URL:** `/quotes`

**Columns displayed (default):**

| Column | Source | Sortable | Notes |
|--------|--------|----------|-------|
| Quote # | `quoteNumber` | Yes | Primary identifier; links to detail view |
| Customer | `customer.displayName` | Yes | |
| Project | FlowGroup `nickname` or service address city | Yes | Shows nickname if set, else city/state |
| Status | `salesStatus` | Yes | Colored badge: draft (gray), sent (blue), signed (green), activated (purple), lost (red), void (strikethrough) |
| Current version | Latest version number + status | No | e.g. "v3 — Sent" |
| Total | Current draft or latest sent version total | Yes | Formatted as currency with tenant locale |
| Owner | `ownerUser.displayName` | Yes | Avatar + name |
| Updated | `updatedAt` | Yes | Relative ("2 days ago") with absolute on hover |

**Default sort:** `updatedAt` descending (most recently active first).

**Pagination:** Paginated (not infinite scroll). Default page size: 25. Options: 25, 50, 100. Page count and total count displayed.

**Empty state:** When no quotes exist in the tenant:

- Heading: "No quotes yet"
- Body: "Quotes are where you build and send proposals to your customers. Create your first quote to get started."
- Action button: "New Quote"

**Empty state (filtered):** When filters produce no results:

- Heading: "No quotes match your filters"
- Body: "Try adjusting your filters or search terms."
- Action link: "Clear filters"

### Filters

| Filter | Type | Behavior |
|--------|------|----------|
| Status | Multi-select dropdown | Options: `draft`, `sent`, `signed`, `activated`, `lost`, `void`. Default: `draft`, `sent`, `signed` (active statuses). |
| Customer | Multi-select dropdown (customer list) | Filter by one or more customers. |
| Owner | Multi-select dropdown (user list) | Filter by one or more quote owners. Includes "Unassigned" option. |
| Project | Multi-select dropdown (FlowGroup list) | Filtered by selected customer if customer filter is active. |
| Updated date | Date range picker | From/to dates. Presets: "Today", "Last 7 days", "Last 30 days", "This month", "This quarter." |
| Has unsigned send | Boolean toggle | Quotes with at least one `sent` (not signed) version. |
| Ready to activate | Boolean toggle | Quotes with a `signed` version that has not yet been activated. |

Filters combine with AND logic. Within a multi-select filter, values combine with OR logic.

### Search

**Searchable fields:** `quoteNumber`, `customer.displayName`, `customer.companyName`, FlowGroup `nickname`, FlowGroup address city/state, `internalNotes`.

**Search type:** Substring match, case-insensitive. Minimum query length: 2 characters.

**Search interaction:** A search bar above the list. Search applies as an additional filter on top of the active filter set.

### Detail view

**URL:** `/quotes/:quoteId`

**Layout:** Single-page detail view with the following sections:

**Header area:**
- Quote number (large, primary).
- Sales status badge.
- Customer name (clickable link to customer detail).
- Project / FlowGroup name (clickable link to FlowGroup detail).
- Owner avatar and name.
- Action buttons:
  - **"Open Editor"** (opens latest draft version editor — epic 11) — shown only if a draft version exists.
  - **"View Latest Sent"** (opens read-only sent version view) — shown only if a sent version exists.
  - **"New Version"** (creates new draft from latest sent — epic 14) — shown only if latest version is sent or signed.
  - **"Archive"** — in "More" menu.
  - **"Delete"** — in "More" menu, admin only, conditionally enabled.

**Version history section:**
- Chronological list of all quote versions (newest at top).
- Each row shows: version number, status badge, sent date (if sent), signed date (if signed), total, created date.
- Clicking a version row opens that version: draft opens editor (epic 11), sent/signed opens read-only view.
- The current/active version is highlighted.

**Shell information section:**
- Internal nickname (editable inline).
- Tags (editable inline).
- Owner (editable inline via user dropdown).
- Lead link (if present — read-only, links to lead detail).
- Quote number (read-only).
- Created date and creating user.

**Notes section:** (epic 05)
- Notes attached to the quote shell (not version-specific notes, which belong on the version).

**Files section:** (epic 06)
- Files attached to the quote shell.

**Activity section:**
- Chronological log of status changes, owner changes, version creates, archive/restore events. Each entry: timestamp, user, action description.

**Related objects section:**
- Customer (link).
- FlowGroup / project (link).
- Lead (link, if conversion origin).
- Job (link, if a job was created from a signed version of this quote).

---

## 10. Edit behavior

### What is editable on the quote shell

| Field | Editable | Notes |
|-------|----------|-------|
| `quoteNumber` | No | System-generated, immutable after creation. |
| `customerId` | Admin only | Dangerous — changes all version context. Requires confirmation dialog: "Changing the customer will affect all versions. Are you sure?" Audit entry required. Blocked if any version is `sent` or `signed` unless admin overrides with reason. |
| `flowGroupId` | Conditionally | Allowed only if all versions are `draft` and none have been sent. If any version has been sent, changing FlowGroup is blocked with: "Cannot change project after a version has been sent." Admin may override with audit. |
| `internalNickname` | Yes | Inline edit on detail view. |
| `tags` | Yes | Inline edit on detail view. |
| `ownerUserId` | Yes | Dropdown of active users in tenant. |
| `salesStatus` | Conditionally | `salesStatus` is **derived** from the highest relevant version state by default. Manual override to `lost` is allowed (user action with optional reason note). See §17. |
| `id` | No | System-generated, immutable. |
| `createdAt` | No | System-generated, immutable. |
| `createdBy` | No | System-generated, immutable. |
| `tenantId` | No | System-generated, immutable. |

### Edit interaction

- **Inline edit on detail view** for quick single-field changes (nickname, tags, owner).
- **Status override:** "Mark as Lost" action in "More" menu sets `salesStatus = lost` with optional `lostReason` note. Only available when current status is `draft`, `sent`, or `signed`.

### Who can edit

- **Admin:** Any quote.
- **Office user / estimator:** Quotes they own or are assigned to. Tenant-configurable: any quote.
- **Field user:** Cannot edit quotes.

### What happens on edit

- `updatedAt` is set to server timestamp.
- `updatedBy` is set to the editing user.
- An audit log entry is written with the old and new values of changed fields.
- A toast confirms: "Quote updated."

### Concurrency

Last-write-wins at MVP scale. No optimistic locking required initially.

---

## 11. Archive behavior

### What archive means

Archiving a quote **hides it from the default list view** but does not delete it. Archived quotes:

- Do not appear in the quotes list when the default status filter is active.
- Are accessible via a status filter that includes "Archived" or via direct URL.
- Remain visible on the customer detail page's related quotes section, with an "Archived" indicator.
- Retain all versions, notes, files, and audit history.
- **Cannot be used for activation.** If a signed version exists on an archived quote, activation is blocked until the quote is restored.
- Can be restored (see §13).

### Who can archive

- **Admin:** Any quote.
- **Office user / estimator:** Quotes they own or are assigned to (tenant-configurable: any quote).
- **Field user:** Cannot archive.

### Archive flow

1. User clicks "Archive" from the quote detail view "More" menu (or selects one or more quotes in the list view and chooses "Archive" from a bulk actions menu).
2. System shows a confirmation dialog:
   - If no versions are `sent` or `signed`: "Archive this quote? It will be hidden from your active quotes list but can be restored later."
   - If a version is `sent` (awaiting signature): "This quote has a sent proposal awaiting signature. Archive anyway? The customer will no longer be able to sign via portal."
   - If a version is `signed` (awaiting activation): "This quote has a signed proposal awaiting activation. Archive anyway? Activation will be blocked until the quote is restored."
3. On confirm:
   - Quote `salesStatus` is set to `archived`.
   - `archivedAt` is set to server timestamp.
   - `archivedBy` is set to the acting user.
   - Audit log entry is written.
   - User is returned to the quotes list.
   - Toast: "Quote [quoteNumber] archived."

### Cascade

Archiving a quote does not cascade to versions, notes, files, or related objects. Versions retain their individual status (`sent`, `signed`, etc.) — but the quote shell's `archived` status prevents new actions like activation.

### Bulk archive

Supported from the list view. User selects multiple quotes via checkboxes, then clicks "Archive" from the bulk actions bar. Confirmation dialog states the count: "Archive 3 quotes?" Same rules apply per quote. If any selected quote has a signed version awaiting activation, the dialog warns individually.

---

## 12. Delete behavior

### Whether hard delete is allowed

**Hard delete is restricted to admins only** and only under specific conditions:

- The quote has **only one version**, and that version is `draft` (never sent).
- The quote has **no** linked jobs.
- The quote has **never** had a version in `sent`, `signed`, or `activated` status.

If any of those conditions are not met, delete is blocked. The UI disables the delete action and shows a tooltip: "This quote cannot be deleted because it has sent versions or linked records. Archive it instead."

### Delete flow

1. Admin clicks "Delete" from the quote detail view "More" menu.
2. System checks eligibility (single draft version, never sent, no linked jobs).
3. If eligible, system shows a confirmation dialog: "Permanently delete this quote? This action cannot be undone. The draft version, all notes, and all files attached to this quote will be removed."
4. Admin must type the quote number to confirm.
5. On confirm:
   - Quote record, its single draft version, all associated line items, groups, notes, and files are **hard deleted**.
   - Audit log retains a tombstone entry: "Quote [quoteNumber] (ID: [id]) deleted by [user] at [timestamp]."
6. User is redirected to the quotes list.
7. Toast: "Quote [quoteNumber] deleted."

### Who can delete

- **Admin only.** No other role can hard delete quotes.

---

## 13. Restore behavior

### What can be restored

Archived quotes can be restored. Hard-deleted quotes cannot be restored.

### Who can restore

- **Admin:** Any archived quote.
- **Office user / estimator:** Cannot restore (admin-only action).

### Restore flow

1. Admin navigates to an archived quote (via the "Archived" filter on the quotes list or by following a direct link).
2. Admin clicks "Restore" (visible on the detail view when quote is archived, replacing the "Archive" action).
3. System shows a confirmation dialog: "Restore this quote? It will return to your active quotes list."
4. On confirm:
   - Quote `salesStatus` is **recomputed** from the highest version status (see §17). If the latest version is `signed`, the quote returns as `signed`. If all versions are `draft`, it returns as `draft`.
   - `archivedAt` and `archivedBy` are cleared.
   - Audit log entry is written: "Quote restored by [user]."
   - The quote reappears in the active quotes list.
   - Toast: "Quote [quoteNumber] restored."

---

## 14. Required fields

| Field | Type | Why required |
|-------|------|-------------|
| `customerId` | FK (Customer) | Every quote must be addressed to a customer. |
| `flowGroupId` | FK (FlowGroup) | Every quote must be anchored to a site/project for execution binding. The FlowGroup must belong to the selected customer. |
| `quoteNumber` | String (auto-generated) | Human-readable reference for communication, search, and print. |

Only three fields are required. `quoteNumber` is system-generated. The user provides `customerId` and `flowGroupId` during creation.

---

## 15. Optional fields

| Field | Type | Default | Why optional |
|-------|------|---------|-------------|
| `internalNickname` | String | `null` | Helps distinguish multiple quotes for the same customer/project (e.g., "Main panel upgrade — revised"). Not customer-facing. |
| `ownerUserId` | FK (User) | Creating user | The sales rep or estimator responsible. Defaults to creator. |
| `tags` | Array of strings | `[]` | Tenant-defined labels for categorization and filtering (e.g., "Solar", "Residential", "Priority"). |
| `leadId` | FK (Lead) | `null` | If this quote was created from a lead conversion, stores the link. Read-only after creation. |
| `lostReason` | String | `null` | Free-text reason when status is manually set to `lost`. |

---

## 16. Field definitions and validations

| Field | Data type | Max length | Format / constraints | Uniqueness | System or user |
|-------|-----------|-----------|---------------------|------------|---------------|
| `id` | String (cuid) | — | System-generated | Globally unique | System |
| `tenantId` | String (cuid) | — | Must reference a valid tenant | — | System |
| `quoteNumber` | String | 50 chars | Auto-generated per tenant sequence. Format: tenant-configurable prefix + zero-padded sequential number (e.g., "Q-00042"). The prefix is set in tenant settings (epic 60, `quoteNumberPrefix`). The sequence is monotonic per tenant and never reused. | Unique per tenant | System |
| `customerId` | String (cuid) | — | Must reference an active customer in the same tenant. If the referenced customer is archived, the quote retains the link but the customer is displayed with an "(Archived)" badge. | — | User |
| `flowGroupId` | String (cuid) | — | Must reference a FlowGroup whose `customerId` matches the quote's `customerId`. If the referenced FlowGroup is archived, the quote retains the link but the FlowGroup is displayed with an "(Archived)" badge. | — | User |
| `internalNickname` | String | 200 chars | Trimmed whitespace. Unicode allowed. Not displayed to customers. | Not unique | User |
| `ownerUserId` | String (cuid) | — | Must reference a valid active user in the tenant. If the assigned user is deactivated, the quote retains the assignment with an "(Inactive)" badge. | — | User |
| `tags` | Array of strings | 30 tags max; each tag 50 chars max | Lowercase, trimmed, deduplicated. | — | User |
| `leadId` | String (cuid) | — | Must reference a valid lead in the same tenant, if provided. | — | System (set at conversion) |
| `salesStatus` | Enum | — | `draft`, `sent`, `signed`, `activated`, `lost`, `void`, `archived`. See §17. | — | System + User |
| `lostReason` | String | 500 chars | Free text. Only populated when `salesStatus` is set to `lost`. | — | User |
| `createdAt` | Timestamp (UTC) | — | Server-set at creation. Immutable. | — | System |
| `createdBy` | String (cuid) | — | Set at creation. Immutable. | — | System |
| `updatedAt` | Timestamp (UTC) | — | Server-set on every update. | — | System |
| `updatedBy` | String (cuid) | — | Set on every update. | — | System |
| `archivedAt` | Timestamp (UTC) | — | Set when archived. Cleared on restore. `null` when active. | — | System |
| `archivedBy` | String (cuid) | — | Set when archived. Cleared on restore. | — | System |

---

## 17. Status / lifecycle rules

### salesStatus derivation

`salesStatus` is **primarily derived** from the quote's versions. The system recomputes it when version statuses change:

| Condition | Derived salesStatus |
|-----------|-------------------|
| All versions are `draft` | `draft` |
| At least one version is `sent` (none signed) | `sent` |
| At least one version is `signed` (none activated) | `signed` |
| At least one version has been activated | `activated` |
| All non-void versions are `superseded` | `draft` (if a new draft exists) or `sent` (if latest is sent) |
| All versions are `void` | `void` |

### Manual overrides

| Override | Who | Trigger | Notes |
|----------|-----|---------|-------|
| `lost` | Office user or admin | "Mark as Lost" action | User provides optional `lostReason`. Overrides derived status. Can be un-lost by creating a new version (returns to `draft`). |
| `archived` | Office user or admin | Archive action | See §11. Overrides derived status. Restored by admin (§13). |

### Disallowed transitions

- `activated` → `lost`: An activated quote cannot be marked lost. If the job is cancelled, that is handled on the job object (epic 34), not the quote.
- Any manual transition to `sent`, `signed`, or `activated`: These are system-driven by version events, not user-selectable.

### Status on creation

Always `draft`.

---

## 18. Search / filter / sort behavior

### Search

| Aspect | Specification |
|--------|--------------|
| Searchable fields | `quoteNumber`, `customer.displayName`, `customer.companyName`, FlowGroup `nickname`, FlowGroup address city/state |
| Search type | Case-insensitive substring match |
| Minimum query length | 2 characters |
| Debounce | 300ms after typing stops |
| Result behavior | Filters the list view in place |
| Empty search results | Shows filtered empty state (see §9) |

### Filters

See §9 for the full filter table.

Filters combine with AND logic. Within a multi-select filter, values combine with OR logic.

### Sort

**Sortable columns:** Quote #, customer, project, status, total, owner, updated date.

**Default sort:** `updatedAt` descending.

**Sort interaction:** Click column header to sort ascending; click again for descending; click again to remove sort (return to default). One sort column at a time.

---

## 19. Relationships to other objects

### Quote → Customer

- **Cardinality:** Many-to-one. Many quotes can belong to one customer.
- **Required:** Yes. A quote must have a customer.
- **Integrity:** If the customer is archived, the quote retains the link. The customer name is displayed with an "(Archived)" badge. New quotes cannot be created for an archived customer until it is restored.
- **Editing:** Changing `customerId` on a quote is admin-only with audit (see §10). If any version has been sent, the change is blocked unless admin overrides.

### Quote → FlowGroup

- **Cardinality:** Many-to-one. Many quotes can belong to one FlowGroup (over time, for different scopes).
- **Required:** Yes. A quote must have a FlowGroup.
- **Integrity:** If the FlowGroup is archived, the quote retains the link with an "(Archived)" badge. New quotes cannot target an archived FlowGroup.
- **Constraint:** `flowGroup.customerId` must equal `quote.customerId`.

### Quote → QuoteVersion

- **Cardinality:** One-to-many. A quote has one or more versions.
- **A quote always has at least one version** (created at quote creation time).
- **Versions are ordered** by `versionNumber` (monotonic integer, 1-based).

### Quote → Lead

- **Cardinality:** Many-to-one (optional). Multiple quotes can originate from one lead.
- **Set at creation** during lead conversion. Read-only after creation.

### Quote → Job

- **Cardinality:** Indirect. A job is created for the FlowGroup when a version is signed (epic 13, decision 04). The job links back via `flowGroupId` and optionally `primaryQuoteVersionId`. The quote shell does not directly own the job FK — the relationship is navigated via FlowGroup.

### Quote → User (owner)

- **Cardinality:** Many-to-one. A quote has zero or one owner. A user can own many quotes.
- **Integrity:** If the owner is deactivated, the quote retains the assignment with an "(Inactive)" badge.

---

## 20. Permissions / visibility

### Object-level permissions

| Action | Admin | Office / Estimator | Field user |
|--------|-------|--------------------|------------|
| View quotes list | All quotes in tenant | All quotes in tenant | No access to quotes list |
| View quote detail | Any quote | Any quote | Only quotes linked to assigned jobs (read-only, limited fields) |
| Create quote | Yes | Yes | No |
| Edit quote shell (nickname, tags, owner) | Any quote | Own or assigned quotes (tenant-configurable: any) | No |
| Change customer/FlowGroup | Yes (with conditions — §10) | No | No |
| Mark as lost | Any quote | Own or assigned quotes | No |
| Archive quote | Any quote | Own or assigned quotes (tenant-configurable: any) | No |
| Restore quote | Yes | No | No |
| Delete quote | Yes (with conditions — §12) | No | No |
| Bulk operations | Yes | Yes (within their permissions) | No |

### Row-level visibility

Field users see quote information only in the context of assigned jobs. They see the quote number and status on the job detail page but cannot navigate to the full quote detail view. This is not a filter — quotes are invisible to field users outside of job context.

### Tenant-configurable permission knobs

- Whether office users can edit/archive quotes they don't own.

---

## 21. Mobile behavior

### What is available on mobile

| Capability | Available | Notes |
|-----------|-----------|-------|
| View quotes list | Yes | Simplified layout: quote #, customer, status badge, total. Tap for detail. |
| View quote detail | Yes | Single-column stacked layout. Shell info, version history, notes. |
| Create quote | Yes | Same required fields. Customer and FlowGroup pickers optimized for touch. |
| Edit shell fields (nickname, tags, owner) | Yes | Inline edit on detail view. |
| Open editor (line items) | Limited | Read-only line summary. Full editing is desktop-first (epic 11). |
| Archive quote | Yes | Via action menu on detail view. |
| Delete quote | No | Admin-only action restricted to desktop. |
| Restore quote | No | Admin-only action restricted to desktop. |
| Bulk actions | No | Too error-prone on small screens. |
| Search | Yes | Search bar at top of list view. |
| Filters | Yes | Collapsed filter panel. Status and customer visible by default. Full filters behind "More filters." |

### Offline behavior

Out of scope for MVP. Quotes require network connectivity.

### Layout expectations

- **List view:** Single-column card list. Each card shows quote # (bold), customer name, status badge, total, and a secondary line with project name or last updated. Tap opens detail.
- **Detail view:** Full-width stacked sections. Version history as a compact list. "Open in desktop" action for full editing.

---

## 22. Notifications / side effects

### When a quote is created

- No notification to other users (the creating user is already aware).
- Webhook `quote.created` if integrations enabled.

### When a quote owner changes

- The new owner receives an in-app notification: "You have been assigned as owner of Quote [quoteNumber]."
- Email notification is tenant-configurable (default: off).

### When a quote is archived

- No notification (the archiving user is already aware).
- Webhook `quote.archived` if integrations enabled.

### When salesStatus changes

- Derived status changes (from version events) are handled by the version-specific notification (epic 08).
- Manual "Mark as Lost" generates an in-app notification to the quote owner (if the actor is someone else): "Quote [quoteNumber] has been marked as lost."

### Version events (cross-reference)

- `quote.version.sent`, `quote.version.signed` — handled in epics 12 and 13.

---

## 23. Audit / history requirements

### What is logged

| Event | Logged data |
|-------|------------|
| Quote created | All initial field values, creating user, timestamp, source (manual, lead conversion, API) |
| Shell field edited | Field name, old value, new value, editing user, timestamp |
| Owner changed | Old owner, new owner, changing user, timestamp |
| Customer changed | Old customer, new customer, changing user, timestamp, admin override flag |
| FlowGroup changed | Old FlowGroup, new FlowGroup, changing user, timestamp |
| salesStatus derived change | Old status, new status, triggering version event, timestamp |
| Marked as lost | User, timestamp, lostReason |
| Quote archived | Archiving user, timestamp |
| Quote restored | Restoring user, timestamp, restored-to status |
| Quote deleted | Deleting user, timestamp, tombstone summary (quote number, ID) |

### Where audit is visible

- **Quote detail view:** "Activity" section showing a chronological feed of all audit events.
- **Global audit log:** If the product has a tenant-wide audit log (epic 57), quote events appear there filterable by entity type "Quote."

### Retention

Audit records are retained for the lifetime of the quote. If a quote is hard-deleted, audit records are retained as tombstones for a tenant-configurable period (default: 7 years).

---

## 24. Edge cases

### Duplicate quotes for the same customer and project

- Allowed. No duplicate detection for quotes. Users may intentionally create multiple quotes for the same customer and project (different scopes, competing options). The quote list shows all of them.

### Quote with archived customer

- If a customer is archived after quotes exist, those quotes remain. The customer name appears with "(Archived)" badge. New versions can still be created on existing quotes with archived customers. New quotes cannot be created for archived customers.

### Quote with archived FlowGroup

- Same as archived customer: existing quotes remain, badge shown, new quotes to that FlowGroup are blocked.

### All versions voided

- If all versions on a quote are voided (epic 14), the quote's `salesStatus` becomes `void`. The quote remains in the list with a "Void" badge. It can be archived for cleanup.

### Quote owner deactivated

- The quote retains the ownership. List and detail views show the owner with "(Inactive)" badge. Admin can reassign. The system does not auto-reassign.

### Creating a quote when no customers exist

- The customer picker shows an empty state with a "+ Create customer" action. If the user creates a customer inline, they return to the quote create form with the new customer selected. If they dismiss the customer create, the quote create form remains open with the customer field empty.

### Creating a quote when the selected customer has no FlowGroups

- The FlowGroup picker shows "No projects for this customer" with a "+ Create project" action. Same inline-create flow as customers.

### Bulk operations at scale

- Bulk archive is supported for up to 50 quotes at a time. If more than 50 are selected: "You can archive up to 50 quotes at a time."

### Very long internal nickname

- Truncated in list view with ellipsis. Full text shown on hover or in detail view.

### Quote created via API with missing required fields

- API returns 422 with a body listing which required fields are missing. The quote is not created.

---

## 25. What must not happen

1. **A quote shell must not carry commercial truth.** The shell does not hold line items, totals, pricing, or scope details. Commercial truth lives on QuoteVersion (epic 08) and QuoteLineItem (epic 09). The shell's displayed "total" is a read-through from the current version, not a stored field.

2. **salesStatus must not be treated as authoritative for freeze or activation.** The `salesStatus` on the shell is a derived/display field. Freeze, sign, and activation decisions reference the **version** status, not the shell status.

3. **Collapsed vocabulary.** A quote is not referred to as a "proposal," "estimate," "bid," or "order" in the UI. The v3 product uses "Quote" consistently. The customer-facing presentation of a sent version is called a "Proposal" on the portal, but internally the object is always "Quote."

4. **Silent deletion.** Quotes must not be silently deleted by any automated process.

5. **Internal data leaking to customer portal.** Customers never see the quote shell's internal nickname, tags, owner, salesStatus, lostReason, or audit history. The customer sees only the sent version's proposal presentation (epic 54).

6. **Quote shell owning line-item truth.** Per canon, the shell is a container. Line items belong to versions. The shell never duplicates or caches line-item data beyond the display total.

---

## 26. Out of scope

| Out-of-scope item | Why | Where it will be covered |
|-------------------|-----|------------------------|
| Quote version creation, editing, freezing | Separate objects with their own lifecycles | Epics 08, 09, 10, 11, 12 |
| Void workflow | Complex enough for its own spec | Epic 14 |
| Activation from signed version | Separate domain | Epic 33 |
| Quote templates / cloning | Feature not in MVP | Future epic |
| Multi-currency per quote | Complex pricing feature | Future epic |
| Saved views / custom list configurations | Cross-cutting feature | Future epic: saved views |
| Quote PDF generation | Part of the send pipeline | Epic 12 |
| Quote comparison (side-by-side versions) | Partially in epic 14; full feature deferred | Future enhancement |
| Reporting / dashboard widgets for quotes | Cross-cutting analytics | Future epic: reporting |

---

## 27. Open questions

### OQ1 — Process template selection: shell vs version

**Question:** Does the process template selection live on the quote shell (shared across all versions) or on each version (allowing template changes between revisions)?

**Options:**
- **(A) Shell-level:** Simpler. All versions use the same template. Changing template requires a new quote.
- **(B) Version-level (recommended):** More flexible. A revision can use a different template version. Canon supports this: "version-scoped selection per canon."

**Recommendation:** Option B (version-scoped), as stated in the original epic. This has been confirmed in epic 08.

**Who decides:** Product owner.

### OQ2 — salesStatus manual override set

**Question:** Beyond "lost," should there be other manual status overrides (e.g., "on hold" for commercial pause)?

**Recommendation:** No additional overrides for MVP. `lost` covers the main case. Commercial pause can be communicated via tags or notes. Adding statuses increases lifecycle complexity.

**Who decides:** Product owner.

### OQ3 — Quote number format

**Question:** Should the quote number format be purely sequential, or should it encode information (year, customer initials)?

**Recommendation:** Configurable prefix (e.g., "Q-", "2026-") set in tenant settings + sequential number. Do not encode customer or project information in the number — that breaks when the customer is reassigned.

**Who decides:** Product owner.
