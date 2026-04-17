> **⚠ ARCHIVED — Consolidated on 2026-04-11.**
> This file has been consolidated into the main epic: `docs/epics/34-job-anchor-epic.md`.
> The main epic is the authoritative source. This file is retained for audit history only.

---

# Epic 34 — Job anchor

---

## 1. Epic title

Job anchor

---

## 2. Purpose

Define the **job** as the **durable business anchor** for a **customer**, **FlowGroup**, and all downstream execution: **flow**, **runtime tasks**, **payment gates**, **scheduling**, **cost tracking**, and **reporting**. The job is the central navigation object for runtime operations. This epic specifies how jobs are created (via sign/activation pipeline), listed, viewed, edited, cancelled, and restored.

---

## 3. Why this exists

Every runtime operation (task execution, payment, scheduling, cost recording, variance analysis) needs a **stable identifier** that unifies the commercial origin (quote) with the execution context (flow). Without a first-class job object:

- Payment gates have no anchor for financial milestones
- CRM integrations lack a job ID for accounting systems
- Field crews cannot navigate to a coherent project context
- Reporting cannot aggregate across the quote-to-completion lifecycle

The job provides that anchor. It is **not** the same as a flow (which is the executable graph instance) or a quote (which is the commercial document). It is the **business entity** that bridges them.

---

## 4. Canon alignment

- **`04-job-anchor-timing-decision`:** Default: job shell is created by the end of **sign** (`ensureJobForFlowGroup`). Activation reuses the existing job — it does not create a new one.
- **One job per FlowGroup** for the default trade wedge. Multi-flow fan-out (O2) is deferred.
- **`02-core-primitives`:** Job does not own commercial truth (that's on quote line items) or process truth (that's on the workflow snapshot). Job owns **business identity** and **operational status**.
- **`09-banned-v2-drift`:** No collapsed vocabulary. A job is not a quote, not a FlowGroup, not a flow.

---

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Admin** | View all jobs. Edit any job. Cancel/restore. Void job policy. Configure job settings (epic 60). |
| **Office / PM** | View all jobs in tenant. Edit jobs they manage (or any, per tenant policy). Trigger activation (if policy is manual — epic 33). Manage handoff (epic 44). Apply/release holds (epic 29). |
| **Estimator** | View jobs linked to their quotes. Limited editing (tags only). Cannot cancel. |
| **Dispatcher** | View all jobs. Manage schedule blocks (epics 45-46). Assign crew via handoff (epic 44). |
| **Field user** | View **assigned** jobs only (if row-level enabled — epic 59). See job header, task list, site address. Cannot edit job-level fields. |
| **Finance** | View all jobs. Manage payment gates (epic 47). Record costs (epic 49). No operational edits. |
| **Customer** | No direct access to the job object. Customers see project status via portal (epic 53) with limited visibility. |

---

## 6. Primary object(s) affected

- **Job** — the object defined by this epic.
- **Flow** — the executable graph instance created at activation (epic 33). One-to-one with job for default wedge.
- **QuoteVersion** — the signed version that created the job (or later versions applied via CO).
- **FlowGroup** — the project/site anchor this job belongs to.
- **Customer** — the customer this job serves (inherited from FlowGroup).

---

## 7. Where it lives in the product

**Desktop / web:**

- **Top-level navigation item:** "Jobs" in the primary sidebar/nav. Not nested under quotes or customers.
- **List view:** `/jobs` — the default landing page for the Jobs section.
- **Detail view:** `/jobs/:jobId` — individual job detail page with multiple tabs.
- Jobs also appear in context on: customer detail (related jobs), FlowGroup detail (linked job), quote detail (linked job if signed/activated).

**Mobile:**

- Jobs appear as a top-level section in mobile navigation.
- Mobile surfaces job list (simplified), job detail (stacked tabs), and task feed within the job context.
- Job creation is **not** a user action on mobile — jobs are created by the sign/activation pipeline.

---

## 8. Create flow

### How jobs are created

Jobs are **not** manually created by users. They are created by the system as a side effect of the **sign** pipeline (or optionally at activation, per tenant policy).

**Default behavior (`company.createJobOnSign = true`, per decision 04):**

