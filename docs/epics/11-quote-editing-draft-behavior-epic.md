# Epic 11 — Quote editing and draft behavior

---

## 1. Epic title

Quote editing and draft behavior

---

## 2. Purpose

Define **how** users edit **draft** quote versions: screen layout, panel structure, autosave, collaboration, validation gates before **send**, template compatibility preview, and **what** can change **before** vs **after** freeze — without duplicating line-item field specs (epic 09). This epic is the **editor shell** contract and the single most-used surface in the commercial workflow.

---

## 3. Why this exists

Ambiguous draft behavior causes **lost work**, **double sends**, and **accidental** incompatible template picks. The quote editor needs a precisely defined layout, interaction model, and validation pipeline so that builders produce a consistent, reliable editing experience.

---

## 4. Canon alignment

- **`03`:** Send freezes; draft is mutable.
- **`08-ai`:** AI suggestions remain **draft** until accepted.
- **`09-banned`:** No workflow-first editing as **primary** path.

---

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Estimator** | Edit draft; run **preflight**; add/remove/reorder lines and groups; manage structured inputs; trigger send. |
| **Admin** | All estimator capabilities. Delete draft version (epic 08 §12). |
| **Viewer** | Read-only draft view if granted (epic 59). Cannot edit any fields. |

---

## 6. Primary object(s) affected

- **QuoteVersion** (draft state) — the version being edited.
- **QuoteLineItem** (epic 09) — commercial rows within the version.
- **QuoteGroup** (epic 10) — grouping structure for line items.
- **Structured input answers** (epic 18) — per-line configuration values.
- **Validation results** cache — preflight output.
- **Editor session metadata** (optional) — presence, autosave state.

---

## 7. Where it lives in the product

**URL routing:**

| URL pattern | Behavior |
|------------|----------|
| `/quotes/:quoteId/versions/:versionId` | If version is `draft`: opens the editor (this screen). If version is `sent` or `signed`: opens the read-only sent view (epic 08). If version is `void`: opens the read-only void view with a banner. |
| `/quotes/:quoteId/edit` | Opens the **latest draft version** in the editor. If no draft exists, shows a prompt: "No draft version. Create a new revision?" linking to epic 14's revision flow. |
| `/quotes/:quoteId` | Redirects to the quote detail page (epic 07). |

---

## 8. Create flow

N/A — version created in epic 07/08; this epic covers **opening the editor** after create.

---

## 9. Read / list / detail behavior

### Screen layout

The quote editor is a **full-width workspace** that fills the content area (no sidebar navigation visible while editing). It consists of four regions:

```
┌─────────────────────────────────────────────────────────┐
│  HEADER BAR                                             │
│  [← Back]  Quote #Q-00042 v3 (Draft)  ●Saved  [Send]   │
├────────────┬──────────────────────────┬─────────────────┤
│            │                          │                 │
│  GROUP     │   LINE ITEM GRID        │  RIGHT RAIL     │
│  TREE      │                          │  (context)      │
│            │   +Add line              │                 │
│  Electrical│   ┌──────────────────┐  │  Validation     │
│  > Line 1  │   │ Line item row    │  │  Compose preview│
│  > Line 2  │   │ ...              │  │  Structured     │
│  Add-ons   │   └──────────────────┘  │  inputs         │
│  > Line 3  │                          │                 │
│            │   +Add group             │                 │
│  [+Group]  │                          │  [Attachments]  │
│            │                          │                 │
├────────────┴──────────────────────────┴─────────────────┤
│  FOOTER (optional)  |  Template: Residential Solar v2   │
└─────────────────────────────────────────────────────────┘
```

### Header bar

| Element | Behavior |
|---------|----------|
| **← Back** | Returns to quote detail page. If unsaved changes exist and autosave is disabled, shows "Unsaved changes" modal. |
| **Quote identifier** | Quote number + version number + status badge. e.g., "Q-00042 v3 (Draft)". Not editable here. |
| **Save indicator** | States: "●Saved" (green dot, all changes saved), "Saving..." (yellow, debounced save in progress), "Save failed — retry" (red, clickable to retry). |
| **Who else is here** (optional) | If presence is shipped: avatar(s) of other users viewing this draft. Tooltip: "Jane is viewing this draft." |
| **Send button** | Primary action. States: "Send Proposal" (enabled when preflight passes), "Send Proposal" (disabled with tooltip explaining blocker), "Sending..." (during send transaction). See §16 for preflight gate rules. Send confirmation UX is defined in epic 12. |

