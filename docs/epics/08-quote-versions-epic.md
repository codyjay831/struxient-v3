# Epic 08 — Quote versions

---

## 1. Epic title

Quote versions

---

## 2. Purpose

Define **quote version** as the **mutable draft** or **immutable sent/signed** snapshot carrier: **commercial line snapshot**, **generated plan**, **execution package**, **pinned workflow version id**, **customer-facing proposal payload**, and **customer identity snapshot** for documents. This epic specifies how versions are created, listed, viewed, switched between, and deleted — and how the read-only sent/signed version view works.

---

## 3. Why this exists

**Send (freeze)** and **sign** operate on a **specific version**. Without versions, revising a proposal would corrupt audit and activation binding. Versions provide:

- Immutable snapshots of what the customer was shown
- Audit trail of commercial revisions
- A stable target for sign and activation to reference

---

## 4. Canon alignment

- **`03-quote-to-execution`:** Freeze at send; sign authorizes **that** version; activation targets **expected** frozen version.
- **`02-core-primitives`:** Version owns **attachment** to scope packet selections via line items; not the catalog packet itself.

---

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Estimator** | Edit **draft** versions; cannot edit **sent+**. Create new versions (revision flow — epic 14). View all versions on quotes they can access. |
| **Admin** | All estimator capabilities. Void/revision overrides per epic 14. Delete draft versions. |
| **Customer** | Views **sent** version via portal (epic 54). Cannot see drafts, internal notes, or audit history. |
| **System** | Creates new draft on **revision**; pins snapshots on send. |

---

## 6. Primary object(s) affected

- **QuoteVersion** — the object defined by this epic.
- **Quote** (shell) — parent container (epic 07).
- **QuoteLineItem** — child commercial rows on each version (epic 09).
- **QuoteGroup** — grouping structure for line items on each version (epic 10).

---

## 7. Where it lives in the product

- **Quote detail** → **Version history** section showing all versions as a timeline list.
- **Version badge** in header when viewing any version (e.g., "v3 (Draft)", "v2 (Sent)").
- **URL:** `/quotes/:quoteId/versions/:versionId`.

**Deep link behavior:**

| URL pattern | Behavior |
|------------|----------|
| `/quotes/:quoteId/versions/:versionId` | If version is `draft`: opens the editor (epic 11). If `sent` or `signed`: opens the read-only sent view. If `void` or `superseded`: opens the read-only view with a status banner. |
| `/quotes/:quoteId` | Redirects to the quote detail page (epic 07), which shows the version history section. |

---

## 8. Create flow

- **Initial:** Auto-created when a quote is created (v1 draft). System creates the version row with `status = draft`, `versionNumber = 1`.
- **Revision:** Epic 14 — user clicks "New Version" on the quote detail page. System duplicates the prior version as a new draft (or creates an empty draft carrying forward selectable fields). `versionNumber = previousMax + 1`. If carry-forward was selected: line items, groups, and structured answers are copied to the new draft. User is redirected to the editor (epic 11) with the new draft open. The version history on the quote detail page shows the new draft at the top with "Draft" badge.

---

## 9. Read / list / detail behavior

### Version history list (within quote detail)

**Location:** The version history section on the quote detail page (`/quotes/:quoteId`), defined in epic 07 §9.

**Layout:** Vertical timeline list, newest version at top.

**Each version row:**

| Element | Content | Notes |
|---------|---------|-------|
| Version number | "v3" | Bold, left-aligned |
| Status badge | Draft / Sent / Signed / Superseded / Void | Colored: draft=gray, sent=blue, signed=green, superseded=muted, void=strikethrough-red |
| Total | "$42,350.00" | From version snapshot (sent) or live computation (draft) |
| Date | "Sent Mar 15, 2026" or "Created Mar 10, 2026" | Most relevant date: sentAt > signedAt > createdAt |
| Created by | "by Jane Smith" | Creator or sender |
| Active indicator | Star or "Current" label | On the version that is the current active proposal (latest sent, or latest signed if signed) |
| Activated badge | "Activated" | Shown if this version has been activated into a job |
| Click target | Entire row is clickable | Opens the appropriate view for that version |

**Click behavior:**

