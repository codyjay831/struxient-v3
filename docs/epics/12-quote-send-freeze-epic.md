# Epic 12 — Quote send and freeze

---

## 1. Epic title

Quote send and freeze

---

## 2. Purpose

Define **Send** as the **human-triggered** operation that **freezes** a **draft quote version**: **commercial snapshot**, **generated plan**, **execution package**, **pinned workflow version**, and **integrity messages** — per `03-quote-to-execution-canon`. This epic specifies the full send pipeline, the confirmation modal UX, progress/success/failure states, customer email delivery, and immutability enforcement.

---

## 3. Why this exists

**Activation** and **customer truth** depend on an **immutable** proposal version. Send is the **contractual preparation** gate. Without a precisely defined send flow, builders would guess at:

- What validation must pass before send is allowed
- What the user sees during the send transaction
- What happens on success vs failure
- How the customer is notified
- How double-sends are prevented

---

## 4. Canon alignment

- **`03`:** What freezes at send — lines, plan, package, template bind.
- **`08-ai`:** No AI as freeze truth without human send click.
- **`09`:** Compose warnings must be **visible** (`silent reroute` ban).

---

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Estimator** | Execute send if preflight passes and **permissions** ok. |
| **Admin** | All estimator capabilities. Resend / duplicate send policy. |
| **System** | Computes plan (31), composes package (32), generates snapshots. |

---

## 6. Primary object(s) affected

- **QuoteVersion** — status transitions from `draft` → `sent`. Snapshot payloads written.
- **Customer proposal** — PDF file (epic 06) or portal snapshot generated.
- Fields set: `sentAt`, `sentBy`, `status`, all snapshot JSON fields.

---

## 7. Where it lives in the product

- **Primary button** "Send Proposal" in the quote editor header bar (epic 11).
- **Send confirmation modal** opens on click (see §8).

---

## 8. Create flow

N/A — this is a **status transition**, not object creation.

### Send button behavior

The "Send Proposal" button lives in the editor header bar (epic 11 §9).

**Click behavior:**

1. User clicks "Send Proposal."
2. If the compose preview is stale (staleness token has changed since last preview computation), the system **auto-recomputes** the compose preview before opening the modal. During recomputation: button shows "Preparing..." (disabled, spinner).
3. If the recomputation produces **errors**: the modal does not open. The right rail Validation tab scrolls into view with errors highlighted. Toast: "Cannot send — fix [N] errors first."
4. If the recomputation succeeds (errors = 0): the send confirmation modal opens.

### Send pipeline steps

1. Validate **draft** status.
2. Validate **required structured inputs** committed (`18`, `08-ai`).
3. Validate **address completeness** on FlowGroup if tenant requires (epic 03).
4. Run **computeGeneratedPlan** (31) → **composeExecutionPackage** (32).
5. If **errors:** block with list; user returns to editor.
6. If **warnings only:** require **checkbox** "I acknowledge…" per warning category.
7. Persist **snapshot** (shape O12) atomically with **version row** update.
8. Generate **proposal PDF** (or portal HTML snapshot id).
9. Set `status=sent`, `sentAt`, freeze **line items** copies as needed.
10. Emit events for **notifications** (56) and **portal** availability (54).
11. Email customer link if email channel selected — template below.

### Send confirmation modal

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

### Modal sections detail

**Summary section:**

| Field | Source |
|-------|--------|
| Quote + version | `quoteNumber` + `versionNumber` |
| Customer | Customer `displayName` from current record (the snapshot will be taken at send time) |
| Project | FlowGroup address or nickname |
| Template | Pinned workflow template name + version |
| Lines | Count of customer-visible line items on this version |
| Plan tasks | Count from latest compose preview |
| Total | Sum of extended prices across all line items |

**Warnings section:**
- Only shown if compose produced warnings (errors already blocked modal opening).
- Each warning is displayed with: warning icon (orange triangle), message text (human-readable, from compose engine warning codes), individual checkbox: "I acknowledge this warning."
- **All checkboxes must be checked** before the Send button becomes enabled.
- If there are no warnings, this section is not shown.

**Delivery section:**
- **Send via:** Radio buttons:
  - **Email + Portal link (default):** System sends email to the recipient with a portal link. The email uses the tenant's notification template (epic 56).
  - **Portal link only:** No email sent. The sent version is available on the portal if the customer logs in.
  - **Manual delivery:** Mark the version as `sent` without any digital delivery. The version is frozen and immutable just the same.
- **Recipient email:** Pre-filled from the customer's primary contact email (epic 04). If no email exists on the customer, shows: "No email on file — select a contact or enter one" with a text input. The recipient email is stored on the send event for audit but does not change the customer record.

**Confirm section:**
- Explanatory text reminding the user of immutability.
- **Cancel button:** Closes modal, returns to editor. No data is changed.
- **Send Proposal button:** Enabled only when all warning checkboxes are checked (if any exist). Disabled with tooltip if warnings unchecked: "Acknowledge all warnings to send."

### Send in progress

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