1. A quote version is signed (epic 13).
2. The system calls `ensureJobForFlowGroup(flowGroupId, customerId, quoteVersionId)`.
3. If a job already exists for this FlowGroup: reuse it (idempotent). Link the new quote version.
4. If no job exists for this FlowGroup: create a new job:
   - Generate `jobNumber` (auto-sequence per tenant, format: tenant prefix + zero-padded number).
   - Set `customerId` from FlowGroup.
   - Set `flowGroupId`.
   - Set `primaryQuoteVersionId` to the signed version.
   - Set `jobStatus = sold`.
   - Set `createdAt`, `createdBy` (system or signing user).
   - Write audit event: `job.created`.
5. Notify the quote owner and PM (epic 56): "Job [jobNumber] created for [customerName]."

**Alternative behavior (`company.createJobOnSign = false`):**

- Job creation deferred to activation (epic 33). The `ensureJobForFlowGroup` call happens at activation instead.

### What the user sees

- On the quote detail page, after sign: a "Job [jobNumber]" link appears in the related objects section.
- On the customer detail page: the job appears in the related jobs list.
- On the jobs list: the new job appears with status `sold`.

### Manual create (disallowed)

There is no "New Job" button. Jobs are created exclusively through the sign/activation pipeline. If a user needs a job for a FlowGroup that has no signed quote, they must first create and send a quote. This prevents orphaned jobs without commercial backing.

**Exception:** If a future "internal work order" feature is added, it would have its own creation mechanism. Not in scope.

---

## 9. Read / list / detail behavior

### List view

**URL:** `/jobs`

**Columns displayed (default):**

| Column | Source | Sortable | Notes |
|--------|--------|----------|-------|
| Job # | `jobNumber` | Yes | Primary identifier; links to detail view |
| Customer | `customer.displayName` | Yes | |
| Site | FlowGroup address (city, state) or nickname | Yes | |
| Status | `jobStatus` | Yes | Colored badge: sold (blue), in_progress (green), complete (dark green), on_hold (orange), cancelled (red) |
| PM / Owner | `ownerUserId` display name | Yes | |
| Flow status | Derived from flow completion % | No | "Not started", "45% complete", "Complete" — or "No flow" if not activated |
| Payment | Active hold badge if any payment gate unsatisfied | No | Icon: green check (all paid), yellow alert (pending), red block (overdue) |
| Updated | `updatedAt` | Yes | Relative with absolute on hover |

**Default sort:** `updatedAt` descending.

**Pagination:** Paginated. Default page size: 25. Options: 25, 50, 100.

**Empty state:** When no jobs exist in the tenant:

- Heading: "No jobs yet"
- Body: "Jobs are created when a customer signs a proposal. Send and sign your first quote to see jobs here."
- Action link: "Go to Quotes" (links to `/quotes`)

**Empty state (filtered):** "No jobs match your filters. Try adjusting your filters or search terms." + "Clear filters" link.

### Filters

| Filter | Type | Behavior |
|--------|------|----------|
| Status | Multi-select dropdown | Options: `sold`, `in_progress`, `complete`, `on_hold`, `cancelled`. Default: `sold`, `in_progress`, `on_hold`. |
| Customer | Multi-select dropdown | |
| PM / Owner | Multi-select dropdown | Includes "Unassigned." |
| Has active hold | Boolean toggle | Jobs with any active hold (payment or operational). |
| Has open detour | Boolean toggle | Jobs with an open detour record. |
| Has pending CO | Boolean toggle | Jobs with a change order in draft or pending status. |
| Created date | Date range picker | Presets: This week, This month, This quarter. |

### Search

**Searchable fields:** `jobNumber`, `customer.displayName`, FlowGroup nickname, FlowGroup address.

**Search type:** Case-insensitive substring match. Minimum 2 characters.

### Detail view

**URL:** `/jobs/:jobId`

**Layout:** Tabbed detail view with a persistent header and tab navigation.