| Version status | Click action |
|---------------|-------------|
| `draft` | Opens the editor (epic 11) for this draft version |
| `sent` | Opens the read-only sent version view |
| `signed` | Opens the read-only signed version view (same as sent but with signature card) |
| `superseded` | Opens the read-only view with a banner: "This version has been superseded by v[N]." Link to the superseding version. |
| `void` | Opens the read-only view with a banner: "This version was voided on [date] by [user]. Reason: [reason]." |

**Actions on the version list:**

| Action | Location | Who | When |
|--------|----------|-----|------|
| "New Version" | Button above the list | Estimator, Admin | When latest version is `sent` or `signed` (not void). Opens revision flow (epic 14). |
| "Compare" | Link on each sent/signed row | Anyone with view access | Opens side-by-side comparison of two versions. Select second version from dropdown. Optional — can defer to epic 14. |

**Empty:** N/A (always ≥1 version per quote).

### Version switching

When viewing any version, users can switch to another version of the same quote:

- **Version dropdown** in the header area: shows all versions with status badges. Selecting a different version navigates to that version's view (editor for draft, read-only for sent/signed).
- **Direct URL navigation:** `/quotes/:quoteId/versions/:versionId` always works. If the version doesn't exist, show 404: "Version not found for this quote."

### Version header display patterns

| Status | Badge color | Header text | Key dates shown |
|--------|-------------|-------------|----------------|
| `draft` | Gray | "Version [N] (Draft)" | "Created [date]" |
| `sent` | Blue | "Version [N] (Sent)" | "Sent [date]" |
| `signed` | Green | "Version [N] (Signed)" | "Sent [date] · Signed [date]" |
| `superseded` | Muted gray | "Version [N] (Superseded)" | "Sent [date] · Superseded by v[M]" |
| `void` | Red strikethrough | "Version [N] (Void)" | "Voided [date] by [user]" |

### Read-only sent/signed version view

**URL:** `/quotes/:quoteId/versions/:versionId` (where version status is `sent` or `signed`)