### Success state

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
2. **"View Sent Version"** navigates to the read-only sent view (epic 08 §9).
3. **"Back to Quote"** navigates to the quote detail page.
4. Toast notification (in addition to modal): "Proposal sent successfully."
5. The editor is no longer available for this version — navigating to it redirects to the read-only view.

### Failure state

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

## 9. Read / list / detail behavior

- **Sent** version: **read-only** editor-style view (epic 08 §9). **Download PDF**, **Open portal preview** actions.
- **Compose diagnostics** panel shows frozen **warnings** for support reference.

---

## 10. Edit behavior

- **No edit** to frozen commercial or plan fields. **Clerical patch** policy if ever introduced — **out of scope**; use **new version** (14).

---

## 11. Archive behavior

- Not applicable to version; quote shell archive (epic 07).

---

## 12. Delete behavior

- **Cannot delete** sent version; **void** via epic 14.

---

## 13. Restore behavior

- Not applicable.

---

## 14. Required fields

For send to succeed:
- **At least one customer-visible line** unless tenant allows **zero-line** proposals (unlikely) — product default **≥1 line**.
- All **required structured inputs** must be committed (epic 18).
- **Process template** must be selected (epic 23).

---

## 15. Optional fields

| Field | Type | Notes |
|-------|------|-------|
| `sendChannel` | Enum | `email`, `portal_only`, `manual`. Default: `email`. |
| `recipientEmail` | String | Pre-filled from customer contact. Stored on send event for audit. |

---

## 16. Field definitions and validations

- **Idempotent send:** The send request includes a `sendClientRequestId` (generated by the client before the first attempt). If the server has already processed a request with that ID, it returns the existing result (no-op). The UI shows the success state. This prevents double-sends from double-clicks or network retries.
- **Clock skew:** Server `sentAt` is authoritative.
- **Atomicity:** The entire send operation (snapshot write, status change, event emission) is transactional. No partial state is possible.

---

## 17. Status / lifecycle rules

`draft` → `sent` only via successful send pipeline. No other transition is possible through this epic.

---

## 18. Search / filter / sort behavior

- Quote list filter supports **Sent date** range.

---

## 19. Relationships to other objects

- **Pins** `PublishedWorkflowVersion` used for compose.
- **Creates** immutable links to **plan** and **package** artifacts (snapshot JSON).
- **Triggers** portal availability (epic 54).
- **Triggers** customer notification (epic 56).

---

## 20. Permissions / visibility

- **`quote.send`** permission required to trigger send.
- The send confirmation modal is accessible only to users with this permission.

---

## 21. Mobile behavior

- By default, the "Send Proposal" button is **not available on mobile**. The editor is read-only on mobile (epic 11 §21).
- If a tenant enables mobile send (feature flag in epic 60), the same server-side preflight runs. The mobile UI shows a simplified confirmation screen: summary, warnings with checkboxes, and the Send button. The progress and success/failure states are the same as desktop but in a full-screen layout instead of a modal.

---

## 22. Notifications / side effects

### Customer notification (when delivery includes email)

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

### Internal notifications

- Customer **proposal ready** email/SMS (if email delivery selected).
- Internal **sent** notification to quote owner: "Quote [quoteNumber] v[N] has been sent."

---

## 23. Audit / history requirements

- **Immutable** audit record: `quote.version.sent` with:
  - Actor (user who clicked send)
  - Timestamp
  - Send channel (email, portal_only, manual)
  - Recipient email (if applicable)
  - Hashes of snapshot components if policy requires
  - `sendClientRequestId` for idempotency tracing

---

## 24. Edge cases

### Partial failure after snapshot write
**Transaction** rollback; **no** half-frozen version. The version remains `draft` as if send was never attempted.

### Large plan timeout
For quotes with many lines producing large plans, the compose step may take longer. If the compose exceeds the timeout threshold, the send proceeds as an async job with a **"Sending…"** progress state. The user can navigate away — a notification is sent when send completes or fails.

### Hidden compose reroutes
Per canon (`09`), compose reroutes (fallback node placements) must surface as **visible warnings**, not silent behavior. The send modal's warning section surfaces these.

### Browser closed during send
Server completes the transaction atomically. On next page load, the version is either `draft` (transaction rolled back) or `sent` (transaction succeeded). No intermediate state is possible.

---

## 25. What must not happen

- **Email-only** send without **execution package** when activation requires it (`03`).
- **Hidden** compose reroutes — all reroutes surface as warnings in the send modal.
- **Partial freeze** — the snapshot must be fully written or fully rolled back.
- **AI auto-send** — the human must click "Send Proposal" in the confirmation modal.

---

## 26. Out of scope

- **Postal mail** fulfillment.
- **Multiple recipients** per send (one email per send; CC/BCC is a future feature).
- **Scheduled send** ("send at 9am tomorrow") — future feature.

---

## 27. Open questions

### OQ1 — Async send for large quotes

**Question:** Should send be synchronous (user waits for completion) or async (user gets a notification when done)?

**Recommendation:** Synchronous for MVP with a generous timeout (30s). If a quote exceeds this, show "This is taking longer than expected — we'll notify you when it's done" and transition to async. Decide threshold before implementation.

**Who decides:** Engineering lead + product owner.