**Header area:**
- Job number (large, primary).
- Customer name (clickable link to customer detail).
- Site address / FlowGroup nickname (clickable link to FlowGroup detail).
- Status badge with dropdown for status change (see §10).
- PM / owner avatar and name (editable via dropdown).
- Action buttons:
  - **"Activate"** — shown if job has `sold` status and a signed version is ready. Triggers activation (epic 33).
  - **"Start Handoff"** — shown after activation (epic 44).
  - **"Cancel Job"** — in "More" menu, with conditions (see §11).

**Tabs:**

| Tab | Content | Primary epic |
|-----|---------|-------------|
| **Overview** | Job summary: status, dates, quote link, customer/site info, crew assignment, key metrics (task progress, budget summary). | This epic |
| **Flow** | Node board (epic 40) or timeline view showing execution progress. Not visible until activated. | Epic 40 |
| **Tasks** | Effective task list (epic 36) filterable by node, status, kind. Not visible until activated. | Epics 35, 36 |
| **Quotes** | List of quote versions linked to this job (signed, activated, CO-linked). Links to each version. | Epic 08 |
| **Schedule** | Schedule blocks for this job (epic 45-46). Calendar strip. | Epic 45 |
| **Files** | Files attached to the job (epic 06). | Epic 06 |
| **Notes** | Notes and activity timeline for the job (epic 05). | Epic 05 |
| **Money** | Payment gates (epic 47), cost events (epic 49), labor hours (epic 50), variance summary (epic 51). Sub-tabs or accordion. | Epics 47-51 |
| **Change Orders** | List of change orders (epic 37). | Epic 37 |
| **Handoff** | Handoff record and acknowledgment status (epic 44). | Epic 44 |

**Overview tab detail:**