### Draft banner

Displays last saved time and (optionally) who else is viewing the draft.

### Left panel: Group tree

**Width:** ~220px fixed, collapsible to icon-only rail.

**Content:**
- Tree list of proposal groups (epic 10) in ordinal order.
- Under each group: indented list of line items (epic 09) in line ordinal order within the group.
- Line items show: abbreviated description (truncated to ~25 chars), quantity badge, warning icon if compose warnings exist.

**Interactions:**
- Click a group name to scroll the center grid to that group's section.
- Click a line item to select it in the grid and open its detail in the right rail.
- Drag groups to reorder.
- Drag line items between groups to reassign (updates `line.groupId`).
- **"+ Group"** button at bottom creates a new group (modal: enter title).

**Empty state:** If no groups exist, the tree shows: "Add a group to organize your proposal." The system auto-creates a "Default" group when the first line item is added.

### Center panel: Line item grid

**Width:** Flexible, fills remaining space.

**Content:** Line items displayed as rows within group sections. Group headers are visually distinct (bold, background color, collapsible).

**Grid columns:**

| Column | Width | Editable | Notes |
|--------|-------|----------|-------|
| Drag handle | 24px | — | Reorder within group |
| Line # | 40px | No | Auto-numbered within version |
| Description | Flexible | Yes (click to edit) | Customer-facing description. Markdown not supported. |
| Packet | 120px | Click to change | Badge showing packet key. Click opens packet picker modal. |
| Tier | 80px | Dropdown | Filtered to tiers available on selected packet. |
| Qty | 60px | Yes (number input) | Integer or decimal per tenant policy. Min 1. |
| Unit price | 100px | Yes (currency input) | Pre-filled from catalog; user may override. |
| Extended | 100px | No (computed) | qty × unit price. Formatted as currency. |
| Mode | Icon | Click to change | Execution mode: scope-generating (gear icon) or non-executing (note icon). |
| Warnings | Icon | No | Orange triangle if compose warnings exist. Click opens right rail to warnings. |
| Actions | 24px | — | Three-dot menu: Edit details, Duplicate, Remove |

**Row interactions:**
- Click a row to select it and populate the right rail with line detail.
- Double-click the description cell for inline editing.
- "Edit details" opens the right rail to the structured inputs and overrides panel for that line.

**Add line:**
- **"+ Add line"** button at the bottom of each group section.
- Opens the **packet picker modal**: search/filter by packet key, name, trade. Select a packet → choose tier → set quantity → confirm. Line is added to the group.
- **Alternative:** "Add non-executing line" for fees, notes, discounts. Opens a simpler form: description, unit price, quantity.

**Footer row:**
- Group subtotal (if group `showSubtotal` is true).
- Version total (always visible at bottom of grid): Sum of all extended prices. Formatted as currency.

### Right rail: Context panel

**Width:** ~320px fixed, collapsible.

**Tabs within the right rail:**

| Tab | Content | When visible |
|-----|---------|-------------|
| **Line detail** | Selected line's structured inputs (epic 18), instruction overrides, exclusions, packet info. | When a line is selected. |
| **Validation** | Preflight results: errors (blocking send) and warnings (require acknowledgment). | Always available. |
| **Compose preview** | Generated plan preview (epic 31): task count per node, total labor hours estimate. Refreshes on debounce after line changes. | Always available (may show "Computing..." during refresh). |
| **Template** | Selected process template info and version. Picker to change template (epic 23). Warning if template is incompatible with selected packets. | Always available. |
| **Attachments** | Files attached to this version (epic 06). Upload button. | Always available. |

**Line detail tab content:**
- Packet key and tier (read-only display with "Change" link).
- Structured input fields (epic 18) relevant to this line's packet. Completion meter: "3 of 5 required fields committed."
- Instruction override text area (overrides packet default instructions for this line).
- Exclusion toggles (if packet defines excludable task lines).
- "Manual plan tasks" section: add custom tasks attached to this line that will appear in the generated plan.

