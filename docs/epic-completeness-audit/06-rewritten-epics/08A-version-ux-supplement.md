> **⚠ ARCHIVED — Consolidated on 2026-04-11.**
> This supplement has been merged into the main epic: `docs/epics/08-quote-versions-epic.md`.
> The main epic is the authoritative source. This file is retained for audit history only.

---

# Supplement 08A — Quote version UX

**Pairs with:** Epic 08 (Quote versions)
**Purpose:** Define the user-facing behaviors for viewing version history, switching between versions, and interacting with sent/signed versions in read-only mode.

---

## Version history list (within quote detail)

**Location:** The version history section on the quote detail page (`/quotes/:quoteId`), defined in epic 07 rewritten §9.

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

---

## Read-only sent/signed version view

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

---

## Version switching

When viewing any version, users can switch to another version of the same quote:

- **Version dropdown** in the header area: shows all versions with status badges. Selecting a different version navigates to that version's view (editor for draft, read-only for sent/signed).
- **Direct URL navigation:** `/quotes/:quoteId/versions/:versionId` always works. If the version doesn't exist, show 404: "Version not found for this quote."

---

## Version header display patterns

| Status | Badge color | Header text | Key dates shown |
|--------|-------------|-------------|----------------|
| `draft` | Gray | "Version [N] (Draft)" | "Created [date]" |
| `sent` | Blue | "Version [N] (Sent)" | "Sent [date]" |
| `signed` | Green | "Version [N] (Signed)" | "Sent [date] · Signed [date]" |
| `superseded` | Muted gray | "Version [N] (Superseded)" | "Sent [date] · Superseded by v[M]" |
| `void` | Red strikethrough | "Version [N] (Void)" | "Voided [date] by [user]" |

---

## Draft version creation UX

When a new draft version is created (epic 14 revision flow or initial quote creation):

1. System creates the version row with `status = draft`, `versionNumber = previousMax + 1`.
2. If carry-forward was selected: line items, groups, and structured answers are copied to the new draft.
3. User is redirected to the editor (epic 11) with the new draft open.
4. The version history on the quote detail page shows the new draft at the top with "Draft" badge.

---

## Delete draft version

**Conditions:** The quote must have more than one version. The draft has never been sent.

**Flow:**
1. Admin clicks "Delete draft" from the version row's action menu (or from the editor header "More" menu).
2. Confirmation: "Delete this draft version? This will remove all line items and structured answers on this draft. This cannot be undone."
3. On confirm: draft version, its line items, groups, and answers are hard-deleted. Audit tombstone retained.
4. User is redirected to the quote detail page. The version history no longer shows the deleted draft.

---

## Field definitions for QuoteVersion

| Field | Data type | Max length | Format | Notes |
|-------|-----------|-----------|--------|-------|
| `id` | String (cuid) | — | System-generated | Globally unique |
| `quoteId` | FK (Quote) | — | Required | Parent quote |
| `versionNumber` | Int | — | ≥ 1, monotonic per quote | Immutable after creation |
| `status` | Enum | — | `draft`, `sent`, `signed`, `superseded`, `void` | See epic 08 §17 |
| `currency` | String | 3 | ISO 4217 (e.g., "USD") | Required. Inherited from tenant default at creation. Immutable after send. |
| `title` | String | 200 | Optional display title for the proposal | User-editable on draft |
| `validUntil` | Date | — | Optional expiration date for the proposal | User-editable on draft |
| `customerSnapshot` | JSON | — | Frozen customer identity at send time | System-set at send. Includes legal name, address. |
| `generatedPlanSnapshot` | JSON | — | Frozen plan at send (epic 31) | System-set at send |
| `executionPackageSnapshot` | JSON | — | Frozen package at send (epic 32) | System-set at send |
| `pinnedWorkflowVersionId` | FK (WorkflowVersion) | — | Template selected for this version | User-set on draft; immutable after send |
| `composePreviewStalenessToken` | String | — | Opaque token; changes on any draft mutation | System-managed |
| `sentAt` | Timestamp | — | Server-set at send | Immutable |
| `sentBy` | FK (User) | — | Set at send | Immutable |
| `signedAt` | Timestamp | — | Set at sign | Immutable |
| `supersedesVersionId` | FK (QuoteVersion) | — | Points to the version this one supersedes | Set at revision creation |
| `sendClientRequestId` | String | — | Idempotency key for send | Unique per tenant |
| `createdAt` | Timestamp | — | Server-set | Immutable |
| `createdBy` | FK (User) | — | Set at creation | Immutable |
| `updatedAt` | Timestamp | — | Updated on changes | System |
