# Epic 56 — Notifications

## 1. Epic title

Notifications

## 2. Purpose

Define **in-app**, **email**, **SMS**, and **push** notifications: **triggers**, **templates**, **user preferences**, **throttling**, **deep links**, and **audit** — cross-cutting for quotes, jobs, execution, portal, payments.

## 3. Why this exists

Without a **central** notification contract, each epic invents **duplicate** emails and **inconsistent** copy.

## 4. Canon alignment

- **Scheduling** reminders must **not** claim **start enforcement** MVP (`01`).
- **AI** does not send **freeze** notices without human action (`08-ai`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **All users** | Manage **own** preferences (channels per event type). |
| **Admin** | Configure **tenant templates** and **branding**. |

## 6. Primary object(s) affected

- **NotificationTemplate** (`eventKey`, `channel`, `subject`, `body`, `locale`).
- **NotificationLog** (`userId`, `eventKey`, `payloadRef`, `sentAt`, `status`).

## 7. Where it lives in the product

- **Bell** inbox `/notifications`; **Settings → Notifications**.

## 8. Create flow

- **System** enqueues on domain events (`quote.sent`, `task.completed`, etc.) with **idempotent** key `(eventKey, entityId, recipientId, version)` to prevent duplicates.

## 9. Read / list / detail behavior

- Inbox list **unread** first; mark read on open; **deep link** to target entity.

**Empty:** “You’re all caught up.”

## 10. Edit behavior

- User toggles channels per **category** (Sales, Field, Money).

## 11. Archive behavior

- Auto-archive > 90 days (configurable 60).

## 12. Delete behavior

- User may **clear** notifications (soft hide).

## 13. Restore behavior

- N/A.

## 14. Required fields

Log: `recipientId`, `eventKey`, `createdAt`.

## 15. Optional fields

`emailMessageId`, `smsSid`, `pushTicketId`.

## 16. Field definitions and validations

- **Throttling:** max N SMS/hour per user.
- **Template** variables validated against **allowlist** to prevent **header injection**.

## 17. Status / lifecycle rules

`queued` | `sent` | `failed` | `suppressed` (prefs).

## 18. Search / filter / sort behavior

- Filter inbox by category; search **title** substring.

## 19. Relationships to other objects

- **All** domain entities as **payload** references only.

## 20. Permissions / visibility

- Users see **own** inbox; admins see **tenant** delivery failures dashboard.

## 21. Mobile behavior

- Push **tap** routes through **notification router** table (eventKey → path).

## 22. Notifications / side effects

- **Meta:** this epic defines **delivery**; domain epics define **when** to emit events.

## 23. Audit / history requirements

- Log **template used** and **payload hash** (PII-aware).

## 24. Edge cases

- **Bounced email:** mark failed; **surface** to admin after 3 bounces disable address.

## 25. What must not happen

- **Spamming** customer on every **draft** autosave (`11`).

## 26. Out of scope

- **WhatsApp** Business API.

## 27. Open questions

- **SMS** vendor choice — ops.