**Validation tab content:**
- **Errors (red):** List of issues that block send. Each error: icon, message, link to the offending line or field.
  - e.g., "Line 3: Packet 'solar_main' tier 'BEST' references unpublished revision"
  - e.g., "Required structured input 'roof_pitch' on line 2 is not committed"
  - e.g., "No process template selected"
- **Warnings (orange):** List of issues that require acknowledgment but do not block send.
  - e.g., "Line 5: Packet 'trim_out' has fallback node placement — verify intent"
  - e.g., "FlowGroup address is marked 'TBD' — customer may not receive accurate site directions"
- **Green check:** "No issues found — ready to send" when validation passes with no errors or warnings.

**Compose preview tab content:**
- Table grouped by node: node name, task count (skeleton + manifest from plan), estimated labor hours.
- Staleness indicator: "Preview computed at [time]" or "Preview stale — click Refresh."
- Refresh button triggers recompute.

---

## 10. Edit behavior

### Autosave

| Event | Behavior |
|-------|---------|
| User edits a field | Changes tracked locally. Autosave timer starts: 2-second debounce after last change. |
| Debounce expires | PATCH request sent to server with changed fields. Save indicator: "Saving..." |
| Save succeeds | Save indicator: "●Saved". `updatedAt` updated. No toast (too frequent). |
| Save fails | Save indicator: "Save failed — retry" (red, clickable). Retry with exponential backoff (2s, 4s, 8s, max 30s). After 3 failures, show blocking modal: "Unable to save changes. Check your connection." |
| User navigates away | If unsaved changes exist: browser `beforeunload` confirmation. Best-effort flush. |
| Tab closed mid-save | Best-effort flush. On next open, server state is the last successful save. |

### Concurrent editors

Show **presence** indicators (optional MVP feature); **last-write-wins** on same field with **conflict toast** if server detects version skew (optional etag). If presence is shipped, avatars appear in the header bar.

### Undo

In-session undo stack for line operations (add, remove, reorder, field changes). Undo does not persist across sessions — it clears on page reload.

### What is editable in the editor

All child object fields within the draft version:
- Line items: description, packet, tier, quantity, unit price, mode, structured inputs, exclusions, instruction overrides (epic 09).
- Groups: title, ordinal, `showSubtotal` (epic 10).
- Template selection: process template picker (epic 23).
- Attachments: add/remove files (epic 06).
- Version-level fields: `title`, `validUntil` (epic 08).

### What is NOT editable in the editor

- Quote shell fields (nickname, tags, owner) — edited on the quote detail page (epic 07 §10).
- Customer or FlowGroup — changed on the quote shell, not in the editor.
- Sent/signed/void versions — completely read-only.

---

## 11. Archive behavior

- Archiving **quote shell** locks the editor — if the quote is archived while the editor is open, the next autosave fails and the editor shows: "This quote has been archived. Your changes cannot be saved." User is redirected to the quote detail page. Covered in epic 07.

---

## 12. Delete behavior

- Discard **draft version** only via epic 08 §12 rules (admin only, quote must have >1 version, draft never sent).

---

## 13. Restore behavior

- **Recover draft** from autosave checkpoint if browser crashes — optional feature; if shipped, 7-day retention of autosave checkpoints. On next editor open, if unsaved changes exist: "We found unsaved changes from [date]. Restore them?" with [Restore] and [Discard] buttons.

---

## 14. Required fields

Not applicable at epic level — inherits child object requirements (line items need packet and tier, structured inputs have their own required fields).

---

## 15. Optional fields

| Field | Type | Notes |
|-------|------|-------|
| `draftOwnerId` | FK (User) | Tracks who "owns" the current editing session. Optional. |
| `lastAutosaveAt` | Timestamp | Server timestamp of last successful autosave. |

---

## 16. Field definitions and validations

### Preflight validation

Preflight must run before enabling the **Send** button. It calls the **compose** dry-run (epic 32) and validates all required inputs.

| Validation state | Send button state |
|-----------------|-------------------|
| Errors exist | Disabled. Tooltip: "Fix [N] errors before sending." |
| Warnings exist, no errors | Enabled. Click opens send confirmation modal (epic 12) with warning acknowledgment checkboxes. |
| No errors, no warnings | Enabled. Click opens send confirmation modal without warnings. |
| Compose preview stale | Enabled but send modal forces recompute before proceeding. |

