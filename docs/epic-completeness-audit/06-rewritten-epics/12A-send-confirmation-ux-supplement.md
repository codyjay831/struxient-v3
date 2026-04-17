> **⚠ ARCHIVED — Consolidated on 2026-04-11.**
> This supplement has been merged into the main epic: `docs/epics/12-quote-send-freeze-epic.md`.
> The main epic is the authoritative source. This file is retained for audit history only.

---

# Supplement 12A — Send confirmation UX

**Pairs with:** Epic 12 (Quote send and freeze)
**Purpose:** Define the exact user-facing experience of the send confirmation modal, warning acknowledgment, progress indicator, success state, and failure recovery.

---

## Send button behavior

The "Send Proposal" button lives in the editor header bar (supplement 11A).

**Click behavior:**

1. User clicks "Send Proposal."
2. If the compose preview is stale (staleness token has changed since last preview computation), the system **auto-recomputes** the compose preview before opening the modal. During recomputation: button shows "Preparing..." (disabled, spinner).
3. If the recomputation produces **errors**: the modal does not open. The right rail Validation tab scrolls into view with errors highlighted. Toast: "Cannot send — fix [N] errors first."
4. If the recomputation succeeds (errors = 0): the send confirmation modal opens.

---

## Send confirmation modal

**Layout:**