**Purpose:** Show the immutable frozen proposal as it was sent to the customer.

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│  HEADER                                                  │
│  [← Quote Q-00042]  Version 3 (Sent)  Sent Mar 15       │
│  [Download PDF]  [Open Portal Preview]  [New Version]    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  PROPOSAL PRESENTATION                                   │
│                                                          │
│  ┌─ Customer info ─────────────────────────────────────┐ │
│  │  Customer snapshot: name, address (from freeze)     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Group: Electrical ─────────────────────────────────┐ │
│  │  Line 1: Main panel upgrade   2 × $15,000 = $30,000│ │
│  │  Line 2: Subpanel             1 × $8,500  = $8,500 │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Group: Add-ons ───────────────────────────────────┐  │
│  │  Line 3: Permit fee           1 × $850    = $850   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                          │
│  TOTAL: $39,350.00                                       │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  TABS: Compose Details | Signature | Audit               │
├──────────────────────────────────────────────────────────┤
│  Compose Details tab:                                    │
│  - Plan summary: 24 tasks across 5 nodes                │
│  - Warnings acknowledged at send: [list]                 │
│  - Template: Residential Solar v2 (pinned)               │
│                                                          │
│  Signature tab (if signed):                              │
│  - Signer: John Doe                                      │
│  - Method: eSign                                         │
│  - Signed at: Mar 18, 2026 2:15 PM                      │
│  - [Download certificate]                                │
│                                                          │
│  Audit tab:                                              │
│  - Version created: Mar 10 by Jane                       │
│  - Sent: Mar 15 by Jane                                  │
│  - Signed: Mar 18 by John Doe (portal)                   │
└──────────────────────────────────────────────────────────┘
```

**Key rules:**
- All line-level data comes from the **frozen snapshot**, not live database queries. The display reflects exactly what the customer saw.
- The customer snapshot (name, address) comes from the freeze-time copy stored on the version, not the current customer record.
- No edit actions are available on any field. Everything is read-only.
- The "New Version" button opens the revision flow (epic 14) to create a new draft from this version's content.
- **Compose diagnostics** panel shows frozen **warnings** for support reference.

---

## 10. Edit behavior

- **Draft:** All editable entities (lines, groups, template pick, structured inputs) are mutable. Editing happens in the quote editor (epic 11).
- **Sent:** **No mutation** of snapshot fields. Operational overlays (holds, portal) excepted per epics 12–13.
- **Signed / superseded / void:** Read-only. No edits.

---

## 11. Archive behavior

- Versions are **not archived independently**; quote shell archive hides all versions. See epic 07 §11.

---

## 12. Delete behavior

### Delete draft version

**Conditions:** The quote must have more than one version. The draft has never been sent. Admin only.

**Flow:**

1. Admin clicks "Delete draft" from the version row's action menu (on the quote detail page) or from the editor header "More" menu.
2. Confirmation dialog: "Delete this draft version? This will remove all line items and structured answers on this draft. This cannot be undone."
3. On confirm: draft version, its line items, groups, and answers are hard-deleted. Audit tombstone retained.
4. User is redirected to the quote detail page. The version history no longer shows the deleted draft.

**Sent / signed / superseded / void versions cannot be deleted.** They are retained for audit and compliance. Use the void flow (epic 14) to mark a sent version as voided.

---

## 13. Restore behavior

Not applicable. Deleted drafts cannot be restored. Voided versions remain as read-only records.

---

## 14. Required fields

| Field | Type | Why |
|-------|------|-----|
| `quoteId` | FK (Quote) | Parent quote. |
| `versionNumber` | Int | Monotonic identity within the quote. |
| `status` | Enum | Drives editability and display. |
| `currency` | ISO 4217 code | Commercial display currency. |

---

## 15. Optional fields

| Field | Type | Default | Why optional |
|-------|------|---------|-------------|
| `title` | String | `null` | Optional display title for the proposal (e.g., "Revised scope — option B"). User-editable on draft. |
| `validUntil` | Date | `null` | Optional expiration date for the proposal. User-editable on draft. |
| `customerSnapshot` | JSON | `null` (set at send) | Frozen customer identity at send time. Includes legal name, address. |
| `proposalThemeId` | FK | `null` | Visual theme for portal/PDF presentation. |

---

## 16. Field definitions and validations

| Field | Data type | Max length | Format / constraints | Uniqueness | System or user |
|-------|-----------|-----------|---------------------|------------|---------------|
| `id` | String (cuid) | — | System-generated | Globally unique | System |
| `quoteId` | FK (Quote) | — | Required. Must reference a valid quote in the same tenant. | — | System |
| `versionNumber` | Int | — | ≥ 1, monotonic per quote. Immutable after creation. | Unique per quote | System |
| `status` | Enum | — | `draft`, `sent`, `signed`, `superseded`, `void`. See §17. | — | System |
| `currency` | String | 3 | ISO 4217 (e.g., "USD"). Inherited from tenant default at creation. Immutable after send. | — | System |
| `title` | String | 200 | Optional display title for the proposal. | Not unique | User |
| `validUntil` | Date | — | Optional. Must be a future or present date if set. | — | User |
| `customerSnapshot` | JSON | — | Frozen customer identity at send time. System-set at send. Includes `legalName`, `address`, `contactName`, `contactEmail`. | — | System |
| `generatedPlanSnapshot` | JSON | — | Frozen plan at send (epic 31). System-set at send. | — | System |
| `executionPackageSnapshot` | JSON | — | Frozen package at send (epic 32). System-set at send. | — | System |
| `pinnedWorkflowVersionId` | FK (WorkflowVersion) | — | Template selected for this version. User-set on draft; immutable after send. | — | User (draft) / System (freeze) |
| `composePreviewStalenessToken` | String | — | Opaque token; changes on any draft mutation. Used to detect stale previews. | — | System |
| `sentAt` | Timestamp (UTC) | — | Server-set at send. Immutable. | — | System |
| `sentBy` | FK (User) | — | Set at send. Immutable. | — | System |
| `signedAt` | Timestamp (UTC) | — | Set at sign. Immutable. | — | System |
| `supersedesVersionId` | FK (QuoteVersion) | — | Points to the version this one supersedes. Set at revision creation. | — | System |
| `sendClientRequestId` | String | — | Idempotency key for send. Unique per tenant. Prevents double-send. | Unique per tenant | System |
| `createdAt` | Timestamp (UTC) | — | Server-set. Immutable. | — | System |
| `createdBy` | FK (User) | — | Set at creation. Immutable. | — | System |
| `updatedAt` | Timestamp (UTC) | — | Updated on changes. | — | System |

**Snapshot JSON** or normalized tables (O12) — **semantic** requirements defined in epics 31–32.

---

## 17. Status / lifecycle rules

| Transition | Trigger | Notes |
|------------|---------|-------|
| `draft` → `sent` | Send (epic 12) | Freezes all snapshot payloads. |
| `sent` → `signed` | Sign (epic 13) | Customer signature recorded. |
| `signed` → `superseded` | New higher version sent or revision policy | Previous signed version marked superseded. |
| `*` → `void` | Void (epic 14) | Administrative cancellation of a version. |

---

## 18. Search / filter / sort behavior

- Global search may index quote # + version #; filters on quote list aggregate versions.
- Within the version history list on the quote detail page, versions are always shown in `versionNumber` descending order (newest first). No user-configurable sort or filter within the version list.

---

## 19. Relationships to other objects

- **Version 1—\* Line items** (epic 09), **groups** (epic 10), **structured answers** (epic 18), **files** (proposal PDF — epic 06).
- **Version \*—1 PublishedWorkflowVersion** (template pin — epic 23).
- **Version \*—1 Quote** (parent shell — epic 07).
- **Version may supersede** another version (`supersedesVersionId`).

---

## 20. Permissions / visibility

| Context | Who can see | Notes |
|---------|-------------|-------|
| Draft version | Office users with `quote.view` | Editable by users with `quote.edit`. |
| Sent / signed version | Office users with `quote.view` | Read-only. |
| Sent version on portal | Customer | Via portal link (epic 54). Customers see only the sent version's proposal presentation — never drafts, internal notes, or audit. |
| Void / superseded version | Office users with `quote.view` | Read-only with status banner. |

---

## 21. Mobile behavior

- **Version list:** Visible on the quote detail page in mobile layout. Simplified: version number, status badge, date, total. Tap opens view.
- **Read-only sent version:** PDF view or simplified proposal summary. Signing via portal (epic 54) works on mobile.
- **Draft editing:** Read-only line summary on mobile. Full editing is desktop-first (epic 11).

---

## 22. Notifications / side effects

- `quote.version.sent` — notifies customer (email/portal), notifies quote owner. See epic 12.
- `quote.version.signed` — notifies quote owner and triggers job creation pipeline. See epic 13.
- `quote.version.voided` — notifies quote owner. See epic 14.

---

## 23. Audit / history requirements

- Log every status transition with actor, timestamp, IP for sign.
- Audit visible on the read-only sent/signed version view's "Audit" tab: version created, sent, signed, voided — each with actor and timestamp.
- Global audit log (epic 57) includes version events filterable by entity type "QuoteVersion."

---

## 24. Edge cases

- **Concurrent send:** Idempotent lock per version. If two users click send simultaneously, the `sendClientRequestId` ensures only one send succeeds. The second attempt returns the existing result.
- **Activation version mismatch:** If the version status doesn't match expected state at activation time, reject activation (epic 33).
- **Version not found:** If a user navigates to `/quotes/:quoteId/versions/:versionId` with an invalid version ID, show 404: "Version not found for this quote."
- **Last draft deleted:** If the admin deletes the only draft and only sent/signed versions remain, the quote detail shows the version history with no draft. The "New Version" button is available to create a new draft.

---

## 25. What must not happen

- **Silent mutation** of sent snapshot. Once a version is `sent`, no field on the snapshot may be changed.
- **AI** writing snapshot without human send click (per `08-ai-assistance-canon`).
- **Displaying stale data as frozen truth.** The read-only sent view must always render from the frozen snapshot, never from live database queries against current line items.
- **Deleting sent or signed versions.** These are immutable audit records.

---

## 26. Out of scope

- **Storage normalization** choice (O12) — this epic states semantics only, not storage format.
- **Side-by-side version comparison UI** — partially in epic 14; full feature deferred.
- **Version branching** (creating two drafts from the same sent version) — not supported. Only one draft at a time.

---

## 27. Open questions

### OQ1 — Customer snapshot field list

**Question:** What exact fields should be captured in the `customerSnapshot` at send time?

**Recommendation:** At minimum: `legalName`, `billingAddress`, `primaryContactName`, `primaryContactEmail`. Legal review may require additional fields for certain industries.

**Who decides:** Product owner + legal review.

### OQ2 — Version comparison depth

**Question:** Should the "Compare" action show a full field-level diff or just a summary (line count, total delta)?

**Recommendation:** Start with summary comparison (line count delta, total delta, added/removed lines). Full field-level diff is a future enhancement.

**Who decides:** Product owner.
