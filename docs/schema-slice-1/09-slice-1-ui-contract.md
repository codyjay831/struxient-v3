# Slice 1 — UI contract

**Companion:** `05-compose-preview-contract.md`, `06-send-freeze-transaction-design.md`, `08-slice-1-api-contract-outline.md`.

---

## Global behaviors

| Behavior | Rule |
|----------|------|
| Tenant context | All screens assume authenticated office user |
| Errors vs warnings | Errors block send; warnings show yellow with optional ack |
| Staleness | After any local edit, show “preview may be stale” until preview refreshed |
| Sent banner | Read-only sent view: prominent **Sent** state; no edit controls |

---

## Quote workspace

| UI state | Required |
|----------|----------|
| Loading | Skeleton |
| Empty quote | Prompt to add version / lines |
| Draft | Full edit |
| Sent | Read-only (this version) |

**Validations:** customer + flow group selected before meaningful quote (product flow).

**Draft save:** optimistic PATCH with rollback toast on failure.

---

## Line items grid

| Column / field | Editable (draft) | Sent |
|----------------|------------------|------|
| Group | yes (reorder / assign) | no |
| Scope pin (catalog **revision** *or* **quote-local packet**, XOR for manifest lines) | yes | no |
| Tier | yes | no |
| Qty | yes | no |
| Title / description | yes | no |
| Price / line total | yes | no |

**Blocked:** any edit action when version is `sent` — disable or hide.

---

## Packet / tier picker

| Behavior | Rule |
|----------|------|
| Data source | Catalog read APIs |
| Tier list | Derived from selected revision’s `PacketTaskLine.tierCode` values |
| Invalid tier | Block save with inline error (client) + server validation |

---

## Process template picker

| Behavior | Rule |
|----------|------|
| Display | List `WorkflowTemplate`; choosing sets **published** `WorkflowVersion` (Slice 1: **one** published per template in seeds or pick explicit version) |
| Pin | Stored as `pinnedWorkflowVersionId` on version |
| Change pin | Allowed in draft; bumps staleness |

**Slice 1 decision:** If multiple published versions exist, UI must pick **explicit version** (not “latest” magic without user visibility).

---

## Compose preview panel

| Element | Required |
|---------|----------|
| Stats | Show `stats` from API (`lineItemCount`, `planTaskCount`, `packageTaskCount`) |
| Errors list | Blocking; red |
| Warnings list | Yellow |
| Refresh button | Calls preview |
| Staleness indicator | When `staleness === "stale"` |

**Does not** persist.

---

## Send button

| State | Behavior |
|-------|----------|
| Disabled | When errors exist, or preview never run, or stale token mismatch policy |
| Click | Calls send with `clientStalenessToken` from last preview |
| In flight | Full-screen or modal lock (prevent double click) |
| Success | Navigate to read-only sent view |
| Failure | Show API error; **no** partial sent state in UI (rollback assumed) |

---

## Read-only sent quote version view

| Section | Source |
|---------|--------|
| Header | Quote number, version, sent date, sent by |
| Commercial grid | Relational line items |
| Structure summary | Tabs or accordion: **Plan** / **Package** from JSON snapshots |
| Customer | Live `Customer` read with **banner**: “Customer record may have changed after send.” |

**Blocked:** edit, delete, add line, change pin, re-run send.

**Allowed:** print / export **deferred** (optional Slice 1 if trivial).

---

## Warnings / errors display

| Type | UX |
|------|-----|
| Error | Inline + preview panel; send disabled |
| Warning | Ack checkbox list if product requires; else informational |

---

## Alignment checklist

- [ ] Send disabled unless latest preview had **zero errors** and **fresh** staleness token (per `06`).
- [ ] Sent view never shows draft controls.
- [ ] No UI label says “package” for scope packet picker.

---

## Classification

| Item | Type |
|------|------|
| Customer change disclaimer | **Slice 1 decision** |
| Export PDF | **Deferred** |