| Section | Content |
|---------|---------|
| Status & dates | Job status, created date, activated date (if activated), expected completion (from schedule if present). |
| Source quote | Link to the primary signed quote version with total. |
| Customer & site | Customer name + link, site address, access notes from FlowGroup. |
| Crew | Assigned crew from handoff (epic 44). If no handoff yet: "No crew assigned — start handoff." |
| Progress | Task completion summary: X of Y skeleton tasks complete, X of Y manifest tasks complete. Progress bar. (Uses single formula per canon — `09` #8.) |
| Budget | Sold total, costs recorded, margin estimate — with "incomplete data" disclaimers per epic 51. |

---

## 10. Edit behavior

### What is editable on the job

| Field | Editable | Who | Notes |
|-------|----------|-----|-------|
| `jobStatus` | Yes | Admin, PM | Via dropdown on header. See §17 for allowed transitions. |
| `ownerUserId` | Yes | Admin, PM | Dropdown of active users. Audit logged. |
| `tags` | Yes | Admin, PM, Estimator | Inline tag editor. |
| `internalNotes` | Yes | Admin, PM | Or use notes epic (05). |
| `jobNumber` | No | — | System-generated, immutable. |
| `customerId` | No | — | Inherited from FlowGroup. Not editable on job. Change the FlowGroup's customer (admin only, epic 03). |
| `flowGroupId` | No | — | Set at creation. Immutable. |
| `primaryQuoteVersionId` | No | — | Set at creation. Additional versions linked via CO or revision. |
| `createdAt`, `createdBy` | No | — | Immutable. |

### Edit interaction

- **Status change:** Dropdown on the job detail header. Selecting a new status triggers a confirmation dialog with transition-specific messaging (see §17).
- **Owner change:** Inline dropdown on the header. Previous owner loses "My Jobs" filter match. New owner receives notification (epic 56).
- **Tags:** Inline tag editor on overview tab.

### What happens on edit

- `updatedAt` set to server timestamp.
- `updatedBy` set to editing user.
- Audit log entry written with old and new values.
- Toast: "Job updated."

### Concurrency

Last-write-wins at MVP.

---

## 11. Archive / cancel behavior

### Cancel job

"Cancel" replaces "archive" for jobs because cancelling a job has operational consequences (stops execution, releases holds).

**Who can cancel:**
- Admin: any job.
- PM: jobs they own (tenant-configurable: any).

**Cancel preconditions:**
- Job must not be `complete`. Completed jobs are closed, not cancelled.
- If active tasks are `in_progress`, the system warns: "This job has X tasks in progress. Cancelling will mark them as cancelled. Continue?"

**Cancel flow:**

1. User clicks "Cancel Job" from the "More" menu.
2. System shows a confirmation dialog with a checklist:
   - [ ] "I understand that all in-progress tasks will be cancelled."
   - [ ] "I understand that payment gates will be voided."
   - [ ] "I understand that scheduled blocks will be removed."
   - (These checkboxes must all be checked to enable the Confirm button.)
3. User must provide a `cancelReason` (required, free text, max 500 chars).
4. On confirm:
   - `jobStatus` set to `cancelled`.
   - `cancelledAt` set to server timestamp.
   - `cancelledBy` set to acting user.
   - `cancelReason` stored.
   - Active holds released with `cancelledByJobCancel` flag.
   - Active runtime tasks marked `cancelled`.
   - Schedule blocks for this job cancelled.
   - Payment gates voided.
   - Audit entry: `job.cancelled`.
   - Notify crew: "Job [jobNumber] has been cancelled." (epic 56)
   - User stays on job detail with "Cancelled" banner.

**Cascade to quote:** Cancelling a job does **not** void the signed quote. The quote retains its `signed` or `activated` status. The job cancellation is an operational decision, not a commercial one.

---

## 12. Delete behavior

**Hard delete of a job is forbidden** if any of the following exist:
- Sent or signed quote versions
- A flow instance
- Runtime task instances
- Payment records
- Cost events
- Execution events

In practice, this means **jobs are never hard-deleted** in normal product use. They are cancelled and remain in the system for audit and compliance.

**Exception:** Admin may hard-delete a job that exists only as a shell (created at sign, never activated, no downstream data) — rare cleanup scenario. Confirmation: type job number. Tombstone audit retained.

---

## 13. Restore behavior

### Restore cancelled job

**Who can restore:** Admin only.

**Restore flow:**

1. Admin navigates to a cancelled job.
2. Clicks "Restore Job" (visible when `jobStatus = cancelled`).
3. Confirmation dialog: "Restore this job? It will return to [previous status]. Cancelled tasks will remain cancelled — you may need to re-create them via change order."
4. On confirm:
   - `jobStatus` set to the status it held before cancellation (stored in `statusBeforeCancel`). If that was `in_progress`, it returns to `in_progress`.
   - `cancelledAt`, `cancelledBy`, `cancelReason` cleared.
   - Audit entry: `job.restored`.
   - Previously cancelled tasks are **not** automatically restored (they must be re-created via CO — epic 37). This prevents confusion about which work is still valid.
   - Toast: "Job [jobNumber] restored."

---

## 14. Required fields

| Field | Type | Why required |
|-------|------|-------------|
| `flowGroupId` | FK (FlowGroup) | Anchors the job to a site/project. |
| `customerId` | FK (Customer) | Identifies the party. Inherited from FlowGroup at creation. |
| `tenantId` | FK (Tenant) | Tenant isolation. |
| `jobNumber` | String (auto-generated) | Human-readable reference for communication, CRM, and accounting. |

---

## 15. Optional fields

| Field | Type | Default | Why optional |
|-------|------|---------|-------------|
| `ownerUserId` | FK (User) | `null` (unassigned until PM takes ownership) | The PM or dispatcher responsible. |
| `primaryQuoteVersionId` | FK (QuoteVersion) | Set at creation | The signed version that created this job. |
| `tags` | Array of strings | `[]` | Categorization (e.g., "Solar", "Residential", "Warranty"). |
| `externalCrmId` | String | `null` | External system reference for CRM or accounting integration. |
| `warrantyExpiry` | Date | `null` | If the job has a warranty period. |
| `cancelReason` | String | `null` | Populated when job is cancelled. |
| `statusBeforeCancel` | Enum | `null` | Stored when cancelling, cleared on restore. |

---

## 16. Field definitions and validations

| Field | Data type | Max length | Format / constraints | Uniqueness | System or user |
|-------|-----------|-----------|---------------------|------------|---------------|
| `id` | String (cuid) | — | System-generated | Globally unique | System |
| `tenantId` | String (cuid) | — | Must reference valid tenant | — | System |
| `jobNumber` | String | 50 chars | Auto-generated per tenant sequence. Format: `jobNumberPrefix` (from settings, default "J-") + zero-padded sequential number. Never reused. | Unique per tenant | System |
| `flowGroupId` | String (cuid) | — | Must reference a valid FlowGroup in the same tenant. | Unique per tenant (one job per FlowGroup for default wedge) | System |
| `customerId` | String (cuid) | — | Must reference a valid customer. Inherited from FlowGroup at creation. Immutable on job. | — | System |
| `primaryQuoteVersionId` | String (cuid) | — | Must reference a signed QuoteVersion. | — | System |
| `jobStatus` | Enum | — | `sold`, `in_progress`, `complete`, `on_hold`, `cancelled`. See §17. | — | System + User |
| `ownerUserId` | String (cuid) | — | Must reference valid active user if set. Null means unassigned. | — | User |
| `tags` | Array of strings | 30 tags max; 50 chars each | Lowercase, trimmed, deduplicated. | — | User |
| `externalCrmId` | String | 200 chars | Free text. No format enforcement. | Not enforced | User |
| `warrantyExpiry` | Date | — | Must be a future or present date if set. | — | User |
| `cancelReason` | String | 500 chars | Free text. Required when cancelling. | — | User |
| `statusBeforeCancel` | Enum | — | Same values as `jobStatus` minus `cancelled`. Stored when cancelling. | — | System |
| `createdAt` | Timestamp (UTC) | — | Server-set. Immutable. | — | System |
| `createdBy` | String (cuid) | — | User who signed the quote (or system). Immutable. | — | System |
| `updatedAt` | Timestamp (UTC) | — | Updated on every change. | — | System |
| `updatedBy` | String (cuid) | — | | — | System |
| `cancelledAt` | Timestamp (UTC) | — | Set when cancelled. Cleared on restore. | — | System |
| `cancelledBy` | String (cuid) | — | Set when cancelled. Cleared on restore. | — | System |
| `activatedAt` | Timestamp (UTC) | — | Set when first activation occurs on this job's flow. | — | System |

---

## 17. Status / lifecycle rules

### Statuses

| Status | Meaning | Set by |
|--------|---------|--------|
| `sold` | Job created from signed quote. Not yet activated. No work started. | System (at job creation) |
| `in_progress` | Activation has occurred and work is underway. | System (at activation) or user (manual resume from `on_hold`) |
| `on_hold` | Work is paused for operational reasons. Holds (epic 29) may exist. | User (manual status change with reason) |
| `complete` | All required work is finished. Closeout criteria met. | User (manual, with validation: all required tasks must be complete per completion rules) |
| `cancelled` | Job has been cancelled. See §11. | User (via cancel flow) |

### Allowed transitions

| From | To | Trigger | Validation |
|------|----|---------|-----------|
| `sold` | `in_progress` | Activation completes (epic 33) | Automatic |
| `sold` | `cancelled` | User cancels (§11) | Cancel flow |
| `in_progress` | `on_hold` | User changes status with reason | Optional hold record (29) |
| `in_progress` | `complete` | User marks complete | All required skeleton tasks complete (completion rules — epic 27). Warn if manifest tasks incomplete (non-blocking with acknowledge). |
| `in_progress` | `cancelled` | User cancels (§11) | Cancel flow |
| `on_hold` | `in_progress` | User resumes | Confirmation dialog: "Resume work on this job?" |
| `on_hold` | `cancelled` | User cancels | Cancel flow |
| `complete` | `in_progress` | Admin reopens with reason | Rare. "Reopen job? This will move it back to In Progress." Audit required. |
| `cancelled` | (previous status) | Admin restores (§13) | Restore flow |

### Disallowed transitions

- `complete` → `on_hold`: A completed job is not put on hold. If rework is needed, reopen to `in_progress` first.
- `complete` → `sold`: Cannot revert past activation.
- Any → `sold`: `sold` is only the initial state at creation.
- `cancelled` → any except restore: Cannot casually change a cancelled job's status. Must use the restore flow.

### Status on creation

Always `sold`.

---

## 18. Search / filter / sort behavior

See §9 for full filter and search tables.

**Default filter state:** `sold`, `in_progress`, `on_hold` (active jobs).

**Sort options:** Job #, customer, site, status, PM, updated date.

---

## 19. Relationships to other objects

### Job → FlowGroup

- **Cardinality:** One-to-one (for default trade wedge). One job per FlowGroup.
- **Required:** Yes. Immutable after creation.
- **Integrity:** If FlowGroup is archived, the job retains the link. The job remains navigable.

### Job → Customer

- **Cardinality:** Many-to-one. A customer can have many jobs (across different FlowGroups/projects).
- **Required:** Yes. Inherited from FlowGroup.

### Job → QuoteVersion

- **Cardinality:** Many-to-many (over time). A job has a primary signed version, and may have additional versions linked via change orders (epic 37).
- The `primaryQuoteVersionId` is the original signed version. Additional versions are navigated via CO records.

### Job → Flow

- **Cardinality:** One-to-one (single-flow MVP). Created at activation.
- **Integrity:** Flow is the executable instance. If job is cancelled, the flow is also effectively halted.

### Job → User (owner)

- **Cardinality:** Many-to-one. A job has zero or one owner PM.
- **Integrity:** If the PM is deactivated, the job retains the assignment with "(Inactive)" badge.

---

## 20. Permissions / visibility

| Action | Admin | PM / Office | Estimator | Dispatcher | Field | Finance |
|--------|-------|-------------|-----------|------------|-------|---------|
| View jobs list | All | All | Linked to own quotes | All | Assigned only (if row-level) | All |
| View job detail | Any | Any | Linked to own quotes | Any | Assigned only | Any |
| Edit status | Any | Own or all (tenant) | No | No | No | No |
| Edit owner / tags | Any | Own or all (tenant) | Tags only | No | No | No |
| Cancel job | Any | Own (tenant-configurable) | No | No | No | No |
| Restore job | Yes | No | No | No | No | No |
| Trigger activation | Yes | Yes (if manual) | No | No | No | No |

### Row-level visibility

Field users see only jobs assigned to them (via handoff or crew assignment). This is enforced at the API level — the job list API returns only assigned jobs for field users.

---

## 21. Mobile behavior

| Capability | Available | Notes |
|-----------|-----------|-------|
| View jobs list | Yes | Simplified: job #, customer, status badge, site. Tap for detail. |
| View job detail | Yes | Single-column. Overview section + task feed. Tabs as horizontal scroll pills. |
| Change job status | Conditionally | PM role can change status via dropdown. Field cannot. |
| View tasks within job | Yes | Primary mobile use case — links to work feed (epic 39). |
| View schedule | Yes | Compact schedule strip for this job. |
| View files | Yes | Photo gallery and file list. |
| Add notes | Yes | Note input on job detail. |
| Cancel / restore | No | Admin-only, desktop. |
| Edit owner / tags | No | Desktop-only. |

### Layout expectations

- **List view:** Card list. Each card: job # (bold), customer name, status badge, site city. Tap opens detail.
- **Detail view:** Header with job # and status. Horizontal tab pills for Flow, Tasks, Money, Files, Notes. Primary action areas at top: "View Tasks" button prominently displayed.

---

## 22. Notifications / side effects

### When a job is created

- Quote owner receives in-app notification: "Job [jobNumber] created for [customerName]."
- Webhook `job.created` if integrations enabled.

### When job status changes

- Owner PM receives notification on status change by another user.
- On `complete`: Finance notified for closeout review (if tenant policy).
- Webhook `job.status_changed`.

### When job is cancelled

- Assigned crew notified: "Job [jobNumber] has been cancelled."
- Quote owner notified.
- Webhook `job.cancelled`.

### When job is restored

- Owner PM notified.
- Webhook `job.restored`.

---

## 23. Audit / history requirements

### What is logged

| Event | Logged data |
|-------|------------|
| Job created | All initial field values, creating context (sign event ID), timestamp |
| Status changed | Old status, new status, user, timestamp, reason (if `on_hold` or `cancelled`) |
| Owner changed | Old owner, new owner, user, timestamp |
| Tags edited | Old tags, new tags, user, timestamp |
| Job cancelled | User, timestamp, cancelReason, tasks cancelled count |
| Job restored | User, timestamp, restored-to status |
| Activation occurred | Activation record ID, user, timestamp |

### Where audit is visible

- **Job detail:** Activity section / notes timeline (epic 05 integration).
- **Global audit log** (epic 57).

### Retention

Audit records retained for the lifetime of the job plus tenant-configured compliance period (default: 7 years).

---

## 24. Edge cases

### Signed quote then voided before activation

- The job exists (created at sign) with status `sold`. The void (epic 14) does not automatically cancel the job. The PM must decide: cancel the job, or wait for a revised signed quote. The job detail shows a banner: "Primary quote version has been voided. Cancel this job or wait for a revised proposal."

### Job already exists for FlowGroup when new quote is signed

- `ensureJobForFlowGroup` returns the existing job (idempotent). The new signed version is linked as an additional quote version. No duplicate job is created.

### Customer archived after job created

- The job retains the customer link. Customer name shows "(Archived)" badge. Job operations are not affected — the customer relationship is historical on an active job.

### PM deactivated

- Job retains PM assignment with "(Inactive)" badge. Admin can reassign. Work does not stop — field crews continue with their task feed.

### Job with no assigned PM

- Valid state. Job appears as "Unassigned" in the PM column. Any PM can claim it by setting themselves as owner.

### All tasks complete but job status not updated

- Job status does not auto-advance to `complete`. The PM must manually mark the job complete after reviewing closeout criteria. This prevents premature closure.

### Change order while job is on hold

- CO drafting is allowed while job is `on_hold`. CO application is also allowed — it may add tasks that are immediately eligible once the hold is released.

### Very large jobs (500+ tasks)

- Job detail tabs that show task lists must use server-side pagination and virtual scrolling. The flow board (epic 40) must handle wide graphs with a mini-map.

---

## 25. What must not happen

1. **Duplicate jobs per FlowGroup** on the packaged path. Decision 04 and canon 09 prohibit this. `ensureJobForFlowGroup` must be idempotent.

2. **Job editing frozen quote data.** The job does not have its own "scope" or "price" — those live on the quote version. Changing job tags or status never affects quote snapshot.

3. **AI creating or activating jobs.** Decision 08. Human trigger required.

4. **Collapsed vocabulary.** A job is not called a "project" (that's FlowGroup), "order" (that's a quote), or "flow" (that's the executable instance). Use "Job" consistently.

5. **Job status driving quote lifecycle.** Cancelling a job does not void the quote. The quote's commercial status is independent.

6. **Field users editing job-level fields.** Field users execute tasks on the job but do not manage the job itself.

---

## 26. Out of scope

| Item | Why | Where covered |
|------|-----|--------------|
| Accounting project costing | Full GL spec | Future epic / O15 |
| Job merge (combining two jobs) | Complex; rare | Future epic |
| Multi-flow per job | O2 deferred | Canon decision |
| Job templates (recurring jobs) | Not MVP | Future epic |
| Customer-facing job status portal | Portal shows limited info | Epic 53 |
| Warranty management beyond expiry date | Separate domain | Future epic |

---

## 27. Open questions

### OQ1 — Auto vs manual activation

**Question:** Should activation be automatic after sign (system triggers immediately) or manual (PM clicks "Activate")?

**Recommendation:** Tenant-configurable flag in settings (epic 60). Default: manual activation. Some companies need time between sign and mobilization (permitting, scheduling, procurement).

**Who decides:** Product owner.

### OQ2 — Void semantics for signed-then-cancelled

**Question:** When a signed quote's job is cancelled (not the quote voided), what happens if a new revision is later signed for the same FlowGroup?

**Options:**
- (A) The cancelled job is restored and reused.
- (B) A new job is created (violates one-job-per-FlowGroup).
- (C) The PM must restore the cancelled job first, then sign the new version.

**Recommendation:** Option C. Explicit restore → then new sign links to the restored job.

**Who decides:** Product owner + architect.

### OQ3 — Company flag for createJobOnSign

**Question:** Confirmed default is `true` per decision 04. Should there be a tenant setting to change this?

**Recommendation:** Yes, surface in settings (epic 60) as `createJobOnSign` boolean. Default `true`.

**Who decides:** Already decided (04). Setting exposure is implementation detail.
