# Epic 05 — Notes and activity timeline

## 1. Epic title

Notes and activity timeline

## 2. Purpose

Define **notes** (user-authored commentary) and the **activity timeline** (notes + system events + audit highlights) as **polymorphic** UI and data behavior attaching to **leads, customers, FlowGroups, quotes, quote versions, jobs, runtime tasks** (where enabled), and **catalog** objects if needed.

## 3. Why this exists

Teams coordinate through **context** that does not belong in structured fields. Without notes, information lives in email. The **timeline** gives chronological **what happened** for support and handoff.

## 4. Canon alignment

- Notes are **not** execution truth (`TaskExecution`), **not** commercial truth, **not** freeze artifacts.
- **AI** may suggest note drafts but **human sends** (epic 22 / `08-ai-assistance`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Admin** | View all; delete policy (usually **no delete** — append-only). |
| **Office** | Add/edit own notes within **edit window** (e.g. 24h) per epic 01 pattern; read all on objects they can see. |
| **Field** | Add **job-scoped** notes when permitted; read job notes. |
| **Customer** | **Does not** see internal notes; optional **customer-visible message** type (future). |

## 6. Primary object(s) affected

- **Note** (`parentType`, `parentId`, `body`, `visibility`).
- **ActivityEvent** (optional materialized view vs query audit+notes).

## 7. Where it lives in the product

- **Tab or right rail** “Notes & activity” on every major parent detail page.
- **@mention** autocomplete for users (if product ships mentions).

## 8. Create flow

1. User opens parent detail → **Add note**.
2. **Body** required, plain text or rich text (product choice); max **10_000** chars if plain.
3. **Visibility** enum: `internal` (default), `office_only`, `field_visible` (rare).
4. Save → `createdAt`, `createdBy`; appears at top of timeline (newest first) or bottom (oldest first — **pick one globally**: default **newest at top** for notes input below list).

## 9. Read / list / detail behavior

**Timeline entries:** Notes interleaved with **system cards** (“Quote v3 sent”, “Signed”, “Activated”, “Hold applied”) — system cards read-only, sourced from audit or domain events.

**Filter chips:** Notes only / All activity.

**Empty:** “No notes yet — add context for your team.”

**Pagination:** Load more for timelines > 50 entries.

## 10. Edit behavior

- Author may edit within **24h**; admin may edit any time with **audit** of before/after.
- After window: **append correction note** instead.

## 11. Archive behavior

- **Not applicable for notes** — use **redact** (admin) to replace body with “[Redacted]” and audit, instead of hiding.

## 12. Delete behavior

- **Default: no delete** for integrity. **Admin redact** only. Alternative tenant policy: **soft-delete** visible as “Note removed” stub — must be explicit in tenant settings (epic 60).

## 13. Restore behavior

- Not applicable unless soft-delete; restore shows content again (admin).

## 14. Required fields

| Field | Type | Why |
|-------|------|-----|
| `parentType`, `parentId` | enum + id | Anchor. |
| `body` | text | Empty note disallowed. |

## 15. Optional fields

`mentions[]` (user ids), `attachments[]` (file refs epic 06), `pinned` boolean (show at top).

## 16. Field definitions and validations

- Strip leading/trailing whitespace; reject whitespace-only.
- Sanitize rich text for XSS if HTML allowed.

## 17. Status / lifecycle rules

Note is `active` | `redacted` | `soft_deleted` (if enabled).

## 18. Search / filter / sort behavior

- **Within parent:** full-text substring on note body (min 3 chars).
- **Global** note search out of scope (epic 58 may add).

## 19. Relationships to other objects

- Polymorphic parent. **File** attachments reference note id.

## 20. Permissions / visibility

- **internal:** office + admin.
- **field_visible:** field users on that job/project.
- Enforce parent read permission first.

## 21. Mobile behavior

- Add note on job detail; voice-to-text optional OS feature.
- Timeline infinite scroll.

## 22. Notifications / side effects

- @mention sends in-app notification (if mentions exist).
- Optional email digest (epic 56).

## 23. Audit / history requirements

- Note create/edit/redact fully audited with actor and timestamps.

## 24. Edge cases

- **Very long paste:** enforce max length with friendly error.
- **Concurrent edits:** last-write-wins on body within edit window.

## 25. What must not happen

- Notes **replacing** structured data required for **send** or **activation**.
- **AI** auto-posting notes without user click **Send**.

## 26. Out of scope

- **Email threading** ingestion as notes.
- **SMS** two-way sync.

## 27. Open questions

- **Rich text vs markdown:** choose one for v3 MVP for consistency across portal and office.
