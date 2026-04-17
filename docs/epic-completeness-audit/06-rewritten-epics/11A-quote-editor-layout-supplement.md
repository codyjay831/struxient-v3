> **⚠ ARCHIVED — Consolidated on 2026-04-11.**
> This supplement has been merged into the main epic: `docs/epics/11-quote-editing-draft-behavior-epic.md`.
> The main epic is the authoritative source. This file is retained for audit history only.

---

# Supplement 11A — Quote editor layout and interaction

**Pairs with:** Epic 11 (Quote editing and draft behavior)
**Purpose:** Define the screen layout, panel structure, navigation, and key interaction patterns for the quote editor — the single most-used surface in the commercial workflow.

---

## Screen layout

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

---

## Header bar

| Element | Behavior |
|---------|----------|
| **← Back** | Returns to quote detail page. If unsaved changes exist and autosave is disabled, shows "Unsave changes" modal. |
| **Quote identifier** | Quote number + version number + status badge. e.g., "Q-00042 v3 (Draft)". Not editable here. |
| **Save indicator** | States: "●Saved" (green dot, all changes saved), "Saving..." (yellow, debounced save in progress), "Save failed — retry" (red, clickable to retry). |
| **Who else is here** (optional) | If presence is shipped: avatar(s) of other users viewing this draft. Tooltip: "Jane is viewing this draft." |
| **Send button** | Primary action. States: "Send Proposal" (enabled when preflight passes), "Send Proposal" (disabled with tooltip explaining blocker), "Sending..." (during send transaction). See supplement 12A. |

---

## Left panel: Group tree

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

---

## Center panel: Line item grid

**Width:** Flexible, fills remaining space.

**Content:**
- Line items displayed as rows within group sections.
- Group headers are visually distinct (bold, background color, collapsible).

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

---

## Right rail: Context panel

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

## Navigation routing rules

| URL pattern | Behavior |
|------------|----------|
| `/quotes/:quoteId` | Redirects to the quote detail page (epic 07). |
| `/quotes/:quoteId/versions/:versionId` | If version is `draft`: opens the editor (this screen). If version is `sent` or `signed`: opens the read-only sent view. If version is `void`: opens the read-only void view with a banner. |
| `/quotes/:quoteId/edit` | Opens the **latest draft version** in the editor. If no draft exists, shows a prompt: "No draft version. Create a new revision?" linking to epic 14's revision flow. |

---

## Autosave behavior

| Event | Behavior |
|-------|---------|
| User edits a field | Changes tracked locally. Autosave timer starts: 2-second debounce after last change. |
| Debounce expires | PATCH request sent to server with changed fields. Save indicator: "Saving..." |
| Save succeeds | Save indicator: "●Saved". `updatedAt` updated. No toast (too frequent). |
| Save fails | Save indicator: "Save failed — retry" (red, clickable). Retry with exponential backoff (2s, 4s, 8s, max 30s). After 3 failures, show blocking modal: "Unable to save changes. Check your connection." |
| User navigates away | If unsaved changes exist: browser `beforeunload` confirmation. Best-effort flush. |
| Tab closed mid-save | Best-effort flush. On next open, server state is the last successful save. |

---

## Preflight and send gate

The **Send** button on the header bar is controlled by the preflight validation results:

| Validation state | Send button state |
|-----------------|-------------------|
| Errors exist | Disabled. Tooltip: "Fix [N] errors before sending." |
| Warnings exist, no errors | Enabled. Click opens send confirmation modal (supplement 12A) with warning acknowledgment checkboxes. |
| No errors, no warnings | Enabled. Click opens send confirmation modal without warnings. |
| Compose preview stale | Enabled but send modal forces recompute before proceeding. |

Preflight runs automatically on:
- Editor open
- Line add/remove/edit
- Template change
- Structured input commit

---

## Mobile behavior

The full editor layout is **desktop-only**. On mobile:

- Opening a draft version shows a **simplified read-only view**: line item list (description, qty, price), total, and a link "Edit on desktop."
- Users can add notes to the version from mobile.
- The "Send" button is **not available on mobile** by default. If enabled via tenant policy, it still requires the same server-side preflight checks — the mobile UI shows a simplified version of the error/warning list.