```
┌────────────────────────────────────────────────────────┐
│  Send Proposal                                    [×]  │
│                                                        │
│  ┌─ Summary ─────────────────────────────────────────┐ │
│  │  Quote: Q-00042 v3                                │ │
│  │  Customer: Johnson Electric LLC                   │ │
│  │  Project: 123 Main St, Austin, TX                 │ │
│  │  Template: Residential Solar v2                   │ │
│  │                                                   │ │
│  │  Lines: 8 items                                   │ │
│  │  Plan tasks: 24 tasks across 5 stages             │ │
│  │  Total: $39,350.00                                │ │
│  └───────────────────────────────────────────────────┘ │
│                                                        │
│  ┌─ Warnings (2) ───────────────────────────────────┐  │
│  │  ⚠ Line 5: Packet 'trim_out' has fallback node   │  │
│  │    placement — verify intent before sending.      │  │
│  │    [ ] I acknowledge this warning                 │  │
│  │                                                   │  │
│  │  ⚠ FlowGroup address is marked 'TBD' — customer  │  │
│  │    may not receive accurate site directions.      │  │
│  │    [ ] I acknowledge this warning                 │  │
│  └───────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Delivery ───────────────────────────────────────┐  │
│  │  Send via:                                       │  │
│  │  (●) Email + Portal link                         │  │
│  │  ( ) Portal link only (no email)                 │  │
│  │  ( ) Manual delivery (mark as sent, no email)    │  │
│  │                                                  │  │
│  │  Recipient email: john@johnson-electric.com  [✎] │  │
│  │  (From contact: John Johnson — Site contact)     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Confirm ────────────────────────────────────────┐  │
│  │  This proposal will be frozen and sent to the    │  │
│  │  customer. Once sent, it cannot be edited — only │  │
│  │  superseded by a new version.                    │  │
│  │                                                  │  │
│  │           [Cancel]        [Send Proposal]        │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## Modal sections detail

### Summary section

| Field | Source |
|-------|--------|
| Quote + version | `quoteNumber` + `versionNumber` |
| Customer | Customer `displayName` from current record (the snapshot will be taken from current at send time) |
| Project | FlowGroup address or nickname |
| Template | Pinned workflow template name + version |
| Lines | Count of customer-visible line items on this version |
| Plan tasks | Count from latest compose preview |
| Total | Sum of extended prices across all line items |

### Warnings section

- Only shown if compose produced warnings (errors already blocked modal opening).
- Each warning is displayed with:
  - Warning icon (orange triangle)
  - Message text (human-readable, from compose engine warning codes)
  - Individual checkbox: "I acknowledge this warning"
- **All checkboxes must be checked** before the Send button becomes enabled.
- If there are no warnings, this section is not shown.

### Delivery section

- **Send via:** Radio buttons:
  - **Email + Portal link (default):** System sends email to the recipient with a portal link. The email uses the tenant's notification template (epic 56).
  - **Portal link only:** No email sent. The sent version is available on the portal if the customer logs in. Use case: the estimator will manually share the link.
  - **Manual delivery:** Mark the version as `sent` without any digital delivery. Use case: the proposal will be delivered as a printed document or via third-party tool. The version is frozen and immutable just the same.

- **Recipient email:** Pre-filled from the customer's primary contact email (epic 04). If no email exists on the customer, shows: "No email on file — select a contact or enter one" with a text input. The recipient email is stored on the send event for audit but does not change the customer record.

### Confirm section

- Explanatory text reminding the user of immutability.
- **Cancel button:** Closes modal, returns to editor. No data is changed.
- **Send Proposal button:** Enabled only when all warning checkboxes are checked (if any exist). Disabled with tooltip if warnings unchecked: "Acknowledge all warnings to send."

---

## Send in progress

After user clicks "Send Proposal":

1. Modal transitions to a **progress state**:
   ```
   ┌──────────────────────────────────────────┐
   │  Sending Proposal...                     │
   │                                          │
   │  ◍ Freezing line items                   │
   │  ◍ Generating plan                       │
   │  ◍ Composing execution package           │
   │  ◍ Creating customer snapshot            │
   │  ◍ Saving frozen version                 │
   │  ○ Sending notification                  │
   │                                          │
   │  [Cancel] (disabled — transaction in     │
   │           progress)                      │
   └──────────────────────────────────────────┘
   ```
2. Steps update from ○ (pending) to ◍ (in progress) to ✓ (complete) as the server reports progress. If the server does not support streaming progress, show a single spinner: "Sending proposal..." without step breakdown.
3. The modal cannot be dismissed during the transaction. The Cancel button is disabled.
4. If the browser is closed mid-transaction, the server completes atomically. On next page load, the version is either fully sent or fully rolled back.

---

## Success state

On successful send:

1. Modal transitions to success:
   ```
   ┌──────────────────────────────────────────┐
   │  ✓ Proposal Sent                         │
   │                                          │
   │  Quote Q-00042 v3 has been sent to       │
   │  john@johnson-electric.com               │
   │                                          │
   │  The customer can review and sign at:    │
   │  [Copy portal link]                      │
   │                                          │
   │  [View Sent Version]     [Back to Quote] │
   └──────────────────────────────────────────┘
   ```
2. **"View Sent Version"** navigates to the read-only sent view (supplement 08A).
3. **"Back to Quote"** navigates to the quote detail page.
4. Toast notification (in addition to modal): "Proposal sent successfully."
5. The editor is no longer available for this version — navigating to it redirects to the read-only view.

---

## Failure state

If the send transaction fails:

1. Modal transitions to error:
   ```
   ┌──────────────────────────────────────────┐
   │  ✗ Send Failed                           │
   │                                          │
   │  The proposal could not be sent.         │
   │  Error: [human-readable error message]   │
   │                                          │
   │  Your draft has not been changed.        │
   │  You can try again or return to the      │
   │  editor to fix the issue.                │
   │                                          │
   │  [Try Again]              [Back to Editor]│
   └──────────────────────────────────────────┘
   ```
2. **"Try Again"** re-opens the send confirmation modal (re-runs preflight).
3. **"Back to Editor"** closes modal and returns to the draft editor. The draft is unchanged — the transaction rolled back.
4. No partial state is possible. The version is either `draft` (failed) or `sent` (succeeded). Never halfway.

**Specific failure scenarios:**

| Failure | User message | Recovery |
|---------|-------------|---------|
| Compose errors discovered during final freeze | "Compose errors found — [N] issues must be fixed." + error list | User returns to editor, fixes issues, tries again |
| Staleness token mismatch (another user modified draft during send) | "The draft was modified while sending. Please review changes and try again." | User reviews, tries again |
| Network error / timeout | "Unable to reach the server. Check your connection and try again." | User retries |
| Idempotent duplicate (already sent) | "This version has already been sent." | User redirected to sent view |
| Server internal error | "An unexpected error occurred. Please try again. If the problem persists, contact support." | User retries or contacts support |

---

## Idempotency

- The send request includes a `sendClientRequestId` (generated by the client before the first attempt).
- If the server has already processed a request with that ID, it returns the existing result (no-op). The UI shows the success state.
- This prevents double-sends from double-clicks or network retries.

---

## Email content (when delivery includes email)

**Subject:** "Proposal from [TenantCompanyName] — [QuoteNumber]"

**Body content (template — configurable in epic 60):**

```
Hi [CustomerFirstName],

[TenantCompanyName] has sent you a proposal.

Quote: [QuoteNumber]
Total: [FormattedTotal]

Review and sign your proposal:
[Portal Link Button]

This proposal is valid until [ValidUntil date, if set, else "further notice"].

Questions? Contact [OwnerUserName] at [OwnerEmail] or [OwnerPhone].

[TenantCompanyName]
[TenantAddress]
```

- The email is sent from a no-reply address. Reply-to is set to the quote owner's email (if available).
- The portal link is a magic-link token that authenticates the customer to view the specific sent version.
- All content respects tenant branding (logo, colors) configured in settings (epic 60).

---

## Mobile send behavior

- By default, the "Send Proposal" button is **not available on mobile**. The editor is read-only on mobile (supplement 11A).
- If a tenant enables mobile send (feature flag in epic 60), the same server-side preflight runs. The mobile UI shows a simplified confirmation screen: summary, warnings with checkboxes, and the Send button. The progress and success/failure states are the same as desktop but in a full-screen layout instead of a modal.