Preflight runs automatically on:
- Editor open
- Line add/remove/edit
- Template change
- Structured input commit

---

## 17. Status / lifecycle rules

Editor only opens for `QuoteVersion.status = draft`. If the version status changes to `sent` while the editor is open (e.g., another user sent it), the editor transitions to the read-only sent view with a notification: "This version has been sent."

---

## 18. Search / filter / sort behavior

N/A inside editor. Quote list search is covered in epic 07 §18.

---

## 19. Relationships to other objects

- The editor orchestrates child epics: line items (09), groups (10), structured inputs (18), template selection (23), attachments (06), compose preview (31–32).
- It does not create any new entity types beyond the editor session metadata (optional).

---

## 20. Permissions / visibility

- Edit requires **`quote.edit`** permission on the parent quote.
- View (read-only mode) requires **`quote.view`** permission.
- Send requires **`quote.send`** permission (epic 12).

---

## 21. Mobile behavior

The full editor layout is **desktop-only**. On mobile:

- Opening a draft version shows a **simplified read-only view**: line item list (description, qty, price), total, and a link "Edit on desktop."
- Users can add notes to the version from mobile.
- The "Send" button is **not available on mobile** by default. If enabled via tenant policy, it still requires the same server-side preflight checks — the mobile UI shows a simplified version of the error/warning list.

---

## 22. Notifications / side effects

- Notify **quote owner** when a collaborator saves (optional, noisy — default off).
- Autosave does not trigger notifications.

---

## 23. Audit / history requirements

- Autosave does **not** audit each keystroke; **milestone** audit on:
  - Line add/remove
  - Template change
  - Structured input commit
  - Send trigger
- These milestone events are logged with actor, timestamp, and the changed data.

---

## 24. Edge cases

### Tab close mid-save
Best-effort flush. On next open, server state is the last successful save. See §13 for optional autosave recovery.

### Template changes while editing
If the selected template is updated (new version published) while editing, the editor shows: "A new version of [template name] is available. Update template?" The user can accept (refreshes compose preview) or dismiss (continues with the pinned version).

### Large proposals (50+ lines)
The center grid must support virtual scrolling for performance. The group tree should remain performant with deep nesting.

### Archived FlowGroup
If the FlowGroup is archived while the editor is open, editing continues. The archive does not affect draft editing. A warning badge appears on the FlowGroup reference.

---

## 25. What must not happen

- **Send** enabled when compose **errors** exist.
- **AI** auto-send (per `08-ai-assistance-canon`). AI may suggest line items or fill structured inputs, but the human must click Send.
- **Silent data loss** from autosave failures. The user must always be informed if their changes are not saved.
- **Editing a sent version.** The editor must never open in edit mode for a non-draft version.
- **Editing the global `ScopePacketRevision` directly from the quote editor.** Task-level changes to a library packet must **fork** into a `QuoteLocalPacket`. See Epic 15, §25a.

## 25a. Quote-local packet fork behavior in the editor

When an estimator adds, removes, or reorders tasks within a library packet on a draft quote:
1. The system creates a `QuoteLocalPacket` as a deep copy.
2. The `QuoteLineItem` switches its reference from the library to the local copy.
3. The editor sidebar shows a **"Forked from [Packet Name]"** badge.
4. The estimator may click **"Promote to Global Library"** to submit the local pattern for admin review.

Pre-job evidence (photos, measurements from `PreJobTask` on the `FlowGroup`) is available in the editor's **"Site Evidence"** sidebar panel for reference while authoring.

---

## 26. Out of scope

- Real-time **operational transform** co-editing (Google Docs-style). Last-write-wins is sufficient for MVP.
- **Offline editing.** The editor requires network connectivity.
- **Version branching** (editing two drafts simultaneously). Only one draft at a time per quote.

---

## 27. Open questions

### OQ1 — Presence feature

**Question:** Is the "who else is viewing" presence indicator worth the implementation cost for MVP?

**Recommendation:** Defer unless the team has prior presence infrastructure. The conflict toast on autosave is sufficient for MVP.

**Who decides:** Product owner + engineering lead.
