# Epic 10 — Proposal groups

## 1. Epic title

Proposal groups

## 2. Purpose

Define **proposal groups** as **customer-facing headings** that organize **quote line items** within a **quote version** (e.g. “Electrical”, “Add-ons”, “Allowances”) without changing **commercial math** beyond optional **subtotal display**.

## 3. Why this exists

Long proposals need **scannable structure**. Groups map to PDF sections and portal navigation.

## 4. Canon alignment

- Groups are **presentation + ordering**; they **do not** define **process** or **scope packets** (`06`).
- **Line items remain authoritative** for scope (`02`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Estimator** | CRUD groups on **draft**; drag lines between groups. |
| **Customer** | Sees group titles on proposal. |

## 6. Primary object(s) affected

- **ProposalGroup** (`quoteVersionId`, `title`, `ordinal`, `collapseDefault`).

## 7. Where it lives in the product

- **Left rail** or **group headers** in quote editor; **PDF template** mapping.

## 8. Create flow

1. **Add group** → enter **title** (required), optional **subtitle**.
2. `ordinal` auto-append; user may **reorder** groups via drag.
3. Assign lines to group via **drag** or **bulk assign**.

## 9. Read / list / detail behavior

- Groups render as **sections** with nested lines.
- **Empty group:** hidden from customer PDF unless tenant flag **show empty sections**.

## 10. Edit behavior

- Rename, reorder on draft; moving line between groups updates `line.groupId`.

## 11. Archive behavior

- **Remove group:** moves lines to **default group** or prompts target group; cannot delete if lines present without target.

## 12. Delete behavior

- Delete empty group; non-empty requires **merge** flow.

## 13. Restore behavior

- Undo stack in editor for draft operations (session); no long-term restore unless version control.

## 14. Required fields

| Field | Type | Why |
|-------|------|-----|
| `quoteVersionId`, `title`, `ordinal` | | Structure. |

## 15. Optional fields

`subtitle`, `showSubtotal`, `iconKey`.

## 16. Field definitions and validations

- Title max 200 chars; no HTML except allowed markdown subset if product supports.

## 17. Status / lifecycle rules

N/A beyond draft vs frozen: frozen groups **immutable** with version.

## 18. Search / filter / sort behavior

- Filter lines by group in editor; sort lines **within** group by `lineOrdinal`.

## 19. Relationships to other objects

- **Version 1—* Groups**; **Group 1—* Lines**.

## 20. Permissions / visibility

- Inherit quote version permissions.

## 21. Mobile behavior

- Read-only section headers on proposal view.

## 22. Notifications / side effects

- None material.

## 23. Audit / history requirements

- Log group structural changes on draft with quote audit channel.

## 24. Edge cases

- **All lines ungrouped:** system ensures **default** “Items” group auto-created on first line add.

## 25. What must not happen

- Using **group** as **routing** or **node** surrogate.

## 26. Out of scope

- **Conditional display** groups (dynamic pricing UI) — future.

## 27. Open questions

- **AI reorder** of groups/lines — cosmetic only per `08-ai-assistance`; confirm UX label “suggestion”.
